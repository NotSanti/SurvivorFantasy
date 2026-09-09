import { createClient } from 'npm:@supabase/supabase-js@2'
import { authorizeCronRequest } from '../_shared/cron-auth.ts'
import { logEvent, redactForLog, requestIdFrom } from '../_shared/redact.ts'
import { isInResultsWindow } from '../_shared/schedule-window.ts'
import { decideEpisodeImport, runIndependentNotify } from './decide-episode.ts'
import { discoverSeason51Source } from './discover-source.ts'
import { parseAltScores, parseResultsHtml } from './parse-results.ts'
import { SCORE_PARSER_VERSION, type AliasRecord, type PublishedScore } from './score-types.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret, x-request-id',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  const requestId = requestIdFrom(request)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server is missing Supabase credentials' }, 500)
  }

  const cronAuth = authorizeCronRequest({
    expectedSecret: Deno.env.get('CRON_SECRET'),
    providedSecret: request.headers.get('x-cron-secret'),
  })
  const authHeader = request.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: isAdmin } = await userClient.rpc('is_admin')
  const viaCron = cronAuth.ok
  if (!viaCron && !isAdmin) {
    logEvent('import_scores_denied', { request_id: requestId, code: cronAuth.code ?? 'not_admin' })
    return json({ error: 'Admin or cron secret required' }, 403)
  }

  const body = (await request.json().catch(() => ({}))) as {
    recovery?: { episodeNumber: number; altText: string; imageUrl?: string }
  }
  if (body.recovery && !isAdmin) {
    return json({ error: 'Recovery is admin only' }, 403)
  }

  const db = viaCron ? createClient(supabaseUrl, serviceKey) : userClient
  const { data: season, error: seasonError } = await db
    .from('seasons')
    .select('id, number, status, source_page_url, first_scored_episode')
    .eq('number', 51)
    .single()
  if (seasonError || !season) return json({ error: 'Season 51 is not configured' }, 500)

  if (viaCron && !body.recovery) {
    if (season.status !== 'active') {
      logEvent('import_scores_noop', { request_id: requestId, code: 'season_inactive' })
      return json({ status: 'noop', code: 'season_inactive' })
    }
    if (!isInResultsWindow(new Date())) {
      logEvent('import_scores_noop', { request_id: requestId, code: 'outside_window' })
      return json({ status: 'noop', code: 'outside_window' })
    }
  }

  const triggerType = viaCron && !isAdmin ? 'schedule' : 'manual'
  const { data: runId, error: runError } = await db.rpc('create_score_import_run', {
    p_season_id: season.id,
    p_trigger_type: triggerType,
    p_source_url: season.source_page_url ?? 'https://www.globaltv.com/survivor-51-fantasy-tribe/',
  })
  if (runError || !runId) return json({ error: 'Could not start an import run' }, 500)
  logEvent('import_scores_started', { request_id: requestId, run_id: runId, trigger: triggerType })

  try {
    if (body.recovery) {
      const parsed = parseAltScores(body.recovery.altText)
      if (!parsed.ok) {
        await finish(db, runId, 'needs_review', { recovery: true }, parsed.code, parsed.detail)
        return json({ status: 'needs_review', code: parsed.code, detail: parsed.detail })
      }
      const outcome = await importEpisodes(db, {
        seasonId: season.id,
        runId,
        firstScored: season.first_scored_episode ?? 2,
        episodes: [
          {
            episodeNumber: body.recovery.episodeNumber,
            imageUrl: body.recovery.imageUrl ?? null,
            altText: body.recovery.altText,
            scores: parsed.scores,
          },
        ],
      })
      await finish(db, runId, outcome.status, outcome.summary, outcome.errorCode, outcome.detail)
      logEvent('import_scores_finished', {
        request_id: requestId,
        run_id: runId,
        status: outcome.status,
      })
      return json(outcome)
    }

    const discovered = await discoverSeason51Source({
      userAgent: Deno.env.get('SOURCE_USER_AGENT') ?? undefined,
    })
    if (!discovered.ok) {
      const status = discovered.code === 'not_published_yet' ? 'noop' : 'failed'
      await finish(
        db,
        runId,
        status,
        { via: 'discover' },
        discovered.code,
        discovered.detail,
        null,
        discovered.httpStatus,
      )
      logEvent('import_scores_finished', {
        request_id: requestId,
        run_id: runId,
        status,
        code: discovered.code,
      })
      return json({ status, code: discovered.code, detail: discovered.detail })
    }

    const parsed = await parseResultsHtml(discovered.document.html)
    if (!parsed.ok) {
      await finish(db, runId, 'needs_review', {}, parsed.code, parsed.detail)
      return json({ status: 'needs_review', code: parsed.code, detail: parsed.detail })
    }

    const outcome = await importEpisodes(db, {
      seasonId: season.id,
      runId,
      firstScored: season.first_scored_episode ?? 2,
      episodes: parsed.episodes,
    })
    await finish(
      db,
      runId,
      outcome.status,
      { ...outcome.summary, parser_version: SCORE_PARSER_VERSION },
      outcome.errorCode,
      outcome.detail,
      parsed.contentHash,
      discovered.document.httpStatus,
    )
    logEvent('import_scores_finished', {
      request_id: requestId,
      run_id: runId,
      status: outcome.status,
    })
    return json(outcome)
  } catch (error) {
    const detail = redactForLog(error instanceof Error ? error.message : 'Import failed')
    await finish(db, runId, 'failed', {}, 'exception', detail)
    logEvent('import_scores_failed', { request_id: requestId, run_id: runId, detail })
    return json({ status: 'failed', detail }, 500)
  }
})

async function finish(
  db: ReturnType<typeof createClient>,
  runId: string,
  status: 'succeeded' | 'noop' | 'needs_review' | 'failed',
  summary: Record<string, unknown>,
  errorCode?: string | null,
  detail?: string | null,
  sourceHash?: string | null,
  httpStatus?: number | null,
) {
  await db.rpc('finish_score_import_run', {
    p_run_id: runId,
    p_status: status,
    p_summary: summary,
    p_error_code: errorCode ?? undefined,
    p_error_detail: detail ? redactForLog(detail) : undefined,
    p_source_hash: sourceHash ?? undefined,
    p_http_status: httpStatus ?? undefined,
  })
}

async function importEpisodes(
  db: ReturnType<typeof createClient>,
  input: {
    seasonId: string
    runId: string
    firstScored: number
    episodes: Array<{ episodeNumber: number; imageUrl: string | null; altText: string; scores: { sourceName: string; points: number }[] }>
  },
) {
  const { data: aliasRows } = await db
    .from('castaway_source_aliases')
    .select('normalized_source_name, castaway_id')
    .eq('season_id', input.seasonId)
  const aliases: AliasRecord[] = (aliasRows ?? []).map((row) => ({
    normalizedSourceName: row.normalized_source_name,
    castawayId: row.castaway_id,
  }))

  const { data: publishedRows } = await db
    .from('castaway_episode_score_revisions')
    .select('castaway_id, points_total, episode_id, episodes!inner(episode_number, season_id)')
    .eq('status', 'published')
    .eq('season_id', input.seasonId)

  const publishedByEpisode = new Map<number, PublishedScore[]>()
  for (const row of publishedRows ?? []) {
    const episode = row.episodes as unknown as { episode_number: number }
    const list = publishedByEpisode.get(episode.episode_number) ?? []
    list.push({ castawayId: row.castaway_id, points: row.points_total })
    publishedByEpisode.set(episode.episode_number, list)
  }

  const summary: Array<Record<string, unknown>> = []
  let needsReview = false
  let publishedCount = 0
  let noopCount = 0
  let notifyFailed = false

  for (const episode of input.episodes) {
    const decision = await decideEpisodeImport(
      episode,
      aliases,
      publishedByEpisode.get(episode.episodeNumber) ?? [],
      { firstScoredEpisode: input.firstScored },
    )
    if (decision.status === 'needs_review') {
      needsReview = true
      summary.push(decision)
      continue
    }
    if (decision.status === 'noop') {
      noopCount += 1
      summary.push(decision)
      continue
    }

    const { data, error } = await db.rpc('publish_episode_scores', {
      p_season_id: input.seasonId,
      p_episode_number: decision.episodeNumber,
      p_run_id: input.runId,
      p_scores: decision.scores.map((row) => ({
        castaway_id: row.castawayId,
        points_total: row.points,
      })),
      p_source_image_url: decision.imageUrl,
      p_source_alt_text_hash: decision.altHash,
    })
    if (error) throw error
    const published = data as { status?: string; kind?: string; episode_id?: string }
    if (published?.status === 'noop') {
      noopCount += 1
      summary.push({ ...decision, persisted: 'noop' })
      continue
    }
    publishedCount += 1
    const notified = await runIndependentNotify(published, async (value) => {
      const { error: notifyError } = await db.rpc('enqueue_score_notifications', {
        p_episode_id: value.episode_id as string,
        p_kind: value.kind ?? decision.kind,
      })
      if (notifyError) throw notifyError
    })
    if (notified.notifyFailed) notifyFailed = true
    summary.push({ ...decision, persisted: published, notifyFailed: notified.notifyFailed })
  }

  const status = needsReview ? 'needs_review' : publishedCount > 0 || noopCount > 0 ? (publishedCount > 0 ? 'succeeded' : 'noop') : 'failed'
  return {
    status,
    summary: { episodes: summary, notifyFailed },
    errorCode: needsReview ? 'needs_review' : notifyFailed ? 'notify_failed' : null,
    detail: needsReview
      ? 'At least one episode needs review. Valid episodes were still published.'
      : notifyFailed
        ? 'Scores published; notification enqueue failed.'
        : null,
  }
}

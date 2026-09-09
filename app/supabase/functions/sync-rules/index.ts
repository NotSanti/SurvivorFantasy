import { createClient } from 'npm:@supabase/supabase-js@2'
import { discoverSeason51Source } from './discover-source.ts'
import { parseRulesHtml } from './parse-rules.ts'
import { PARSER_VERSION, type ProposedRuleSet } from './types.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server is missing Supabase credentials' }, 500)
  }

  const authHeader = request.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: isAdmin } = await userClient.rpc('is_admin')
  if (!isAdmin) {
    return json({ error: 'Admin only' }, 403)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: season, error: seasonError } = await admin
    .from('seasons')
    .select('id, number, source_page_url')
    .eq('number', 51)
    .single()
  if (seasonError || !season) {
    return json({ error: 'Season 51 is not configured' }, 500)
  }

  const started = new Date().toISOString()
  const discovered = await discoverSeason51Source({
    userAgent: Deno.env.get('SOURCE_USER_AGENT') ?? undefined,
  })

  await admin
    .from('seasons')
    .update({ source_checked_at: started })
    .eq('id', season.id)

  if (!discovered.ok) {
    const status =
      discovered.code === 'not_published_yet' ? 'not_published_yet' : 'fetch_failed'
    await admin.from('rule_sync_runs').insert({
      season_id: season.id,
      trigger_type: 'manual',
      status,
      source_url: season.source_page_url,
      parser_version: PARSER_VERSION,
      http_status: discovered.httpStatus,
      error_code: discovered.code,
      error_detail_redacted: discovered.detail.slice(0, 300),
      started_at: started,
      finished_at: new Date().toISOString(),
    })
    return json({
      status,
      code: discovered.code,
      detail: discovered.detail,
    })
  }

  const parsed = await parseRulesHtml(discovered.document.html)
  if (!parsed.ok) {
    await admin.from('rule_sync_runs').insert({
      season_id: season.id,
      trigger_type: 'manual',
      status: 'parse_failed',
      source_url: discovered.document.url,
      source_post_id: discovered.document.wpPostId,
      source_modified_at: discovered.document.modifiedAt,
      parser_version: PARSER_VERSION,
      http_status: discovered.document.httpStatus,
      error_code: parsed.code,
      error_detail_redacted: parsed.detail.slice(0, 300),
      started_at: started,
      finished_at: new Date().toISOString(),
    })
    return json({
      status: 'parse_failed',
      code: parsed.code,
      detail: parsed.detail,
      unknownLabels: parsed.unknownLabels ?? [],
    })
  }

  const { data: latest } = await admin
    .from('rule_sets')
    .select('id, version, source_hash, status')
    .eq('season_id', season.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.source_hash === parsed.contentHash) {
    await admin.from('rule_sync_runs').insert({
      season_id: season.id,
      trigger_type: 'manual',
      status: 'noop',
      source_url: discovered.document.url,
      source_post_id: discovered.document.wpPostId,
      source_modified_at: discovered.document.modifiedAt,
      source_hash: parsed.contentHash,
      parser_version: PARSER_VERSION,
      http_status: discovered.document.httpStatus,
      proposed_rule_set_id: latest.id,
      started_at: started,
      finished_at: new Date().toISOString(),
    })
    return json({ status: 'noop', ruleSetId: latest.id, version: latest.version })
  }

  const nextVersion = (latest?.version ?? 0) + 1
  const inserted = await persistDraft(admin, {
    seasonId: season.id,
    version: nextVersion,
    sourceUrl: discovered.document.url,
    sourceHash: parsed.contentHash,
    sourceModifiedAt: discovered.document.modifiedAt,
    proposed: parsed.proposed,
    wpPostId: discovered.document.wpPostId,
  })

  await admin
    .from('seasons')
    .update({
      source_page_url: discovered.document.url,
      source_wp_post_id: discovered.document.wpPostId,
    })
    .eq('id', season.id)

  await admin.from('rule_sync_runs').insert({
    season_id: season.id,
    trigger_type: 'manual',
    status: 'draft_created',
    source_url: discovered.document.url,
    source_post_id: discovered.document.wpPostId,
    source_modified_at: discovered.document.modifiedAt,
    source_hash: parsed.contentHash,
    parser_version: PARSER_VERSION,
    http_status: discovered.document.httpStatus,
    proposed_rule_set_id: inserted.id,
    started_at: started,
    finished_at: new Date().toISOString(),
  })

  return json({
    status: 'draft_created',
    ruleSetId: inserted.id,
    version: nextVersion,
    via: discovered.document.via,
  })
})

async function persistDraft(
  admin: ReturnType<typeof createClient>,
  input: {
    seasonId: string
    version: number
    sourceUrl: string
    sourceHash: string
    sourceModifiedAt: string | null
    proposed: ProposedRuleSet
    wpPostId: number | null
  },
) {
  const { data, error } = await admin
    .from('rule_sets')
    .insert({
      season_id: input.seasonId,
      version: input.version,
      status: 'draft',
      source_url: input.sourceUrl,
      source_hash: input.sourceHash,
      source_modified_at: input.sourceModifiedAt,
      effective_from_episode: input.proposed.firstScoredEpisode,
      roster_size: input.proposed.rosterSize,
      wildcard_slots: input.proposed.wildcardSlots,
      picks_per_original_tribe: input.proposed.picksPerOriginalTribe,
      first_scored_episode: input.proposed.firstScoredEpisode,
      pending_confirmation: true,
      parser_version: PARSER_VERSION,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw error ?? new Error('Could not insert rule set')
  }

  const { error: rulesError } = await admin.from('scoring_rules').insert(
    input.proposed.scoringRules.map((rule) => ({
      rule_set_id: data.id,
      code: rule.code,
      label: rule.label,
      points: rule.points,
      kind: rule.kind,
      phase: rule.phase,
      max_occurrences_per_castaway_episode: rule.maxOccurrencesPerCastawayEpisode,
      sort_order: rule.sortOrder,
    })),
  )
  if (rulesError) throw rulesError
  return data
}

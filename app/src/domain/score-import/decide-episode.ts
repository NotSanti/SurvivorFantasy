import { sha256Hex } from '@/domain/rules-sync/normalize'
import { resolveEpisodeAliases } from './resolve-aliases'
import type { AliasRecord, EpisodeDecision, ParsedEpisode, PublishedScore } from './types'

export async function decideEpisodeImport(
  episode: ParsedEpisode,
  aliases: AliasRecord[],
  published: PublishedScore[],
  options: { firstScoredEpisode: number; expectedMinNames?: number },
): Promise<EpisodeDecision> {
  if (episode.episodeNumber < options.firstScoredEpisode) {
    return {
      status: 'needs_review',
      episodeNumber: episode.episodeNumber,
      code: 'before_first_scored',
      detail: `Episode ${episode.episodeNumber} is before the first scored episode.`,
    }
  }

  const resolved = resolveEpisodeAliases(episode, aliases)
  if (!resolved.ok) {
    return {
      status: 'needs_review',
      episodeNumber: episode.episodeNumber,
      code: resolved.code,
      detail: resolved.detail,
      unknownNames: resolved.unknownNames,
    }
  }

  const minNames = options.expectedMinNames ?? 1
  if (resolved.scores.length < minNames) {
    return {
      status: 'needs_review',
      episodeNumber: episode.episodeNumber,
      code: 'payload_shrink',
      detail: 'Episode payload is empty or smaller than expected.',
    }
  }
  if (
    published.length > 0 &&
    resolved.scores.length < Math.ceil(published.length * 0.5)
  ) {
    return {
      status: 'needs_review',
      episodeNumber: episode.episodeNumber,
      code: 'payload_shrink',
      detail: 'New totals cover far fewer castaways than the published revision.',
    }
  }

  const altHash = await sha256Hex(episode.altText)
  const byId = new Map(published.map((row) => [row.castawayId, row.points]))
  const identical =
    published.length === resolved.scores.length &&
    resolved.scores.every((row) => byId.get(row.castawayId) === row.points)
  if (identical && published.length > 0) {
    return { status: 'noop', episodeNumber: episode.episodeNumber, altHash }
  }

  return {
    status: 'publish',
    episodeNumber: episode.episodeNumber,
    kind: published.length > 0 ? 'correction' : 'new',
    scores: resolved.scores,
    imageUrl: episode.imageUrl,
    altHash,
  }
}

export async function runIndependentNotify<T>(
  published: T,
  notify: (value: T) => Promise<void>,
): Promise<{ published: T; notifyFailed: boolean }> {
  try {
    await notify(published)
    return { published, notifyFailed: false }
  } catch {
    return { published, notifyFailed: true }
  }
}

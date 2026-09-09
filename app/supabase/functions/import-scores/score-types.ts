export const SCORE_PARSER_VERSION = 'scores-v1'

export type ParsedScore = {
  sourceName: string
  points: number
}

export type ParsedEpisode = {
  episodeNumber: number
  imageUrl: string | null
  altText: string
  scores: ParsedScore[]
}

export type ParseFailureCode =
  | 'empty_content'
  | 'missing_results'
  | 'malformed_alt'
  | 'duplicate_names'
  | 'empty_episode'

export type ParseSuccess = {
  ok: true
  episodes: ParsedEpisode[]
  contentHash: string
}

export type ParseFailure = {
  ok: false
  code: ParseFailureCode
  detail: string
}

export type ParseResult = ParseSuccess | ParseFailure

export type AliasRecord = {
  normalizedSourceName: string
  castawayId: string
}

export type ResolvedScore = {
  sourceName: string
  castawayId: string
  points: number
}

export type EpisodeDecision =
  | { status: 'publish'; episodeNumber: number; kind: 'new' | 'correction'; scores: ResolvedScore[]; imageUrl: string | null; altHash: string }
  | { status: 'noop'; episodeNumber: number; altHash: string }
  | { status: 'needs_review'; episodeNumber: number; code: string; detail: string; unknownNames?: string[] }

export type PublishedScore = {
  castawayId: string
  points: number
}

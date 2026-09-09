export const PARSER_VERSION = 'rules-v1'
export const SEASON_51_SLUG = 'survivor-51-fantasy-tribe'
export const WP_POSTS_URL = 'https://www.globaltv.com/wp-json/wp/v2/posts'
export const CANONICAL_PAGE_URL = 'https://www.globaltv.com/survivor-51-fantasy-tribe/'
export const ALLOWED_HOSTS = new Set(['www.globaltv.com', 'globaltv.com'])
export const MAX_RESPONSE_BYTES = 1_000_000
export const FETCH_TIMEOUT_MS = 8_000
export const DEFAULT_USER_AGENT = 'KindlingFantasy/0.1 (unofficial fan-made league; rules-sync)'

export type ScoringRuleKind = 'survival' | 'weekly_category' | 'placement' | 'mvp'
export type ScoringPhase = 'pre_merge' | 'post_merge' | 'finale' | 'any'

export type ProposedScoringRule = {
  code: string
  label: string
  points: number
  kind: ScoringRuleKind
  phase: ScoringPhase
  maxOccurrencesPerCastawayEpisode: number | null
  sortOrder: number
}

export type ProposedRuleSet = {
  rosterSize: number
  wildcardSlots: number
  picksPerOriginalTribe: {
    per_tribe: number
    tribe_count: number
    manual_distribution: number[]
  }
  firstScoredEpisode: number
  scoringRules: ProposedScoringRule[]
}

export type ParseSuccess = {
  ok: true
  proposed: ProposedRuleSet
  contentHash: string
}

export type ParseFailure = {
  ok: false
  code:
    | 'malformed_html'
    | 'unknown_rules'
    | 'missing_quotas'
    | 'empty_content'
  detail: string
  unknownLabels?: string[]
}

export type ParseResult = ParseSuccess | ParseFailure

export type FetchFailureCode =
  | 'not_published_yet'
  | 'timeout'
  | 'too_large'
  | 'redirect_blocked'
  | 'disallowed_host'
  | 'bad_content_type'
  | 'http_error'
  | 'network'

export type SourceDocument = {
  url: string
  html: string
  wpPostId: number | null
  modifiedAt: string | null
  httpStatus: number
  via: 'wordpress_rest' | 'html_fallback'
}

export type DiscoverResult =
  | { ok: true; document: SourceDocument }
  | { ok: false; code: FetchFailureCode; httpStatus: number | null; detail: string }

export type RuleDiffEntry = {
  path: string
  before: string | number | null
  after: string | number | null
}

export const KNOWN_SCORING_RULES: Array<{
  code: string
  needles: string[]
  points: number
  kind: ScoringRuleKind
  phase: ScoringPhase
  maxOccurrencesPerCastawayEpisode: number | null
}> = [
  {
    code: 'survive_pre_merge',
    needles: ['survive', 'pre-merge'],
    points: 1,
    kind: 'survival',
    phase: 'pre_merge',
    maxOccurrencesPerCastawayEpisode: 1,
  },
  {
    code: 'survive_post_merge',
    needles: ['survive', 'post-merge'],
    points: 3,
    kind: 'survival',
    phase: 'post_merge',
    maxOccurrencesPerCastawayEpisode: 1,
  },
  {
    code: 'place_third',
    needles: ['finish third'],
    points: 10,
    kind: 'placement',
    phase: 'finale',
    maxOccurrencesPerCastawayEpisode: 1,
  },
  {
    code: 'place_second',
    needles: ['finish second'],
    points: 20,
    kind: 'placement',
    phase: 'finale',
    maxOccurrencesPerCastawayEpisode: 1,
  },
  {
    code: 'place_first',
    needles: ['win the season'],
    points: 30,
    kind: 'placement',
    phase: 'finale',
    maxOccurrencesPerCastawayEpisode: 1,
  },
  {
    code: 'mvp_win',
    needles: ['mvp wins'],
    points: 30,
    kind: 'mvp',
    phase: 'finale',
    maxOccurrencesPerCastawayEpisode: 1,
  },
]

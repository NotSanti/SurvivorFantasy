export type BreakdownLine = {
  rule_code: string | null
  label: string
  source_label?: string
  points: number
  occurrences: number
}

export type BreakdownCastawayProposal = {
  castaway_id: string
  display_name: string
  points_total: number
  vision_points_total?: number
  line_sum?: number
  total_mismatch?: boolean
  lines: BreakdownLine[]
}

export type BreakdownProposal = {
  castaways: BreakdownCastawayProposal[]
}

export type PublishedScoreEvent = {
  season_id: string | null
  episode_id: string | null
  episode_number: number | null
  castaway_id: string | null
  score_revision_id: string | null
  revision: number | null
  points_total: number | null
  scoring_rule_id: string | null
  rule_code: string | null
  rule_label: string | null
  rule_kind: string | null
  occurrences: number | null
  points: number | null
  evidence_note: string | null
}

export type ImportRunSnapshot = {
  status: string
  errorCode: string | null
}

export type SourceCheckKind = 'none' | 'no_result_yet' | 'success' | 'needs_review' | 'failure'

const NO_RESULT_CODES = new Set([
  'not_published_yet',
  'outside_window',
  'season_inactive',
  'already_imported',
])

export function classifySourceCheck(run: ImportRunSnapshot | null): SourceCheckKind {
  if (!run) return 'none'
  if (run.status === 'succeeded') return 'success'
  if (run.status === 'needs_review') return 'needs_review'
  if (run.status === 'noop' && (!run.errorCode || NO_RESULT_CODES.has(run.errorCode))) {
    return 'no_result_yet'
  }
  if (run.status === 'started') return 'no_result_yet'
  return 'failure'
}

export function cronIsStale(lastScheduledAt: string | null, now = new Date()): boolean {
  if (!lastScheduledAt) return true
  return now.getTime() - new Date(lastScheduledAt).getTime() > 8 * 24 * 60 * 60 * 1000
}

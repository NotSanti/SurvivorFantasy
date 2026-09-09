export type DraftFailureReason =
  | 'not_selecting'
  | 'quota'
  | 'wildcard_exists'
  | 'wildcard_incomplete'
  | 'wildcard_empty'
  | 'mvp_not_on_roster'
  | 'not_ready'
  | 'premature_lock'
  | 'locked'
  | 'unknown'

export function classifyDraftError(message: string | null | undefined): DraftFailureReason {
  const text = (message ?? '').toLowerCase()
  if (!text) return 'unknown'
  if (text.includes('locked') || text.includes('no further')) return 'locked'
  if (text.includes('not in selection') || text.includes('not selecting')) return 'not_selecting'
  if (text.includes('quota') || text.includes('distribution') || text.includes('duplicate')) {
    return 'quota'
  }
  if (text.includes('already has a wildcard') || text.includes('second wildcard')) {
    return 'wildcard_exists'
  }
  if (text.includes('eight manual') || text.includes('manual picks')) return 'wildcard_incomplete'
  if (text.includes('no eligible')) return 'wildcard_empty'
  if (text.includes('mvp') && text.includes('roster')) return 'mvp_not_on_roster'
  if (text.includes('not ready') || text.includes('mark ready')) return 'not_ready'
  if (text.includes('cannot lock') || text.includes('valid roster')) return 'premature_lock'
  return 'unknown'
}

export function draftErrorCopy(reason: DraftFailureReason): string {
  switch (reason) {
    case 'not_selecting':
      return 'The draft room is only open while the league is selecting.'
    case 'quota':
      return 'Those picks do not fit the 3/3/2 tribe quotas.'
    case 'wildcard_exists':
      return 'A wildcard is already on this roster. It cannot be rolled again.'
    case 'wildcard_incomplete':
      return 'Request the wildcard only after eight valid manual picks.'
    case 'wildcard_empty':
      return 'No remaining castaways in the underfilled tribe. The wildcard cannot be created.'
    case 'mvp_not_on_roster':
      return 'MVP must be one of the nine people already on this roster.'
    case 'not_ready':
      return 'Every member needs a complete roster, MVP, and ready mark before lock.'
    case 'premature_lock':
      return 'The league cannot lock until every member has a complete roster and MVP.'
    case 'locked':
      return 'This league is locked. Initial rosters cannot change.'
    default:
      return 'That draft action could not be completed.'
  }
}

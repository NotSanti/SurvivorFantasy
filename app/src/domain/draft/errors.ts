export type DraftFailureReason =
  | 'not_selecting'
  | 'not_your_turn'
  | 'wrong_tribe'
  | 'claim_cap'
  | 'already_on_roster'
  | 'quota'
  | 'wildcard_exists'
  | 'wildcard_incomplete'
  | 'wildcard_empty'
  | 'mvp_not_on_roster'
  | 'mvp_not_ready'
  | 'not_ready'
  | 'premature_lock'
  | 'locked'
  | 'unknown'

export function classifyDraftError(message: string | null | undefined): DraftFailureReason {
  const text = (message ?? '').toLowerCase()
  if (!text) return 'unknown'
  if (text.includes('locked') || text.includes('no further')) return 'locked'
  if (text.includes('not your turn')) return 'not_your_turn'
  if (text.includes('current tribe pool') || text.includes('from the current tribe')) {
    return 'wrong_tribe'
  }
  if (text.includes('maximum number of teams') || text.includes('claimed by the maximum')) {
    return 'claim_cap'
  }
  if (text.includes('already on your roster')) return 'already_on_roster'
  if (text.includes('not open for picks') || text.includes('draft finishes')) return 'mvp_not_ready'
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
    case 'not_your_turn':
      return 'Wait for your turn before picking.'
    case 'wrong_tribe':
      return 'This round only allows picks from the active tribe.'
    case 'claim_cap':
      return 'That castaway is already on two teams.'
    case 'already_on_roster':
      return 'That castaway is already on your roster.'
    case 'quota':
      return 'Those picks do not fit the tribe quotas.'
    case 'wildcard_exists':
      return 'A wildcard is already on this roster. It cannot be rolled again.'
    case 'wildcard_incomplete':
      return 'Request the wildcard only after eight valid manual picks.'
    case 'wildcard_empty':
      return 'No remaining castaways in the underfilled tribe. The wildcard cannot be created.'
    case 'mvp_not_on_roster':
      return 'MVP must be someone already on your roster.'
    case 'mvp_not_ready':
      return 'MVP picks open after everyone finishes drafting.'
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

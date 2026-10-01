import { describe, expect, it } from 'vitest'
import { classifyDraftError } from './errors'

describe('classifyDraftError', () => {
  it('maps lock and wildcard messages', () => {
    expect(classifyDraftError('Member already has a wildcard')).toBe('wildcard_exists')
    expect(classifyDraftError('Cannot lock: a member is missing a valid roster')).toBe(
      'premature_lock',
    )
    expect(classifyDraftError('League is locked')).toBe('locked')
  })

  it('maps turn-based draft messages', () => {
    expect(classifyDraftError('It is not your turn to pick')).toBe('not_your_turn')
    expect(classifyDraftError('Pick must be an active castaway from the current tribe pool')).toBe(
      'wrong_tribe',
    )
    expect(classifyDraftError('Castaway is already claimed by the maximum number of teams')).toBe(
      'claim_cap',
    )
  })
})

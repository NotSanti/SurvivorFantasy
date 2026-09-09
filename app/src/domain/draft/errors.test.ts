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
})

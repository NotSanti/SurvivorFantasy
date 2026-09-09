import { describe, expect, it } from 'vitest'
import { classifyInviteError, inviteErrorCopy } from './invite-errors'

describe('classifyInviteError', () => {
  it('maps expired, revoked, and full copy', () => {
    expect(classifyInviteError('Invite has expired')).toBe('expired')
    expect(classifyInviteError('Invite has been revoked')).toBe('revoked')
    expect(classifyInviteError('This league is full')).toBe('full')
    expect(inviteErrorCopy('expired').title).toMatch(/expired/i)
  })
})

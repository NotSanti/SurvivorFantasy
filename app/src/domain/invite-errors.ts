export type InviteFailureReason =
  | 'missing'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'full'
  | 'closed'
  | 'unauthenticated'
  | 'unknown'

export function classifyInviteError(message: string | null | undefined): InviteFailureReason {
  const text = (message ?? '').toLowerCase()
  if (!text) return 'unknown'
  if (text.includes('missing a token')) return 'missing'
  if (text.includes('expired')) return 'expired'
  if (text.includes('revoked')) return 'revoked'
  if (text.includes('full') || text.includes('no remaining uses')) return 'full'
  if (text.includes('no longer accepting') || text.includes('selection begins')) return 'closed'
  if (text.includes('not authenticated') || text.includes('sign-in')) return 'unauthenticated'
  if (text.includes('invalid')) return 'invalid'
  return 'unknown'
}

export function inviteErrorCopy(reason: InviteFailureReason): { title: string; description: string } {
  switch (reason) {
    case 'missing':
      return {
        title: 'Invite not available',
        description: 'This join link is missing a token. Ask your commissioner for a new share link.',
      }
    case 'expired':
      return {
        title: 'This invite expired',
        description: 'Ask the commissioner to create a new invite link.',
      }
    case 'revoked':
      return {
        title: 'This invite was revoked',
        description: 'The commissioner turned this link off. Ask them for a new one.',
      }
    case 'full':
      return {
        title: 'This league is full',
        description: 'Every seat is taken. Kindling leagues stay private, so you will need another invite later.',
      }
    case 'closed':
      return {
        title: 'Joining is closed',
        description: 'Late joining is disabled after selection begins.',
      }
    case 'unauthenticated':
      return {
        title: 'Sign in to join',
        description: 'Use the magic link from your email, then return to this invite.',
      }
    case 'invalid':
      return {
        title: 'Invite is invalid',
        description: 'This token does not match an open invite.',
      }
    default:
      return {
        title: 'Invite not available',
        description: 'This invite could not be accepted. Ask the commissioner for a new link.',
      }
  }
}

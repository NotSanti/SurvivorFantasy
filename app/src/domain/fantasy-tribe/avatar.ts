export const TRIBE_AVATAR_BUCKET = 'tribe-avatars'

const AVATAR_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/

export type TribeAvatarKind = 'castaway' | 'upload' | 'letter'

export function tribeAvatarObjectPath(userId: string, leagueId: string) {
  return `${userId}/${leagueId}.webp`
}

export function isTribeAvatarObjectPath(path: string) {
  return AVATAR_PATH.test(path)
}

export function withAvatarCacheBuster(
  publicUrl: string,
  updatedAt: string | null | undefined,
) {
  if (!updatedAt) return publicUrl
  const join = publicUrl.includes('?') ? '&' : '?'
  return `${publicUrl}${join}v=${encodeURIComponent(updatedAt)}`
}

/** Castaway photo, then a custom upload, then the camp-name initial. */
export function resolveTribeAvatar(input: {
  castawayPhotoUrl?: string | null
  uploadUrl?: string | null
  displayName?: string | null
}): { src: string | null; initial: string; kind: TribeAvatarKind } {
  const castaway = input.castawayPhotoUrl?.trim() || null
  const upload = input.uploadUrl?.trim() || null
  const name = input.displayName?.trim() ?? ''
  const initial = name.charAt(0).toUpperCase() || '?'
  if (castaway) return { src: castaway, initial, kind: 'castaway' }
  if (upload) return { src: upload, initial, kind: 'upload' }
  return { src: null, initial, kind: 'letter' }
}

export function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

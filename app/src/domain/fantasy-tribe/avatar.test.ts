import { describe, expect, it } from 'vitest'
import {
  isTribeAvatarObjectPath,
  resolveTribeAvatar,
  tribeAvatarObjectPath,
  withAvatarCacheBuster,
} from './avatar'

const userId = '11111111-1111-4111-8111-111111111111'
const leagueId = '22222222-2222-4222-8222-222222222222'

describe('resolveTribeAvatar', () => {
  it('prefers a castaway photo over an upload', () => {
    expect(
      resolveTribeAvatar({
        castawayPhotoUrl: '/castaways/dee.png',
        uploadUrl: 'https://example.com/me.webp',
        displayName: 'Sam',
      }),
    ).toEqual({ src: '/castaways/dee.png', initial: 'S', kind: 'castaway' })
  })

  it('uses the upload url when no castaway photo is set', () => {
    const uploadUrl = withAvatarCacheBuster(
      'https://example.com/storage/v1/object/public/tribe-avatars/a/b.webp',
      '2026-10-09T02:00:00Z',
    )
    expect(uploadUrl).toBe(
      'https://example.com/storage/v1/object/public/tribe-avatars/a/b.webp?v=2026-10-09T02%3A00%3A00Z',
    )
    expect(
      resolveTribeAvatar({
        castawayPhotoUrl: '  ',
        uploadUrl,
        displayName: 'sam',
      }),
    ).toEqual({ src: uploadUrl, initial: 'S', kind: 'upload' })
  })

  it('falls back to the first letter of the camp name', () => {
    expect(resolveTribeAvatar({ displayName: ' River ' })).toEqual({
      src: null,
      initial: 'R',
      kind: 'letter',
    })
  })

  it('uses a question mark when the camp name is empty', () => {
    expect(resolveTribeAvatar({ displayName: '   ' })).toEqual({
      src: null,
      initial: '?',
      kind: 'letter',
    })
  })
})

describe('tribeAvatarObjectPath', () => {
  it('matches the storage key the database accepts', () => {
    const path = tribeAvatarObjectPath(userId, leagueId)
    expect(path).toBe(`${userId}/${leagueId}.webp`)
    expect(isTribeAvatarObjectPath(path)).toBe(true)
    expect(isTribeAvatarObjectPath(`${userId}/other.webp`)).toBe(false)
  })
})

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  resolveTribeAvatar,
  TRIBE_AVATAR_BUCKET,
  withAvatarCacheBuster,
} from '@/domain/fantasy-tribe/avatar'
import { getSupabaseClient } from '@/lib/supabase'
import { cn } from 'cn'

type TribeAvatarProps = {
  displayName: string
  castawayPhotoUrl?: string | null
  avatarPath?: string | null
  avatarUpdatedAt?: string | null
  ringColor: string
  onClick?: () => void
}

function uploadPublicUrl(
  path: string | null | undefined,
  updatedAt: string | null | undefined,
) {
  const cleaned = path?.trim()
  if (!cleaned) return null
  const { data } = getSupabaseClient()
    .storage.from(TRIBE_AVATAR_BUCKET)
    .getPublicUrl(cleaned)
  return withAvatarCacheBuster(data.publicUrl, updatedAt)
}

export function TribeAvatar({
  displayName,
  castawayPhotoUrl,
  avatarPath,
  avatarUpdatedAt,
  ringColor,
  onClick,
}: TribeAvatarProps) {
  const avatar = resolveTribeAvatar({
    castawayPhotoUrl,
    uploadUrl: uploadPublicUrl(avatarPath, avatarUpdatedAt),
    displayName,
  })

  const circle = (
    <span
      className="inline-flex shrink-0 rounded-full p-0.5"
      style={{ backgroundColor: ringColor }}
    >
      <Avatar key={avatar.src ?? 'letter'} size="lg">
        {avatar.src ? (
          <AvatarImage
            src={avatar.src}
            alt=""
            className={cn(
              avatar.kind === 'castaway' &&
                'origin-top scale-125 object-cover object-top',
            )}
          />
        ) : null}
        <AvatarFallback className="bg-muted font-display text-foreground text-base">
          {avatar.initial}
        </AvatarFallback>
      </Avatar>
    </span>
  )

  if (!onClick) return circle

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Change tribe picture"
      className="focus-visible:ring-ring/50 shrink-0 rounded-full outline-none focus-visible:ring-3"
    >
      {circle}
    </button>
  )
}

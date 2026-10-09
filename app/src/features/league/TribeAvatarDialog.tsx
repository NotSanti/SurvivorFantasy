import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  TRIBE_AVATAR_BUCKET,
  tribeAvatarObjectPath,
} from '@/domain/fantasy-tribe/avatar'
import { cropAvatarFile } from '@/features/league/crop-avatar'
import { getSupabaseClient } from '@/lib/supabase'
import { cn } from 'cn'

export type TribeAvatarCastaway = {
  id: string
  displayName: string
  photoUrl: string | null
}

type TribeAvatarDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  leagueId: string
  userId: string
  castaways: TribeAvatarCastaway[]
  castawayId: string | null
  avatarPath: string | null
  displayName: string
  ringColor: string
}

type SavedAvatar = {
  avatar_castaway_id: string | null
  avatar_path: string | null
  avatar_updated_at: string | null
}

function messageOf(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return 'Try again.'
}

export function TribeAvatarDialog({
  open,
  onOpenChange,
  leagueId,
  userId,
  castaways,
  castawayId,
  avatarPath,
  displayName,
  ringColor,
}: TribeAvatarDialogProps) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const pickingFile = useRef(false)
  const previewBlob = useRef<Blob | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const usingLetter = !castawayId && !avatarPath

  function clearPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    previewBlob.current = null
    setPreviewUrl(null)
  }

  function showPreview(blob: Blob) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(blob)
    previewUrlRef.current = url
    previewBlob.current = blob
    setPreviewUrl(url)
  }

  useEffect(() => {
    if (!open) return
    const onFocus = () => {
      window.setTimeout(() => {
        pickingFile.current = false
      }, 200)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [open])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const refresh = async (row: SavedAvatar) => {
    const photo = row.avatar_castaway_id
      ? (castaways.find((castaway) => castaway.id === row.avatar_castaway_id)
          ?.photoUrl ?? null)
      : null
    queryClient.setQueryData(
      ['fantasy-tribe', leagueId, userId],
      (current: Record<string, unknown> | undefined) => {
        if (!current) return current
        return {
          ...current,
          avatar_castaway_id: row.avatar_castaway_id,
          avatar_path: row.avatar_path,
          avatar_updated_at: row.avatar_updated_at,
          avatar_castaway: photo ? { photo_url: photo } : null,
        }
      },
    )
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['fantasy-tribe', leagueId, userId],
      }),
      queryClient.invalidateQueries({ queryKey: ['league-members', leagueId] }),
    ])
  }

  const save = useMutation({
    mutationFn: async (choice: {
      castawayId?: string
      blob?: Blob
      clear?: boolean
    }) => {
      const supabase = getSupabaseClient()
      const previousPath = avatarPath

      if (choice.blob) {
        const path = tribeAvatarObjectPath(userId, leagueId)
        const file = new File([choice.blob], 'avatar.webp', {
          type: 'image/webp',
        })
        const uploaded = await supabase.storage
          .from(TRIBE_AVATAR_BUCKET)
          .upload(path, file, {
            upsert: true,
            contentType: 'image/webp',
            cacheControl: '3600',
          })
        if (uploaded.error || !uploaded.data?.path) {
          throw uploaded.error ?? new Error('Could not upload that picture.')
        }
        const { data, error: rpcError } = await supabase.rpc(
          'set_tribe_avatar',
          {
            p_league_id: leagueId,
            p_avatar_path: path,
          },
        )
        if (rpcError) throw rpcError
        if (!data?.avatar_path) {
          throw new Error('Could not save that picture.')
        }
        return data
      }

      const { data, error: rpcError } = await supabase.rpc('set_tribe_avatar', {
        p_league_id: leagueId,
        ...(choice.castawayId ? { p_castaway_id: choice.castawayId } : {}),
      })
      if (rpcError) throw rpcError
      if (!data) throw new Error('Could not save that picture.')

      if (previousPath) {
        await supabase.storage.from(TRIBE_AVATAR_BUCKET).remove([previousPath])
      }
      return data
    },
    onSuccess: async (row) => {
      setError(null)
      await refresh(row)
      clearPreview()
      onOpenChange(false)
    },
    onError: (err) => {
      setError(messageOf(err))
    },
  })

  async function stageFile(file: File) {
    setError(null)
    setPreparing(true)
    try {
      const blob = await cropAvatarFile(file)
      showPreview(blob)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPreparing(false)
      window.setTimeout(() => {
        pickingFile.current = false
      }, 300)
    }
  }

  function openFilePicker() {
    pickingFile.current = true
    fileRef.current?.click()
  }

  const options = [...castaways].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pickingFile.current) return
        if (!next) {
          setError(null)
          clearPreview()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onFocusOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {previewUrl ? 'Preview picture' : 'Tribe picture'}
          </DialogTitle>
          <DialogDescription>
            {previewUrl
              ? 'This is how your tribe picture will look. Save it to use this photo.'
              : 'Choose a castaway, upload your own photo, or use the first letter of your camp name.'}
          </DialogDescription>
        </DialogHeader>
        {previewUrl ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <span
              className="inline-flex rounded-full p-1"
              style={{ backgroundColor: ringColor }}
            >
              <img
                src={previewUrl}
                alt=""
                className="size-24 rounded-full object-cover"
              />
            </span>
            <p className="text-muted-foreground text-sm">{displayName}</p>
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            {options.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Castaways are still loading.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {options.map((castaway) => {
                  const selected = castaway.id === castawayId
                  const letter =
                    castaway.displayName.trim().charAt(0).toUpperCase() || '?'
                  return (
                    <button
                      key={castaway.id}
                      type="button"
                      disabled={save.isPending || preparing}
                      aria-label={castaway.displayName}
                      aria-pressed={selected}
                      onClick={() => {
                        setError(null)
                        save.mutate({ castawayId: castaway.id })
                      }}
                      className={cn(
                        'focus-visible:ring-ring/50 flex min-h-11 flex-col items-center gap-1 rounded-lg p-1 text-center outline-none focus-visible:ring-3',
                        selected
                          ? 'bg-muted ring-foreground/30 ring-1'
                          : 'hover:bg-muted/60',
                      )}
                    >
                      <span className="bg-muted relative size-12 overflow-hidden rounded-full">
                        {castaway.photoUrl ? (
                          <img
                            src={castaway.photoUrl}
                            alt=""
                            className="size-full origin-top scale-125 object-cover object-top"
                          />
                        ) : (
                          <span className="font-display text-muted-foreground flex size-full items-center justify-center text-sm">
                            {letter}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground w-full truncate text-[0.65rem]">
                        {castaway.displayName}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {preparing ? (
          <p className="text-muted-foreground text-sm">Preparing preview…</p>
        ) : null}
        {save.isPending ? (
          <p className="text-muted-foreground text-sm">Saving…</p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {previewUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={save.isPending}
              onClick={() => {
                const blob = previewBlob.current
                if (!blob) return
                setError(null)
                save.mutate({ blob })
              }}
            >
              Save picture
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1"
              disabled={save.isPending}
              onClick={openFilePicker}
            >
              Choose another
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              disabled={save.isPending}
              onClick={() => {
                setError(null)
                clearPreview()
              }}
            >
              Back
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1"
              disabled={save.isPending || preparing}
              onClick={openFilePicker}
            >
              Upload a photo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              disabled={save.isPending || preparing || usingLetter}
              onClick={() => {
                setError(null)
                save.mutate({ clear: true })
              }}
            >
              Use initial
            </Button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) {
              pickingFile.current = false
              return
            }
            void stageFile(file)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

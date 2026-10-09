import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_FANTASY_TRIBE_COLOR,
  DEFAULT_FANTASY_TRIBE_NAME,
  FANTASY_TRIBE_COLORS,
  fantasyTribeColorSwatch,
  resolveFantasyTribeColorId,
  resolveFantasyTribeName,
  type FantasyTribeColorId,
} from '@/domain/fantasy-tribe/colors'
import { firstRelated } from '@/domain/fantasy-tribe/avatar'
import { TribeAvatar } from '@/features/league/TribeAvatar'
import {
  TribeAvatarDialog,
  type TribeAvatarCastaway,
} from '@/features/league/TribeAvatarDialog'
import { getSupabaseClient } from '@/lib/supabase'
import { cn } from 'cn'

type FantasyTribeHeaderProps = {
  leagueId: string
  userId: string
  totalPoints?: number
  /** When false, tribe name/color are display-only (other members). */
  editable?: boolean
  /** Profile name shown in muted parentheses when viewing another member’s tribe. */
  ownerName?: string | null
  castaways?: TribeAvatarCastaway[]
}

export function FantasyTribeHeader({
  leagueId,
  userId,
  totalPoints,
  editable = true,
  ownerName = null,
  castaways = [],
}: FantasyTribeHeaderProps) {
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const membershipQuery = useQuery({
    queryKey: ['fantasy-tribe', leagueId, userId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('league_members')
        .select(
          `
          fantasy_tribe_name,
          fantasy_tribe_color,
          avatar_castaway_id,
          avatar_path,
          avatar_updated_at,
          profiles ( display_name ),
          avatar_castaway:castaways ( photo_url )
        `,
        )
        .eq('league_id', leagueId)
        .eq('user_id', userId)
        .single()
      if (error) throw error
      return data
    },
  })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(DEFAULT_FANTASY_TRIBE_NAME)
  const [colorId, setColorId] = useState<FantasyTribeColorId>(
    DEFAULT_FANTASY_TRIBE_COLOR,
  )

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        'update_fantasy_tribe',
        {
          p_league_id: leagueId,
          p_name: name.trim(),
          p_color: colorId,
        },
      )
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['fantasy-tribe', leagueId, userId],
        (current) =>
          current
            ? {
                ...current,
                fantasy_tribe_name: data.fantasy_tribe_name,
                fantasy_tribe_color: data.fantasy_tribe_color,
              }
            : current,
      )
      void queryClient.invalidateQueries({
        queryKey: ['league-members', leagueId],
      })
      setEditing(false)
    },
  })

  const displayName = resolveFantasyTribeName(
    membershipQuery.data?.fantasy_tribe_name,
  )
  const displayColor = resolveFantasyTribeColorId(
    membershipQuery.data?.fantasy_tribe_color,
  )
  const nameColor = fantasyTribeColorSwatch(displayColor)
  const campName =
    firstRelated(membershipQuery.data?.profiles)?.display_name ??
    ownerName ??
    displayName
  const avatarPhotoUrl =
    firstRelated(membershipQuery.data?.avatar_castaway)?.photo_url ?? null

  if (membershipQuery.isLoading) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-muted size-10 animate-pulse rounded-full" />
          <div className="bg-muted h-10 w-40 animate-pulse rounded-md" />
        </div>
        <div className="bg-muted h-8 w-16 animate-pulse rounded-md" />
      </div>
    )
  }

  if (editable && editing) {
    return (
      <form
        className="space-y-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          void save.mutateAsync()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="fantasy-tribe-name">Tribe name</Label>
          <Input
            id="fantasy-tribe-name"
            value={name}
            minLength={2}
            maxLength={32}
            required
            autoFocus
            onChange={(event) => setName(event.target.value)}
            className="min-h-11"
            style={{ color: fantasyTribeColorSwatch(colorId) }}
          />
        </div>
        <div className="space-y-2">
          <Label>Tribe color</Label>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {FANTASY_TRIBE_COLORS.map((color) => {
              const selected = colorId === color.id
              return (
                <button
                  key={color.id}
                  type="button"
                  title={color.label}
                  aria-label={color.label}
                  aria-pressed={selected}
                  onClick={() => setColorId(color.id)}
                  className={cn(
                    'ring-offset-background size-9 rounded-full ring-2 ring-offset-2 transition',
                    selected
                      ? 'ring-foreground'
                      : 'hover:ring-border ring-transparent',
                  )}
                  style={{ backgroundColor: color.swatch }}
                />
              )
            })}
          </div>
        </div>
        {save.error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>
              {save.error instanceof Error ? save.error.message : 'Try again.'}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" className="min-h-11" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save tribe'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={save.isPending}
            onClick={() => {
              setName(displayName)
              setColorId(displayColor)
              setEditing(false)
              save.reset()
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <TribeAvatar
          displayName={campName}
          castawayPhotoUrl={avatarPhotoUrl}
          avatarPath={membershipQuery.data?.avatar_path}
          avatarUpdatedAt={membershipQuery.data?.avatar_updated_at}
          ringColor={nameColor}
          onClick={editable ? () => setPickerOpen(true) : undefined}
        />
        {editable ? (
          <TribeAvatarDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            leagueId={leagueId}
            userId={userId}
            castaways={castaways}
            castawayId={membershipQuery.data?.avatar_castaway_id ?? null}
            avatarPath={membershipQuery.data?.avatar_path ?? null}
            displayName={campName}
            ringColor={nameColor}
          />
        ) : null}
        <div className="flex min-w-0 items-baseline gap-1.5">
          <h1
            className="font-display truncate text-2xl leading-tight font-semibold"
            style={{ color: nameColor }}
          >
            {displayName}
          </h1>
          {ownerName ? (
            <span className="text-muted-foreground shrink-0 text-sm">
              ({ownerName})
            </span>
          ) : null}
        </div>
        {editable ? (
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-full transition"
            aria-label="Edit tribe name and color"
            onClick={() => {
              setName(displayName)
              setColorId(displayColor)
              setEditing(true)
              save.reset()
            }}
          >
            <Pencil className="size-4" />
          </button>
        ) : null}
      </div>
      {totalPoints != null ? (
        <span
          className="flex shrink-0 items-baseline gap-1 tabular-nums"
          aria-label={`${totalPoints} total points`}
        >
          <span className="font-display text-foreground text-2xl leading-none font-semibold">
            {totalPoints}
          </span>
          <span className="text-muted-foreground text-[0.65rem] tracking-wide uppercase">
            pts
          </span>
        </span>
      ) : null}
    </div>
  )
}

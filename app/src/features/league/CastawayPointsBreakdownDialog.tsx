import { useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { PublishedScoreEvent } from '@/domain/score-breakdown/types'

type TribeChip = { name: string; colorName?: string | null }

type LineScore = {
  castaway_id: string | null
  episode_number: number | null
  points_total: number | null
  is_mvp_bonus: boolean | null
  revision: number | null
  roster_entry_id: string | null
  member_id: string | null
}

type CastawayPointsBreakdownDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  photoUrl?: string | null
  tribe?: TribeChip | null
  seasonTotal: number
  castawayId: string
  memberId: string
  rosterEntryId: string
  lineScores: LineScore[]
  scoreEvents: PublishedScoreEvent[]
  latestEpisode: number | null
}

export function CastawayPointsBreakdownDialog({
  open,
  onOpenChange,
  name,
  photoUrl,
  tribe,
  seasonTotal,
  castawayId,
  memberId,
  rosterEntryId,
  lineScores,
  scoreEvents,
  latestEpisode,
}: CastawayPointsBreakdownDialogProps) {
  const episodes = useMemo(() => {
    const byEpisode = new Map<
      number,
      {
        episodeNumber: number
        points: number
        mvpBonus: number
        revision: number
        events: PublishedScoreEvent[]
      }
    >()

    for (const line of lineScores) {
      if (line.member_id !== memberId || line.episode_number == null) continue
      const isOwnLine =
        line.roster_entry_id === rosterEntryId ||
        (line.is_mvp_bonus && line.castaway_id === castawayId)
      if (!isOwnLine) continue

      const current = byEpisode.get(line.episode_number) ?? {
        episodeNumber: line.episode_number,
        points: 0,
        mvpBonus: 0,
        revision: line.revision ?? 1,
        events: [],
      }
      if (line.is_mvp_bonus) {
        current.mvpBonus += line.points_total ?? 0
      } else if (line.castaway_id === castawayId) {
        current.points += line.points_total ?? 0
        current.revision = line.revision ?? current.revision
      }
      byEpisode.set(line.episode_number, current)
    }

    for (const event of scoreEvents) {
      if (event.castaway_id !== castawayId || event.episode_number == null) continue
      const current = byEpisode.get(event.episode_number) ?? {
        episodeNumber: event.episode_number,
        points: event.points_total ?? 0,
        mvpBonus: 0,
        revision: event.revision ?? 1,
        events: [],
      }
      current.events.push(event)
      byEpisode.set(event.episode_number, current)
    }

    return [...byEpisode.values()].sort((a, b) => b.episodeNumber - a.episodeNumber)
  }, [castawayId, lineScores, memberId, rosterEntryId, scoreEvents])

  const defaultOpen =
    latestEpisode != null
      ? [`ep-${latestEpisode}`]
      : episodes[0]
        ? [`ep-${episodes[0].episodeNumber}`]
        : []

  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-muted">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt=""
                  className="size-full origin-top scale-125 object-cover object-top"
                />
              ) : (
                <span className="flex size-full items-center justify-center font-display text-lg text-muted-foreground">
                  {initial}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate normal-case">{name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                {tribe?.name ? <span>{tribe.name}</span> : null}
                <span className="tabular-nums">
                  Season total · {seasonTotal} pts
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 pr-3">
          {episodes.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No published episode scores for this castaway yet.
            </p>
          ) : (
            <Accordion
              key={`${castawayId}-${defaultOpen.join(',')}`}
              type="multiple"
              defaultValue={defaultOpen}
              className="w-full"
            >
              {episodes.map((episode) => {
                const episodeTotal = episode.points + episode.mvpBonus
                return (
                  <AccordionItem key={episode.episodeNumber} value={`ep-${episode.episodeNumber}`}>
                    <AccordionTrigger>
                      <span className="flex w-full items-center justify-between gap-3 pr-2">
                        <span>
                          Episode {episode.episodeNumber}
                          {episode.revision > 1 ? (
                            <span className="ml-2 text-xs text-muted-foreground">Corrected</span>
                          ) : null}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {episodeTotal} pts
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1.5">
                        {episode.events.length > 0 ? (
                          episode.events.map((event, index) => (
                            <li
                              key={`${event.scoring_rule_id}-${index}`}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <span className="text-foreground/90">
                                {event.rule_label ?? event.rule_code ?? 'Score line'}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {(event.points ?? 0) > 0 ? '+' : ''}
                                {event.points ?? 0}
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-muted-foreground">
                            Breakdown not available yet.
                          </li>
                        )}
                        {episode.mvpBonus > 0 ? (
                          <li className="flex items-start justify-between gap-3 text-sm">
                            <span>MVP bonus</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              +{episode.mvpBonus}
                            </span>
                          </li>
                        ) : null}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

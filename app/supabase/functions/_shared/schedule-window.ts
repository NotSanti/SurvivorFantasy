export const TORONTO_TIME_ZONE = 'America/Toronto'

export type ResultsWindowKind = 'primary' | 'friday_fallback' | 'outside'

export type TorontoClock = {
  weekday: string
  hour: number
  minute: number
}

export function torontoClock(at: Date, timeZone = TORONTO_TIME_ZONE): TorontoClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  )
  return {
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

export function classifyResultsWindow(at: Date, timeZone = TORONTO_TIME_ZONE): ResultsWindowKind {
  const { weekday, hour, minute } = torontoClock(at, timeZone)
  const minutes = hour * 60 + minute
  if (weekday === 'Thu' && minutes >= 18 * 60) return 'primary'
  if (weekday === 'Fri' && minutes <= 5 * 60 + 59) return 'primary'
  if (weekday === 'Fri' && minutes >= 12 * 60 && minutes <= 17 * 60 + 59) return 'friday_fallback'
  return 'outside'
}

export function isInResultsWindow(at: Date, timeZone = TORONTO_TIME_ZONE): boolean {
  return classifyResultsWindow(at, timeZone) !== 'outside'
}

import type { PushPayload } from '@/domain/push-payload'

export function lockScreenScoreCopy(
  episodeNumber: number,
  kind: 'published' | 'correction',
): Pick<PushPayload, 'title' | 'body'> {
  if (kind === 'correction') {
    return {
      title: `Episode ${episodeNumber} totals were updated`,
      body: 'Open Kindling to see your tribe score.',
    }
  }
  return {
    title: `Episode ${episodeNumber} scores are in`,
    body: 'Open Kindling to see your tribe score.',
  }
}

export function lockScreenMergeCopy(): Pick<PushPayload, 'title' | 'body'> {
  return {
    title: 'Merge window is open',
    body: 'Your one add or swap starts next episode.',
  }
}

export function lockScreenDraftCopy(): Pick<PushPayload, 'title' | 'body'> {
  return {
    title: 'Draft Room is waiting',
    body: 'Finish picks, wildcard, and MVP before lock.',
  }
}

export function lockScreenReminderCopy(): Pick<PushPayload, 'title' | 'body'> {
  return {
    title: 'Kindling weekly check-in',
    body: 'Scores and standings are ready when you are.',
  }
}

export function pushPayloadForOutbox(input: {
  eventType: string
  payload: Record<string, unknown>
}): PushPayload {
  const episodeNumber =
    typeof input.payload.episode_number === 'number' ? input.payload.episode_number : null
  const route =
    typeof input.payload.route === 'string' && input.payload.route.startsWith('/')
      ? input.payload.route
      : defaultRoute(input.eventType)

  if (input.eventType === 'score_corrections' && episodeNumber != null) {
    return { ...lockScreenScoreCopy(episodeNumber, 'correction'), url: route, tag: input.eventType }
  }
  if ((input.eventType === 'scores_published' || input.eventType === 'scores') && episodeNumber != null) {
    return { ...lockScreenScoreCopy(episodeNumber, 'published'), url: route, tag: input.eventType }
  }
  if (input.eventType === 'merge_window') {
    return { ...lockScreenMergeCopy(), url: route, tag: input.eventType }
  }
  if (input.eventType === 'draft_deadlines') {
    return { ...lockScreenDraftCopy(), url: route, tag: input.eventType }
  }
  if (input.eventType === 'weekly_reminder') {
    return { ...lockScreenReminderCopy(), url: route, tag: input.eventType }
  }
  return {
    title: 'Kindling update',
    body: 'Open Kindling for the latest from your camp.',
    url: route,
    tag: input.eventType,
  }
}

function defaultRoute(eventType: string) {
  if (eventType === 'merge_window') return '/league/merge'
  if (eventType === 'draft_deadlines') return '/leagues'
  if (eventType === 'weekly_reminder') return '/standings'
  return '/standings'
}

import type { PushPayload } from '@/domain/push-payload'

/** Legacy product name still present in older outbox rows / DB copy. */
export function brandPushCopy(text: string) {
  return text.replaceAll(/Kindling/gi, 'SFL')
}

export function lockScreenScoreCopy(
  episodeNumber: number,
  kind: 'published' | 'correction',
): Pick<PushPayload, 'title' | 'body'> {
  if (kind === 'correction') {
    return {
      title: `Episode ${episodeNumber} totals were updated`,
      body: 'Open SFL to see your tribe score.',
    }
  }
  return {
    title: `Episode ${episodeNumber} scores are in`,
    body: 'Open SFL to see your tribe score.',
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
    title: "It's your turn to pick",
    body: "Open the draft room and choose from this round's tribe.",
  }
}

export function lockScreenReminderCopy(): Pick<PushPayload, 'title' | 'body'> {
  return {
    title: 'SFL weekly check-in',
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
  if (input.eventType === 'draft_deadlines' || input.eventType === 'draft_turn') {
    return { ...lockScreenDraftCopy(), url: route, tag: input.eventType }
  }
  if (input.eventType === 'weekly_reminder') {
    return { ...lockScreenReminderCopy(), url: route, tag: input.eventType }
  }
  if (typeof input.payload.title === 'string' && typeof input.payload.body === 'string') {
    return {
      title: brandPushCopy(input.payload.title),
      body: brandPushCopy(input.payload.body),
      url: route,
      tag: input.eventType,
    }
  }
  return {
    title: 'SFL update',
    body: 'Open SFL for the latest from your camp.',
    url: route,
    tag: input.eventType,
  }
}

function defaultRoute(eventType: string) {
  if (eventType === 'merge_window') return '/league/merge'
  if (eventType === 'draft_deadlines' || eventType === 'draft_turn') return '/leagues'
  if (eventType === 'weekly_reminder') return '/standings'
  return '/standings'
}

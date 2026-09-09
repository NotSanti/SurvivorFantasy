import type { Database } from '@/types/database'

export type LeagueStatus = Database['public']['Enums']['league_status']

export type NextAction = {
  title: string
  description: string
  to: string
  label: string
}

export function leagueNextAction(input: {
  leagueId: string
  status: LeagueStatus
  hasPublishedScores: boolean
  latestEpisode: number | null
}): NextAction {
  if (input.status === 'recruiting') {
    return {
      title: 'Lobby is open',
      description: 'Share an invite and mark ready when your camp is set.',
      to: `/leagues/${input.leagueId}`,
      label: 'Open lobby',
    }
  }
  if (input.status === 'selecting') {
    return {
      title: 'Draft Room is open',
      description: 'Finish eight picks, the wildcard, and MVP before lock.',
      to: `/leagues/${input.leagueId}/draft`,
      label: 'Open draft room',
    }
  }
  if (input.status === 'merge_window') {
    return {
      title: 'Merge window is open',
      description: 'Add or swap one eligible castaway. The choice starts next episode.',
      to: '/league/merge',
      label: 'Make merge move',
    }
  }
  if (input.status === 'archived') {
    return {
      title: 'This league is archived',
      description: 'Switch leagues from the Kindling header.',
      to: '/leagues',
      label: 'All leagues',
    }
  }
  if (!input.hasPublishedScores) {
    return {
      title: 'Waiting on scores',
      description: 'Standings appear after the first scored episode is imported.',
      to: '/standings',
      label: 'View standings',
    }
  }
  return {
    title: `Episode ${input.latestEpisode ?? ''} is in`,
    description: 'See who scored on your tribe this week.',
    to: `/league/episodes/${input.latestEpisode}`,
    label: 'Episode details',
  }
}

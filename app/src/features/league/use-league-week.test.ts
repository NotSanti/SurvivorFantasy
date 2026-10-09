import { describe, expect, it } from 'vitest'
import { leagueWeekIncludes } from './use-league-week'

describe('league week views', () => {
  it('keeps standings, scores, and rules off the tribe read set', () => {
    expect(leagueWeekIncludes('tribe', 'roster')).toBe(true)
    expect(leagueWeekIncludes('tribe', 'published')).toBe(false)
    expect(leagueWeekIncludes('tribe', 'members')).toBe(false)
    expect(leagueWeekIncludes('standings', 'published')).toBe(true)
    expect(leagueWeekIncludes('standings', 'roster')).toBe(false)
    expect(leagueWeekIncludes('rules', 'rules')).toBe(true)
    expect(leagueWeekIncludes('rules', 'episodes')).toBe(false)
    expect(leagueWeekIncludes('episode', 'lineScores')).toBe(true)
    expect(leagueWeekIncludes('home', 'episodeScores')).toBe(true)
    expect(leagueWeekIncludes('merge', 'rules')).toBe(true)
  })
})

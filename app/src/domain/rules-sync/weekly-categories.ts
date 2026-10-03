export type WeeklyCategoryGroup = {
  points: 5 | 10 | 15
  title: string
  items: string[]
}

/** Global Fantasy Tribe weekly bonus categories (Season 51). */
export const WEEKLY_CATEGORY_NOTE =
  'Earn additional weekly bonus points if any of your Fantasy Tribe castaways do any of the following visibly on screen. Limited to one line per castaway per week. Excludes recaps of past episodes and “next time on” sneak previews.'

export const WEEKLY_CATEGORY_GROUPS: WeeklyCategoryGroup[] = [
  {
    points: 5,
    title: 'Five point categories',
    items: [
      'Wins a group Immunity Challenge',
      'Wins a group Reward Challenge',
      'Gets chosen to go on reward',
      'Finds or gets a game advantage',
      'Plays a hidden immunity idol on themselves at Tribal Council',
      'Uses a game advantage at Tribal Council',
      'Visually cries with tears on camera',
      'Says a curse word that is bleeped/censored',
      'Says, “I miss…”',
      'Kisses another player still in the game',
      'Gets into a heated argument and shouts at another player',
      'Has a wardrobe malfunction/shows nudity that is blurred on screen',
      'Chooses to risk their vote',
      'Finds a fake immunity idol',
      'Hugs Jeff',
      'Buys something with fire tokens',
    ],
  },
  {
    points: 10,
    title: 'Ten point categories',
    items: [
      'Wins an individual Reward Challenge',
      'Finds a hidden immunity idol',
      'Voted out while in possession of a hidden immunity idol or game advantage',
      'Plays their Shot in the Dark',
      'Torch gets snuffed as a result of a blindside',
      'Gets treated for a medical emergency',
      'Chooses to forfeit the game',
      'Catches seafood or wildlife',
      'Tampers with or steals the tribe’s food',
      'Plays a fake immunity idol at Tribal Council',
      'Searches through someone else’s bag',
      'Voted out unanimously',
      'A hidden immunity idol is played on them by another player',
      'Is chosen to flip the “million-dollar coin”',
      'Is chosen to go on a journey or sent to Exile Island',
    ],
  },
  {
    points: 15,
    title: 'Fifteen point categories',
    items: [
      'Wins an individual Immunity Challenge',
      'Draws a SAFE scroll as a result of playing their Shot in the Dark',
      'Wins a fire-making challenge',
      'Gives an immunity idol/necklace away or plays it for another player',
      'Creates a fake immunity idol',
      'Successfully gets another player to play their fake idol at Tribal Council',
      'Is forced to leave the game by no choice of their own (asides from being voted off)',
      'Returns to the game after being voted off/eliminated',
      'Successfully flips the “million-dollar” coin and isn’t eliminated',
    ],
  },
]

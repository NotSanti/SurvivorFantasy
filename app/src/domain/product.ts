export const PRODUCT_NAME = 'SFL'
export const PRODUCT_SHORT_NAME = 'SFL'
/** Injected from package.json at build time. */
export const APP_VERSION = __APP_VERSION__

export const NAV_ITEMS = [
  { to: '/league', label: 'League', id: 'league' },
  { to: '/tribe', label: 'Tribe', id: 'tribe' },
  { to: '/standings', label: 'Standings', id: 'standings' },
  { to: '/activity', label: 'Activity', id: 'activity' },
] as const

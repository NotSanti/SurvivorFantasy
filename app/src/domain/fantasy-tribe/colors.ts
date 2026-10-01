export const FANTASY_TRIBE_COLORS = [
  { id: 'ember', label: 'Ember', swatch: 'oklch(0.72 0.17 48)' },
  { id: 'flame', label: 'Flame', swatch: 'oklch(0.7 0.19 40)' },
  { id: 'clay', label: 'Clay', swatch: 'oklch(0.62 0.12 45)' },
  { id: 'sand', label: 'Sand', swatch: 'oklch(0.82 0.06 85)' },
  { id: 'gold', label: 'Gold', swatch: 'oklch(0.84 0.13 90)' },
  { id: 'moss', label: 'Ash', swatch: 'oklch(0.62 0.015 50)' },
  { id: 'jungle', label: 'Charcoal', swatch: 'oklch(0.42 0.015 42)' },
  { id: 'palm', label: 'Smoke', swatch: 'oklch(0.72 0.02 55)' },
  { id: 'lagoon', label: 'Torch', swatch: 'oklch(0.78 0.16 55)' },
  { id: 'ocean', label: 'Coal', swatch: 'oklch(0.32 0.02 40)' },
  { id: 'dusk', label: 'Dusk', swatch: 'oklch(0.58 0.12 295)' },
  { id: 'violet', label: 'Violet', swatch: 'oklch(0.64 0.16 305)' },
  { id: 'orchid', label: 'Orchid', swatch: 'oklch(0.68 0.14 320)' },
  { id: 'coral', label: 'Coral', swatch: 'oklch(0.7 0.15 30)' },
  { id: 'crimson', label: 'Crimson', swatch: 'oklch(0.58 0.18 28)' },
  { id: 'blood', label: 'Blood', swatch: 'oklch(0.45 0.14 28)' },
  { id: 'smoke', label: 'Bone ash', swatch: 'oklch(0.78 0.02 70)' },
  { id: 'bone', label: 'Bone', swatch: 'oklch(0.9 0.02 80)' },
  { id: 'torchwood', label: 'Torchwood', swatch: 'oklch(0.48 0.08 48)' },
  { id: 'sunrise', label: 'Yellow', swatch: 'oklch(0.86 0.14 95)' },
] as const

export type FantasyTribeColorId = (typeof FANTASY_TRIBE_COLORS)[number]['id']

export const DEFAULT_FANTASY_TRIBE_COLOR: FantasyTribeColorId = 'ember'
export const DEFAULT_FANTASY_TRIBE_NAME = 'My Tribe'

export function isFantasyTribeColorId(value: string | null | undefined): value is FantasyTribeColorId {
  return FANTASY_TRIBE_COLORS.some((color) => color.id === value)
}

export function fantasyTribeColorSwatch(id: string | null | undefined): string {
  const match = FANTASY_TRIBE_COLORS.find((color) => color.id === id)
  return match?.swatch ?? FANTASY_TRIBE_COLORS[0].swatch
}

export function resolveFantasyTribeName(name: string | null | undefined): string {
  const cleaned = name?.trim()
  return cleaned && cleaned.length >= 2 ? cleaned : DEFAULT_FANTASY_TRIBE_NAME
}

export function resolveFantasyTribeColorId(
  color: string | null | undefined,
): FantasyTribeColorId {
  return isFantasyTribeColorId(color) ? color : DEFAULT_FANTASY_TRIBE_COLOR
}

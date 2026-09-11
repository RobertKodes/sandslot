/** Named bench palette — six dyes, no extras. */
export const PALETTE = {
  soot: '#161310',
  vellum: '#E4D5B8',
  ochre: '#C4893A',
  celeste: '#6E9AA3',
  brass: '#A9844A',
  oxide: '#5C3A28',
} as const

export type PaletteName = keyof typeof PALETTE

export const FAMILY_TINT: Record<string, string> = {
  SYS: PALETTE.ochre,
  JUP: PALETTE.brass,
  RAY: '#B45A32',
  TKN: PALETTE.vellum,
  STK: PALETTE.celeste,
  '???': '#6B6358',
}

/** RAY rust sits between ochre and oxide — not a seventh brand color. */
export const RAY_RUST = '#B45A32'
export const UNKNOWN_ASH = '#6B6358'

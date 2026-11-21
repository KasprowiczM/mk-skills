// Terminal layout and the one bar every part of the mod draws, kept apart so they can be tested without drawing.

/** The bar of the Cache mod: 10 emoji cells, a filled part in one colour, the rest white. */
export const BAR_CELLS = 10
export type BarColor = 'success' | 'warning' | 'error'
/**
 * How the fraction turns into a colour, the Cache rule (green above 0.5 left, yellow above 0.2, red below) adapted to the use:
 * 'left' a resource running out, the fraction is what is left; 'used' a consumption, the fraction is what is used (green
 * under 50%, yellow under 80%, red from 80%); 'done' a completion (yellow up to half, green above half and when complete,
 * never red); 'failed' work that stopped (red).
 */
export type BarMode = 'left' | 'used' | 'done' | 'failed'
export type CacheStyleBar = { filled: number; empty: number; color: BarColor; text: string }

export const BLOCK: Record<BarColor, string> = { success: '🟩', warning: '🟨', error: '🟥' }
const EMPTY = '⬜'

export function barColor(fraction: number, mode: BarMode): BarColor {
  const f = Math.min(1, Math.max(0, fraction))
  if (mode === 'failed') return 'error'
  if (mode === 'done') return f > 0.5 ? 'success' : 'warning'
  const left = mode === 'used' ? 1 - f : f
  return left > 0.5 ? 'success' : left > 0.2 ? 'warning' : 'error'
}

/** Cells for a fraction: rounded, at least one when anything is there. */
export function barFilled(fraction: number, width = BAR_CELLS): number {
  const f = Math.min(1, Math.max(0, fraction))
  return f > 0 ? Math.min(width, Math.max(1, Math.round(f * width))) : 0
}

/**
 * The bar as text, "🟩🟩🟩⬜⬜…": the same look in the status line, the band and the pane. Add the label yourself.
 * `tick` (the mod's animation counter) animates the tip while the work is not over (fraction under 1): the last filled
 * cell, or the first one when nothing is filled yet, blinks between its colour block and ⬜ on odd ticks. A bar given no
 * tick, and a complete one, is static.
 */
export function cacheStyleBar(fraction: number, mode: BarMode = 'left', width = BAR_CELLS, tick?: number): CacheStyleBar {
  const filled = barFilled(fraction, width)
  const color = barColor(fraction, mode)
  const cells = Array.from({ length: width }, (_, i) => (i < filled ? BLOCK[color] : EMPTY))
  if (tick !== undefined && fraction < 1 && width > 0 && tick % 2 !== 0) cells[Math.max(0, filled - 1)] = EMPTY
  else if (tick !== undefined && fraction < 1 && width > 0 && filled === 0) cells[0] = BLOCK[color]
  return { filled, empty: width - filled, color, text: cells.join('') }
}

export type BandLayout = {
  /** Width of the title; 0 when it does not fit. */
  titleW: number
  /** Cells of the emoji bar (each 2 columns wide), up to 10; 0 when even the smallest does not fit. */
  barW: number
  showTitle: boolean
  showPct: boolean
}

const MIN_BAR = 3 // cells
// Columns kept free so a terminal that counts a wide glyph twice never wraps the row.
const SLACK = 3

/**
 * Fits one row of dot, title, bar, "Tasks 2/4", percent and the ✕ button, each a column apart,
 * into `w` columns. Narrow rows lose the percent first, then the title; the count and the bar stay.
 */
export function bandLayout(w: number, titleLen: number, labelLen: number, pctLen: number): BandLayout {
  const tries: [boolean, boolean][] = [
    [true, true],
    [true, false],
    [false, false],
  ]
  for (const [showTitle, showPct] of tries) {
    const parts = 4 + (showTitle ? 1 : 0) + (showPct ? 1 : 0) // dot, bar, count, ✕, then title and percent
    const titleW = showTitle ? Math.max(6, Math.min(28, titleLen, Math.floor(w / 3))) : 0
    const used = 2 + labelLen + (showPct ? pctLen : 0) + (parts - 1) + titleW
    // Emoji are 2 columns wide. The slack is given up before the bar shrinks below its minimum.
    const cells = (slack: number) => Math.min(BAR_CELLS, Math.floor((w - used - slack) / 2))
    const barW = cells(SLACK) >= MIN_BAR ? cells(SLACK) : cells(1)
    if (barW >= MIN_BAR) return { titleW, barW, showTitle, showPct }
  }
  return { titleW: 0, barW: 0, showTitle: false, showPct: false }
}

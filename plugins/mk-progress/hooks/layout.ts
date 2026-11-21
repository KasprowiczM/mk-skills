// Terminal layout of the task bar, kept apart so it can be tested without drawing.

export type BandLayout = {
  /** Width of the title; 0 when it does not fit. */
  titleW: number
  /** Width of the block bar; 0 when even the smallest does not fit. */
  barW: number
  showTitle: boolean
  showPct: boolean
}

const MIN_BAR = 6
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
    // The slack is given up, down to one column, before the bar shrinks below its minimum.
    if (w - used - 1 >= MIN_BAR) return { titleW, barW: Math.max(MIN_BAR, w - used - SLACK), showTitle, showPct }
  }
  return { titleW: 0, barW: 0, showTitle: false, showPct: false }
}

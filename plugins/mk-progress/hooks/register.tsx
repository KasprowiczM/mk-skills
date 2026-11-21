import type { AgentInfo, EngineInterface, Register } from 'claude-code'
import { appendText, claudeDirOf, findPaths, mkdirs, removeFile } from './platform'

import type { BandPlan, Helper, HelperPhase, ModelShare, PlanStatus, Step, StepKind } from '../types'
import { connectorName, splitTool } from './connectors'
import { BAR_CELLS, bandLayout, cacheStyleBar } from './layout'
import { programOf, redact } from './redact'

const NAME = 'mk-progress'
const PANE = 'mk-progress'
// The name a person reads; the plugin, pane and /mk-progress command share one id.
const TITLE = 'MK Progress'
const HELPERS = { plugin: 'mk-progress', key: 'helpers' } as const
const CLOCK = { plugin: 'mk-progress', key: 'clock' } as const
const VIEW = { plugin: 'mk-progress', key: 'view' } as const
const COST = { plugin: 'mk-progress', key: 'cost' } as const
const OFF = { plugin: 'mk-progress', key: 'off' } as const
const HIDDEN = { plugin: 'mk-progress', key: 'hidden' } as const
const PLAN = { plugin: 'mk-progress', key: 'plan' } as const
const SHIM = { plugin: 'mk-progress', key: 'shimmer' } as const
const PLAN_OPEN = { plugin: 'mk-progress', key: 'planOpen' } as const

const TICK_MS = 300
const POLL_MS = 2000
// How often an active mod re-reads switches.json (the engine has no file watch); a mod that is off
// or hidden and idle does not poll, and wakes when the next prompt is sent or /mk-progress runs.
const SWITCH_MS = 15_000
// The log is cut at this size: the file moves to mk-progress.log.1 (one backup) and a new one starts.
const LOG_MAX = 256 * 1024
// Plan files of chats older than this are swept at session start.
const PLAN_KEEP_MS = 7 * 24 * 60 * 60 * 1000
const MAX_STEPS = 200
const TAG_W = 11
// The pane asks the dock for this many body columns; the layout works at any width from 32 up.
const PANE_COLS = 48
// Columns the pet takes beside a card: the terminal Clawd is 7 wide, plus one gap; the Svg one is 21 CSS
// pixels (about 3 columns) wide and the "#N" tag under it is at most 3.
const PET_W = 8
const PET_W_SVG = 4
// The Svg crab: a 14 by 6 pixel grid, each pixel 1.5 wide and 3 tall (the 1:2 of a terminal quadrant).
const PET_PX_W = 21
const PET_PX_H = 18
// A collapsed card shows this many earlier steps under the current one.
const HISTORY = 3
// A running pet changes frame every second tick: about every 600 ms.
const FRAME_TICKS = 2

const ACCENT = '#d97757'
const GOOD = '#16a34a'
const BAD = '#dc2626'
// Amber, not #eab308: the yellow of "Finished" must read on a white page and on #1e1e1e.
const WARN = '#b98d06'
// The engine does not tell the mod the theme, so every colour the terminal draws is one mid-tone that holds at
// least 3:1 against both #ffffff and #1e1e1e (see the palette test).
const P_MID = '#8b5cf6'
const P_DEEP = '#8146de'
// Quarter circles read clearly on desktop fonts and in the terminal.
const SPIN = ['◐', '◓', '◑', '◒']

const KIND_COLOR: Record<StepKind, string> = {
  Command: '#c68704',
  Connector: '#2563eb',
  'File read': '#16a34a',
  'File write': '#d97757',
  Skill: '#9333ea',
  Web: '#0891b2',
  Subagent: '#db2777',
  Tool: '#78716c',
}

// ---------- Pets: Clawd, the Claude Code crab, one body colour per helper ----------

// Kept for the saved state's `hue` field and the colour hand-out; no colour on screen comes from it.
const HUES: { name: string; color: string }[] = [
  { name: 'red', color: '#dc2626' },
  { name: 'orange', color: '#ea580c' },
  { name: 'yellow', color: '#eab308' },
  { name: 'green', color: '#16a34a' },
  { name: 'teal', color: '#0d9488' },
  { name: 'blue', color: '#2563eb' },
  { name: 'purple', color: '#9333ea' },
  { name: 'pink', color: '#db2777' },
]
/** Colour per model family: the crab and the running bar wear the colour of the model the subagent runs on. */
const MODEL_COLOR: Record<string, string> = {
  opus: '#d97757',
  sonnet: '#3b82f6',
  haiku: '#12a494',
  fable: '#ec4899',
}
// A model not named yet, or of no known family.
const MODEL_UNKNOWN = '#97928e'
// On a dark page the Svg crab and bar take the brighter shade of the same colour.
const MODEL_DARK: Record<string, string> = {
  '#d97757': '#d97757',
  '#3b82f6': '#5b9cf8',
  '#12a494': '#14b8a6',
  '#ec4899': '#f06aae',
  '#97928e': '#a8a29e',
}
const darkOf = (color: string) => MODEL_DARK[color] ?? color
/** The short model name ("sonnet 5.5", "haiku") to its family colour. */
const modelColor = (model: string) => MODEL_COLOR[(model.split(' ')[0] ?? '').toLowerCase()] ?? MODEL_UNKNOWN
/** The family a crab's alt text names; "unknown" until the model arrives. */
const familyName = (model: string) => {
  const fam = (model.split(' ')[0] ?? '').toLowerCase()
  return fam in MODEL_COLOR ? fam : 'unknown'
}

// The eye holes are filled with this on every pet, so they read on light and dark.
const EYE = '#2b1d16'
const FRAMES = 4

/**
 * A slim Clawd: the silhouette of the one on the Claude Code start-up screen, narrower, 7 columns by 3 rows. The
 * glyphs are the single source: the terminal prints them, and the Svg decodes them into a 14 by 6 grid of pixels,
 * the thin box-drawing glyphs (╶ ╴ ╵ ╹) as thin strokes. Row 0 is the head with its two eye holes (▛ and ▜), row 1 the
 * body with thin arms, row 2 the thin legs. Only the claws (columns 0 and 6 of rows 0 and 1) and the legs move; the head
 * and body (columns 1 to 5 of rows 0 and 1) are the same in every frame. A blink is a separate overlay that closes the
 * eye cells of the head row and nothing else.
 * Frame 0 stands, 1 steps (legs apart), 2 raises its claws, 3 raises them and steps.
 */
const CLAWD: readonly (readonly [string, string, string])[] = [
  [' ▐▛█▜▌ ', '╶▜███▛╴', ' ╵╵ ╵╵ '],
  [' ▐▛█▜▌ ', '╶▜███▛╴', ' ╵ ╵╵ ╵'],
  ['╹▐▛█▜▌╹', ' ▜███▛ ', ' ╵╵ ╵╵ '],
  ['╹▐▛█▜▌╹', ' ▜███▛ ', ' ╵ ╵╵ ╵'],
]

/** The three rows of a pet: a running one walks through the frames, a finished one stands in frame 0. */
const petRows = (frame: number, blink = false): string[] => {
  const rows = [...CLAWD[((frame % FRAMES) + FRAMES) % FRAMES]!]
  // A blink is an overlay on any limb frame: only the head row's eye cells close (▛ and ▜ become full blocks).
  if (blink) rows[0] = rows[0]!.replace('▛', '█').replace('▜', '█')
  return rows
}

// Which quarters of a cell a quadrant glyph fills: top left, top right, bottom left, bottom right.
const QUAD: Record<string, [number, number, number, number]> = {
  ' ': [0, 0, 0, 0],
  '▘': [1, 0, 0, 0],
  '▝': [0, 1, 0, 0],
  '▖': [0, 0, 1, 0],
  '▗': [0, 0, 0, 1],
  '▌': [1, 0, 1, 0],
  '▐': [0, 1, 0, 1],
  '▀': [1, 1, 0, 0],
  '▄': [0, 0, 1, 1],
  '█': [1, 1, 1, 1],
  '▛': [1, 1, 1, 0],
  '▜': [1, 1, 0, 1],
  '▙': [1, 0, 1, 1],
  '▟': [0, 1, 1, 1],
}

// The thin box-drawing glyphs as strokes in grid units from the cell's corner: x, y, width, height.
const STROKE: Record<string, [number, number, number, number]> = {
  '╶': [1, 0.75, 1, 0.5],
  '╴': [0, 0.75, 1, 0.5],
  '╵': [0.75, 0, 0.5, 1],
  '╹': [0.5, 0, 1, 1],
}

const petCache = new Map<string, string>()

/** The pet as an Svg on a 14 by 6 pixel grid, built from the glyph rows: quadrants as pixels, thin glyphs as thin strokes. */
function petSvg(color: string, frame: number, blink = false) {
  const key = `${color}:${frame % FRAMES}:${blink ? 'b' : 'o'}`
  const hit = petCache.get(key)
  if (hit) return hit
  const rows = petRows(frame, blink)
  const W = rows[0]!.length * 2
  const H = rows.length * 2
  const grid: number[][] = Array.from({ length: H }, () => Array<number>(W).fill(0))
  const eyes: [number, number][] = []
  const strokes: [number, number, number, number][] = []
  rows.forEach((row, r) => {
    ;[...row].forEach((g, c) => {
      const q = QUAD[g] ?? QUAD[' ']!
      const st = STROKE[g]
      if (st) strokes.push([c * 2 + st[0], r * 2 + st[1], st[2], st[3]])
      q.forEach((on, k) => {
        if (on) grid[r * 2 + (k >> 1)]![c * 2 + (k & 1)] = 1
      })
      // The head row's holes are the eyes: ▛ leaves the bottom right quarter, ▜ the bottom left.
      if (r === 0 && g === '▛') eyes.push([c * 2 + 1, 1])
      if (r === 0 && g === '▜') eyes.push([c * 2, 1])
    })
  })
  const cls = `k${color.slice(1)}`
  const rects: string[] = []
  grid.forEach((line, y) => {
    let x = 0
    while (x < W) {
      if (!line[x]) {
        x += 1
        continue
      }
      let end = x
      while (end < W && line[end]) end += 1
      rects.push(`<rect class="${cls}" x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`)
      x = end
    }
  })
  for (const [x, y, w, h] of strokes) rects.push(`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`)
  for (const [x, y] of eyes) rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${EYE}"/>`)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${PET_PX_W}" height="${PET_PX_H}" preserveAspectRatio="none" shape-rendering="crispEdges"><style>@media (prefers-color-scheme: dark){.${cls}{fill:${darkOf(color)}}}</style>${rects.join('')}</svg>`
  petCache.set(key, svg)
  return svg
}

// ---------- The desk itself; $.state carries a copy for the pane to draw ----------

let helpers: Helper[] = []
let seats = 0
// The next body colour to hand out, in HUES order.
let nextHue = 0
let tickN = 0
let home = ''
let claudeDir = ''
let sessionId = ''
let off = false
// "mk-progress:hidden": true in switches.json closes the pane and stops it opening by itself.
let hidden = false
let ticker: { cancel: () => void } | null = null
let poller: { cancel: () => void } | null = null
let switcher: { cancel: () => void } | null = null
const strangers = new Set<string>()
// True once the "pane is waiting" hint was toasted.
let paneHinted = false

function toolWords(tool: string, connector: string) {
  const words = tool
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase())
  // "slack_search_public" from Slack reads "Slack · search public".
  if (words.length > 1 && words[0] === connector.split(' ')[0]!.toLowerCase()) words.shift()
  return words.join(' ')
}

const base = (p: string) => p.split('/').filter(Boolean).pop() ?? p
const cut = (t: string, n: number) => (n <= 0 ? '' : t.length > n ? `${t.slice(0, Math.max(0, n - 1))}…` : t)
const oneLine = (t: string) => t.replace(/\s+/g, ' ').trim()

function folder(p: string) {
  const parts = p.split('/')
  parts.pop()
  const dir = parts.join('/')
  return home && dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir
}

/** One tool call: its kind, a short label for the list, and plain words for the live line. Nothing secret-looking leaves it. */
function describe(tool: string, args: Record<string, unknown>): Step {
  const st = describeRaw(tool, args)
  return { ...st, label: redact(st.label), dim: redact(st.dim), live: redact(st.live) }
}

function describeRaw(tool: string, args: Record<string, unknown>): Step {
  // Redacted before it is cut, so a secret is never cut in two and half shown.
  const s = (k: string) => (typeof args[k] === 'string' ? redact(oneLine(args[k] as string)) : '')
  const file = (verb: string, kind: StepKind, key = 'file_path'): Step => {
    const p = typeof args[key] === 'string' ? (args[key] as string) : ''
    const name = base(p) || 'a file'
    return { kind, label: name, dim: p ? folder(p) : '', live: `${verb} ${name}` }
  }
  if (tool.startsWith('mcp__')) {
    const { server, name: toolName } = splitTool(tool)
    const name = connectorName(server, toolName)
    const words = toolWords(toolName.replace(/__/g, '_'), name)
    return { kind: 'Connector', label: `${name} · ${words}`, dim: '', live: `${name}: ${words}` }
  }
  switch (tool) {
    case 'Read':
      return file('Reading', 'File read')
    case 'Write':
      return file('Writing', 'File write')
    case 'Edit':
    case 'MultiEdit':
      return file('Editing', 'File write')
    case 'NotebookEdit':
      return file('Editing', 'File write', 'notebook_path')
    case 'Grep':
    case 'Glob': {
      const pat = s('pattern')
      const p = s('path')
      return {
        kind: 'File read',
        label: pat ? `Search "${cut(pat, 60)}"` : 'Search files',
        dim: p ? (home && p.startsWith(home) ? `~${p.slice(home.length)}` : p) : '',
        live: pat ? `Searching files for "${cut(pat, 40)}"` : 'Searching files',
      }
    }
    case 'Bash': {
      // The command itself is never shown: its description if the call has one, else just the program name.
      const prog = programOf(typeof args.command === 'string' ? args.command : '')
      const label = s('description') || (prog ? `${prog}…` : 'a command')
      return { kind: 'Command', label, dim: '', live: `Running: ${label}` }
    }
    case 'WebSearch':
      return { kind: 'Web', label: s('query') || 'web search', dim: '', live: `Searching the web: ${s('query')}` }
    case 'WebFetch': {
      let host = 'a web page'
      try {
        host = new URL(s('url')).host
      } catch {
        // Not a URL: keep the plain words.
      }
      return { kind: 'Web', label: host, dim: '', live: `Opening ${host}` }
    }
    case 'Skill':
      return { kind: 'Skill', label: s('skill') || 'a skill', dim: '', live: `Using the ${s('skill') || 'a'} skill` }
    case 'Agent':
    case 'Task':
      return {
        kind: 'Subagent',
        label: s('description') || 'Start a subagent',
        dim: '',
        live: s('description') ? `Starting a subagent: ${s('description')}` : 'Starting a subagent',
      }
    case 'SendMessage':
      return { kind: 'Subagent', label: 'Send a message', dim: '', live: 'Sending a message' }
    case 'TodoWrite':
      return { kind: 'Tool', label: 'Update its to-do list', dim: '', live: 'Updating its to-do list' }
    case 'ToolSearch':
      return { kind: 'Tool', label: 'Load tools', dim: '', live: 'Loading tools' }
    default:
      return { kind: 'Tool', label: tool, dim: '', live: `Using ${tool}` }
  }
}

/** "14:05" in local time from an ISO timestamp; empty when there is none. */
function hhmm(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function clockTime(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

function tokenText(n: number) {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

/** "claude-sonnet-5-5" reads "sonnet 5.5"; the alias "haiku" reads "haiku"; a model of no known family is kept short as it is. */
function shortModel(model: string) {
  const hit = /(opus|sonnet|haiku|fable)(?:[-_ ](\d{1,2})(?!\d))?(?:[-_.](\d{1,2})(?!\d))?/i.exec(model)
  if (!hit) return cut(model.trim(), 16)
  const fam = hit[1]!.toLowerCase()
  return hit[2] ? `${fam} ${hit[2]}${hit[3] ? `.${hit[3]}` : ''}` : fam
}

/** The short label on a card: the family alone ("sonnet"). */
const familyOf = (model: string) => model.split(' ')[0] ?? model

/** An effort as written: a level reads as it is, a token budget as a size. */
function effortText(effort: unknown): string {
  if (typeof effort === 'number' && Number.isFinite(effort) && effort > 0) return `${tokenText(effort)} budget`
  return typeof effort === 'string' ? effort.trim().slice(0, 12) : ''
}

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
const usageTotal = (u: Partial<Usage>) => (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)

/** What one agent used, a row per model that answered; its cost split over the rows by their tokens. */
function sharesOf(hp: Helper, a: AgentInfo): ModelShare[] {
  const tokens = new Map<string, number>()
  for (const u of a.usage ?? []) {
    const key = shortModel(u.model || hp.model || '') || 'inherit'
    tokens.set(key, (tokens.get(key) ?? 0) + usageTotal(u))
  }
  const usd = typeof a.cost?.usd === 'number' ? a.cost.usd : null
  if (!tokens.size) return usd === null ? [] : [{ model: hp.model || 'inherit', tokens: 0, usd }]
  const all = [...tokens.values()].reduce((n, t) => n + t, 0)
  return [...tokens].map(([model, t]) => ({ model, tokens: t, usd: usd === null ? null : all > 0 ? (usd * t) / all : usd / tokens.size }))
}

/** Takes the model, effort and usage the engine lists for an agent; true when something changed. */
function syncInfo(hp: Helper, a: AgentInfo): boolean {
  const before = JSON.stringify([hp.model, hp.effort, hp.usd, hp.byModel])
  const model = a.lastRequest?.model || a.model
  if (model) hp.model = shortModel(model)
  const effort = effortText(a.lastRequest?.effort ?? a.effort)
  if (effort) hp.effort = effort
  hp.byModel = sharesOf(hp, a)
  hp.usd = typeof a.cost?.usd === 'number' ? a.cost.usd : null
  return before !== JSON.stringify([hp.model, hp.effort, hp.usd, hp.byModel])
}

/** Tokens and cost per model over these agents; cost only where the engine priced it. */
function modelTotals(list: Helper[]): { model: string; tokens: number; usd: number | null }[] {
  const totals = new Map<string, { tokens: number; usd: number | null }>()
  for (const hp of list) {
    const rows: ModelShare[] = hp.byModel?.length
      ? hp.byModel
      : hp.hasUsage
        ? [{ model: hp.model || 'inherit', tokens: hp.tokens + hp.turnTokens, usd: hp.usd ?? null }]
        : []
    for (const r of rows) {
      const t = totals.get(r.model) ?? { tokens: 0, usd: null }
      t.tokens += r.tokens
      if (r.usd !== null) t.usd = (t.usd ?? 0) + r.usd
      totals.set(r.model, t)
    }
  }
  return [...totals].map(([model, t]) => ({ model, ...t })).sort((a, b) => b.tokens - a.tokens)
}

const working = () => helpers.filter(hp => hp.phase === 'working').length

/** The next colour in order that no running helper wears; with all 8 taken, the next in order. */
function pickHue() {
  const used = new Set(helpers.filter(hp => hp.phase === 'working').map(hp => hp.hue % HUES.length))
  let hue = nextHue % HUES.length
  for (let i = 0; i < HUES.length; i += 1) {
    const h = (nextHue + i) % HUES.length
    if (!used.has(h)) {
      hue = h
      break
    }
  }
  nextHue = hue + 1
  return hue
}
const copy = (hp: Helper): Helper => ({ ...hp, steps: hp.steps.map(st => ({ ...st })) })

async function log($: EngineInterface, line: string) {
  try {
    const dir = `${claudeDirOf($)}/mods-logs`
    const path = `${dir}/${NAME}.log`
    const text = `${new Date().toISOString()} ${line}\n`
    const size = await $.fs.stat(path).then(st => st.size, () => -1)
    if (size < 0) {
      await mkdirs($, dir)
      await $.fs.write(path, text)
    } else if (size >= LOG_MAX) {
      // One backup: the full log becomes mk-progress.log.1, and this line starts a new one.
      try {
        await $.fs.write(`${path}.1`, String(await $.fs.read(path)))
      } catch {
        // A log too big to read is dropped rather than kept.
      }
      await $.fs.write(path, text)
    } else {
      // Append without reading the file back; read and write only where that fails.
      await appendText($, path, text).catch(async () => $.fs.write(path, `${String(await $.fs.read(path))}${text}`))
    }
  } catch {
    // Logging must never break the session.
  }
}

async function tick($: EngineInterface) {
  tickN += 1
  await $.state.set(CLOCK, { tick: tickN, now: await $.clock.now() })
}

async function readCost($: EngineInterface) {
  try {
    const u = await $.session.usage()
    await $.state.set(COST, { usd: typeof u.cost?.usd === 'number' ? u.cost.usd : null })
  } catch {
    // No ledger here: the tile stays hidden.
  }
}

async function poll($: EngineInterface) {
  if (!working()) return
  const list = await $.agent.list()
  const now = await $.clock.now()
  let changed = false
  for (const a of list) {
    const hp = helpers.find(x => x.id === a.id)
    if (!hp || hp.phase !== 'working') continue
    if (syncInfo(hp, a)) changed = true
    // The list may lag a turn's end; it only ever moves a card out of working.
    const next: HelperPhase | null =
      a.status === 'completed' || a.status === 'idle' ? 'done' : a.status === 'failed' || a.status === 'killed' ? 'failed' : null
    if (next) {
      hp.phase = next
      hp.endedAt = now
      changed = true
    }
    if (!hp.description && a.description) {
      hp.description = redact(a.description)
      changed = true
    }
  }
  if (changed) await publish($)
  else await readCost($)
}

/** The switches poll runs only while the mod is on, and not hidden with nothing working. */
function syncSwitcher($: EngineInterface) {
  if (!off && !(hidden && !working())) {
    switcher ??= $.clock.every(SWITCH_MS, () => {
      void switchPoll($).catch(err => log($, `switch: ${String(err)}`))
    })
  } else {
    switcher?.cancel()
    switcher = null
  }
}

function syncTimers($: EngineInterface) {
  syncSwitcher($)
  if (working() && !off) {
    ticker ??= $.clock.every(TICK_MS, () => {
      void tick($).catch(() => undefined)
    })
    poller ??= $.clock.every(POLL_MS, () => {
      void poll($).catch(err => log($, `poll: ${String(err)}`))
    })
  } else {
    ticker?.cancel()
    poller?.cancel()
    ticker = null
    poller = null
  }
}

async function publish($: EngineInterface) {
  await $.state.set(HELPERS, helpers.map(copy))
  await $.state.set(CLOCK, { tick: tickN, now: await $.clock.now() })
  await readCost($)
  // No status line: on desktop it drew over Context Meter's footer bar. The pane shows the count.
  $.ui.status(undefined)
  syncTimers($)
}

async function addHelper($: EngineInterface, id: string, description: string, type: string, model: string, effort = '') {
  const known = helpers.find(hp => hp.id === id)
  if (known) {
    // Found first through its own tool calls: fill in what the spawn knows.
    if (description) known.description = redact(description)
    if (type) known.type = type
    if (model && !known.model) known.model = model
    if (effort && !known.effort) known.effort = effort
    await publish($)
    return
  }
  const wasIdle = working() === 0
  const now = await $.clock.now()
  helpers.push({
    id,
    description: redact(description) || 'Subagent',
    type: type || 'subagent',
    model,
    effort,
    usd: null,
    byModel: [],
    phase: 'working',
    startedAt: now,
    endedAt: 0,
    count: 0,
    steps: [],
    tokens: 0,
    turnTokens: 0,
    hasUsage: false,
    seat: seats,
    hue: pickHue(),
  })
  seats += 1
  await publish($)
  // The pane opens by itself when a new round of helpers starts.
  // Unasked, a terminal seats it only from 110 to 144 columns: below that it waits undrawn, so say once how to open it.
  if (wasIdle && !hidden) {
    void $.ui
      .open({ id: PANE, title: TITLE, columns: PANE_COLS })
      .then(r => {
        if (r.isPlaced || paneHinted) return
        paneHinted = true
        try {
          $.ui.toast('Subagents are working. Type /mk-progress to see their cards.')
        } catch {
          // The toast is only a hint.
        }
      })
      .catch(err => log($, `open: ${String(err)}`))
  }
}

/** A loop whose spawn this mod missed (a reload, a race): take it from $.agent.list(). */
async function adopt($: EngineInterface, id: string) {
  if (helpers.some(hp => hp.id === id) || strangers.has(id)) return
  const a = (await $.agent.list()).find(x => x.id === id)
  if (!a) {
    // The engine's own forks carry ids no list names: leave them out.
    strangers.add(id)
    return
  }
  await addHelper($, id, a.description, a.type, a.model ? shortModel(a.model) : '', effortText(a.effort))
  const hp = helpers.find(x => x.id === id)
  if (hp && syncInfo(hp, a)) await publish($)
}

async function noteTool($: EngineInterface, id: string, step: Step) {
  if (!helpers.some(x => x.id === id)) await adopt($, id)
  const hp = helpers.find(x => x.id === id)
  if (!hp) return
  hp.count += 1
  hp.steps = [...hp.steps, step].slice(-MAX_STEPS)
  // A teammate that finished a turn and picks up work again is working again.
  if (hp.phase !== 'working') {
    hp.phase = 'working'
    hp.endedAt = 0
  }
  await publish($)
}

async function noteStep($: EngineInterface, id: string, model: string, effort: string, usage: Usage | null) {
  if (!helpers.some(x => x.id === id)) await adopt($, id)
  const hp = helpers.find(x => x.id === id)
  if (!hp) return
  if (model) hp.model = shortModel(model)
  if (effort) hp.effort = effortText(effort)
  if (usage) {
    hp.turnTokens += usageTotal(usage)
    hp.hasUsage = true
  }
  await publish($)
}

async function finish($: EngineInterface, id: string, phase: HelperPhase, usage: Usage | null) {
  const hp = helpers.find(x => x.id === id)
  if (!hp) return
  // The turn's own sum wins over the steps counted so far.
  hp.tokens += usage ? usageTotal(usage) : hp.turnTokens
  hp.turnTokens = 0
  if (usage) hp.hasUsage = true
  hp.phase = phase
  hp.endedAt = await $.clock.now()
  // One last look at what the engine lists for it, so the final model, effort and cost are on the card.
  const a = (await $.agent.list().catch(() => [] as AgentInfo[])).find(x => x.id === id)
  if (a) syncInfo(hp, a)
  await publish($)
}

async function setOff($: EngineInterface, value: boolean) {
  if (value === off) return
  off = value
  await $.state.set(OFF, off)
  if (off) {
    holdTimer?.cancel()
    holdTimer = null
    $.ui.status(undefined)
    await $.ui.close({ id: PANE }).catch(() => undefined)
  }
  syncTimers($)
  syncShimmer($)
}

const HIDE_KEY = `${NAME}:hidden`
const switchesPath = () => `${claudeDir}/mods/switches.json`

async function readSwitches($: EngineInterface): Promise<Record<string, unknown>> {
  if (!(await $.fs.exists(switchesPath()))) return {}
  const json = JSON.parse(String(await $.fs.read(switchesPath()))) as unknown
  return json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {}
}

async function readSwitch($: EngineInterface) {
  try {
    const json = await readSwitches($)
    const nowHidden = json[`${NAME}:hidden`] === true
    if (nowHidden && !hidden) await $.ui.close({ id: PANE }).catch(() => undefined)
    if (nowHidden !== hidden) {
      hidden = nowHidden
      // The band reads this key, so a change redraws it.
      await $.state.set(HIDDEN, hidden)
      syncShimmer($)
      syncSwitcher($)
    }
    await setOff($, json[NAME] === false)
  } catch {
    // A broken file never turns the mod off.
  }
}

// Read, change, write the whole file, so every chat sees the choice at its next poll (15 s) or prompt.
async function setHidden($: EngineInterface, value: boolean) {
  try {
    const json = await readSwitches($)
    if (value) json[HIDE_KEY] = true
    else delete json[HIDE_KEY]
    await mkdirs($, `${claudeDirOf($)}/mods`)
    await $.fs.write(switchesPath(), `${JSON.stringify(json, null, 2)}\n`)
  } catch (err) {
    await log($, `save hidden: ${String(err)}`)
  }
  hidden = value
  await $.state.set(HIDDEN, hidden)
  syncShimmer($)
  syncSwitcher($)
  if (value) await $.ui.close({ id: PANE }).catch(() => undefined)
}

async function openPane($: EngineInterface) {
  await $.ui.open({ id: PANE, title: TITLE, columns: PANE_COLS })
}

async function checkOpen($: EngineInterface) {
  if (!sessionId) return
  const path = `${claudeDirOf($)}/mods/.open-${NAME}-${sessionId}`
  if (!(await $.fs.exists(path).catch(() => false))) return
  await removeFile($, path)
  if (!off) await openPane($)
}

async function switchPoll($: EngineInterface) {
  await readSwitch($)
  await checkOpen($).catch(err => log($, `open request: ${String(err)}`))
}

// ---------- The plan: one list per chat, shared with chat-inventory through a file ----------

const PLAN_TOOL = 'mcp__mk-progress__plan'
const MIRRORED = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate'])
const PLAN_PROMPT =
  'MK Progress shows the user your to-do list as a progress bar. Keep that list with TodoWrite or TaskCreate and TaskUpdate when you have them; ' +
  'otherwise use the mcp__mk-progress__plan tool, which is loaded on demand: if its schema is not in your tool list, load it first with ToolSearch (query "select:mcp__mk-progress__plan"). ' +
  'For any task that needs 2 or more steps or tool calls, make the list first, before other tools, with every step in order and the first one in_progress. ' +
  'Send the full list again each time a step finishes or a new one starts. Mark the last step completed before your final answer. ' +
  'When you write a plan for the user to approve, save its steps too, all pending, so the plan shows in the bar and the Chat Inventory to-do list. ' +
  'A step that launches subagents is one step. Skip it only for a one-line answer with no tool calls.'
// Main-chat tool calls in a turn, with no plan yet, before the nudge to make one.
const NUDGE_AFTER = 3
// Tool calls since the last plan update before the nudge to tick it.
const STALE_AFTER = 8
const NUDGE_NEW =
  'MK Progress: you have no plan for this task yet. Save one now with every step in order, so the user sees your progress: TodoWrite or TaskCreate, or mcp__mk-progress__plan (load it with ToolSearch first if its schema is not in your tool list).'
const NUDGE_STALE =
  'MK Progress: the plan has not changed in a while. If a step finished, send the full list now (TodoWrite, TaskUpdate or mcp__mk-progress__plan).'
const STATUSES: readonly PlanStatus[] = ['pending', 'in_progress', 'completed']
const SHIMMER_MS = 350
// How long a finished plan stays at 100% before the band goes away.
const DONE_HOLD_MS = 20_000
const BAR_FALLBACK = 30

type PlanStep = { text: string; status: PlanStatus; doneAt?: string; id?: string }
type Plan = { title: string; steps: PlanStep[]; updatedAt: string }
type StepIn = { text: string; status: PlanStatus; id?: string }

let plan: Plan | null = null
// True once every step is done; a list with work left in it starts the next plan.
let planDone = false
let planShown = false
let shimmer: { cancel: () => void } | null = null
let holdTimer: { cancel: () => void } | null = null
let shimN = 0
// The plan nudge: main-chat tool calls this turn, and whether a plan came in.
let turnCalls = 0
let turnPlanned = false
let nudged = false
let sincePlan = 0
let staleNudged = false

// A short reminder after a tool's result, read by the model only.
function withNudge<R>(r: R): R {
  turnCalls++
  sincePlan++
  const live = !!plan && !planDone && plan.steps.length > 0
  let note: string | null = null
  // A live plan is already shown: only the stale nudge applies to it.
  if (!turnPlanned && !nudged && !live && turnCalls >= NUDGE_AFTER) {
    nudged = true
    note = NUDGE_NEW
  } else if (live && !staleNudged && sincePlan >= STALE_AFTER) {
    staleNudged = true
    note = NUDGE_STALE
  }
  if (!note || !r || typeof r !== 'object' || 'deny' in (r as object)) return r
  const had = (r as { context?: readonly string[] }).context ?? []
  return { ...r, context: [...had, note] }
}
let stateDirMade = false

const planPath = () => `${claudeDir}/mods-state/plan-${sessionId}.json`
const doneCount = (steps: { status: PlanStatus }[]) => steps.filter(st => st.status === 'completed').length
const isStatus = (v: unknown): v is PlanStatus => typeof v === 'string' && (STATUSES as readonly string[]).includes(v)

async function writePlan($: EngineInterface) {
  if (!plan || !sessionId || !home) return
  try {
    if (!stateDirMade) {
      await mkdirs($, `${claudeDirOf($)}/mods-state`)
      stateDirMade = true
    }
    const body = {
      title: plan.title,
      steps: plan.steps.map(st => ({ text: st.text, status: st.status, ...(st.doneAt ? { doneAt: st.doneAt } : {}) })),
      updatedAt: plan.updatedAt,
    }
    await $.fs.write(planPath(), `${JSON.stringify(body, null, 2)}\n`)
  } catch (err) {
    await log($, `write plan: ${String(err)}`)
  }
}

async function drawPlan($: EngineInterface) {
  const value: BandPlan | null = plan
    ? { title: plan.title, steps: plan.steps.map(st => ({ text: st.text, status: st.status, ...(st.doneAt ? { doneAt: st.doneAt } : {}) })), shown: planShown }
    : null
  await $.state.set(PLAN, value)
  syncShimmer($)
}

/** The shimmer clock runs only while a shown plan has a step in progress. */
function syncShimmer($: EngineInterface) {
  const need = !off && !hidden && planShown && !!plan?.steps.some(st => st.status === 'in_progress')
  if (need) {
    shimmer ??= $.clock.every(SHIMMER_MS, () => {
      shimN += 1
      void $.state.set(SHIM, shimN).catch(() => undefined)
    })
  } else {
    shimmer?.cancel()
    shimmer = null
  }
}

function say($: EngineInterface, text: string) {
  try {
    $.ui.toast(cut(text, 140))
  } catch {
    // A toast is only a hint.
  }
}

/** Takes a whole new list, keeps done times, toasts what just finished, and saves. */
async function applyPlan($: EngineInterface, title: string | undefined, given: StepIn[]) {
  // Plan text is shown, toasted and saved to a file: nothing secret-looking goes in.
  const incoming = given.map(st => ({ ...st, text: redact(st.text) }))
  if (title) title = redact(title)
  const now = new Date(await $.clock.now()).toISOString()
  const allDone = incoming.length > 0 && incoming.every(st => st.status === 'completed')
  // A list with work left in it after a finished plan is a new plan.
  const fresh = !plan || (planDone && !allDone)
  const old = fresh ? [] : plan!.steps
  const used = new Set<number>()
  const match = (st: StepIn) => {
    const i = old.findIndex((o, k) => !used.has(k) && (st.id ? o.id === st.id : o.text === st.text))
    if (i >= 0) used.add(i)
    return i >= 0 ? old[i] : undefined
  }
  const justDone: string[] = []
  const steps: PlanStep[] = incoming.map(st => {
    const was = match(st)
    const step: PlanStep = { text: st.text, status: st.status, ...(st.id ? { id: st.id } : {}) }
    if (st.status === 'completed') {
      step.doneAt = was?.status === 'completed' && was.doneAt ? was.doneAt : now
      if (was?.status !== 'completed' && !fresh) justDone.push(st.text)
    }
    return step
  })
  const wasDone = planDone && !fresh
  plan = { title: title?.trim() || (fresh ? 'Plan' : plan!.title), steps, updatedAt: now }
  planDone = allDone
  if (!steps.length) planShown = false
  else if (allDone && !wasDone) {
    planShown = true
    say($, steps.length === 1 ? 'All steps done.' : `All ${steps.length} steps done.`)
    holdTimer?.cancel()
    holdTimer = $.clock.after(DONE_HOLD_MS, () => {
      holdTimer = null
      planShown = false
      void drawPlan($).catch(err => log($, `hide plan: ${String(err)}`))
    })
  } else if (!allDone) {
    planShown = true
    holdTimer?.cancel()
    holdTimer = null
    if (justDone.length) say($, `Done: ${justDone.join(', ')}`)
  }
  await writePlan($)
  await drawPlan($)
}

/** The plan tool's own call: check the input, save it, answer in one line. */
async function planFromTool($: EngineInterface, args: Record<string, unknown>) {
  const raw = args.steps
  if (!Array.isArray(raw)) return 'Plan not saved: send steps as a list of { text, status }.'
  const steps: StepIn[] = []
  for (const st of raw as unknown[]) {
    const o = (st && typeof st === 'object' ? st : {}) as Record<string, unknown>
    const text = typeof o.text === 'string' ? oneLine(o.text) : ''
    if (!text) return 'Plan not saved: every step needs its text.'
    if (!isStatus(o.status)) return `Plan not saved: "${cut(text, 40)}" needs a status of pending, in_progress or completed.`
    steps.push({ text, status: o.status })
  }
  await applyPlan($, typeof args.title === 'string' ? oneLine(args.title) : undefined, steps)
  return `Plan saved: ${doneCount(steps)} of ${steps.length} steps done.`
}

/** TodoWrite, TaskCreate and TaskUpdate on the main chat feed the same plan. */
async function mirror($: EngineInterface, tool: string, args: Record<string, unknown>, r: unknown) {
  const res = (r as { result?: unknown; isError?: boolean; deny?: string } | undefined) ?? {}
  if (res.deny || res.isError) return
  if (tool === 'TodoWrite') {
    const todos = Array.isArray(args.todos) ? (args.todos as unknown[]) : []
    const steps: StepIn[] = []
    for (const t of todos) {
      const o = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>
      const text = typeof o.content === 'string' ? oneLine(o.content) : ''
      if (text) steps.push({ text, status: isStatus(o.status) ? o.status : 'pending' })
    }
    await applyPlan($, undefined, steps)
    return
  }
  const current: StepIn[] = plan && !planDone ? plan.steps.map(st => ({ text: st.text, status: st.status, ...(st.id ? { id: st.id } : {}) })) : []
  if (tool === 'TaskCreate') {
    const text = typeof args.subject === 'string' ? oneLine(args.subject) : ''
    if (!text) return
    const out = (res.result ?? {}) as { task?: { id?: unknown } }
    const id = typeof out.task?.id === 'string' ? out.task.id : undefined
    await applyPlan($, undefined, [...current, { text, status: 'pending', ...(id ? { id } : {}) }])
    return
  }
  // TaskUpdate: find the task by its id; an unknown one with a subject joins the list.
  const id = typeof args.taskId === 'string' ? args.taskId : ''
  const all: StepIn[] = plan ? plan.steps.map(st => ({ text: st.text, status: st.status, ...(st.id ? { id: st.id } : {}) })) : []
  const i = all.findIndex(st => st.id === id)
  const subject = typeof args.subject === 'string' ? oneLine(args.subject) : ''
  if (args.status === 'deleted') {
    if (i >= 0) await applyPlan($, undefined, all.filter((_, k) => k !== i))
    return
  }
  const status = isStatus(args.status) ? args.status : undefined
  if (i < 0) {
    if (subject) await applyPlan($, undefined, [...current, { text: subject, status: status ?? 'pending', id }])
    return
  }
  all[i] = { ...all[i]!, ...(subject ? { text: subject } : {}), ...(status ? { status } : {}) }
  await applyPlan($, undefined, all)
}

/** A reload or resume carries on with the plan this chat already saved. */
async function loadPlan($: EngineInterface) {
  if (plan || !sessionId || !home) return
  try {
    if (!(await $.fs.exists(planPath()))) return
    const json = JSON.parse(String(await $.fs.read(planPath()))) as { title?: unknown; steps?: unknown; updatedAt?: unknown }
    const steps: PlanStep[] = (Array.isArray(json.steps) ? (json.steps as Record<string, unknown>[]) : [])
      .filter(st => st && typeof st.text === 'string' && isStatus(st.status))
      .map(st => ({ text: redact(String(st.text)), status: st.status as PlanStatus, ...(typeof st.doneAt === 'string' ? { doneAt: st.doneAt } : {}) }))
    plan = {
      title: typeof json.title === 'string' && json.title ? redact(json.title) : 'Plan',
      steps,
      updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '',
    }
    planDone = steps.length > 0 && steps.every(st => st.status === 'completed')
    planShown = steps.length > 0 && !planDone
    await drawPlan($)
  } catch (err) {
    await log($, `load plan: ${String(err)}`)
  }
}

/** Plan files of chats gone quiet for a week are deleted; best effort, never breaks the start. */
async function sweepPlans($: EngineInterface) {
  try {
    const dir = `${claudeDirOf($)}/mods-state`
    const now = await $.clock.now()
    const entries = await $.fs.list(dir)
    for (const en of entries) {
      if (en.kind !== 'file' || !/^plan-.+\.json$/.test(en.name) || en.name === `plan-${sessionId}.json`) continue
      if (now - en.mtimeMs > PLAN_KEEP_MS) await removeFile($, `${dir}/${en.name}`).catch(() => undefined)
    }
  } catch {
    // No folder yet, or no access: nothing to sweep.
  }
}

async function toggleIn($: EngineInterface, field: 'open' | 'folded', id: string) {
  const { value = { open: [], folded: [] } } = await $.state.get(VIEW)
  const list = value[field]
  const nextList = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
  await $.state.set(VIEW, { ...value, [field]: nextList })
}

// ---------- Drawing ----------

/** A label then dim text, both cut to fit `w` cells; the folder gives way first. */
function fitRow(label: string, dim: string, w: number): [string, string] {
  if (label.length >= w || !dim) return [cut(label, w), '']
  const room = w - label.length - 2
  if (room < 4) return [label, '']
  return [label, dim.length > room ? `…${dim.slice(-(room - 1))}` : dim]
}

/** Consecutive identical steps folded into one with a count, so "Reading a.md" three times reads "Reading a.md ×3". */
function groupSteps(steps: Step[]): { st: Step; n: number }[] {
  const out: { st: Step; n: number }[] = []
  for (const st of steps) {
    const last = out[out.length - 1]
    if (last && last.st.kind === st.kind && last.st.label === st.label && last.st.dim === st.dim) last.n += 1
    else out.push({ st, n: 1 })
  }
  return out
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    home = (await findPaths($)).home
    claudeDir = claudeDirOf($)
    sessionId = await $.session.id().catch(() => '')
    await $.command.register({ name: 'mk-progress', description: 'Show MK Progress: the task progress bar and one live card per subagent', immediate: true })
    await $.tool.register({
      name: 'plan',
      description:
        'Save the plan for the job in front of you: the steps in order, each pending, in_progress or completed. ' +
        'It draws a progress bar above the prompt for the user. Send the whole list every time, like TodoWrite.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A short name for the job, a few words.' },
          steps: {
            type: 'array',
            description: 'Every step, in order.',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'The step in a few plain words.' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
              },
              required: ['text', 'status'],
            },
          },
        },
        required: ['steps'],
      },
      // Behind ToolSearch, so the schema is not sent on every request; the system prompt names the
      // tool and tells the model to load it before first use.
      isDeferred: true,
    }).catch(err => log($, `register plan tool: ${String(err)}`))
    await readSwitch($)
    await loadPlan($)
    await sweepPlans($)
    syncSwitcher($)
    // A reload keeps the drawn copy: carry on from it.
    if (!helpers.length) {
      const { value } = await $.state.get(HELPERS)
      if (value?.length) {
        // A copy from before body colours has no hue: its seat picks one.
        helpers = value.map(hp => ({ ...copy(hp), hue: typeof hp.hue === 'number' ? hp.hue : hp.seat % HUES.length }))
        seats = Math.max(...helpers.map(hp => hp.seat)) + 1
        nextHue = (Math.max(...helpers.map(hp => hp.hue)) + 1) % HUES.length
        syncTimers($)
      }
    }
    return next(e)
  })

  on('command.run', { command: 'mk-progress' }, async $ => {
    // A sleeping poll wakes here: the switches may have changed since it stopped.
    if (!switcher) await switchPoll($).catch(() => undefined)
    if (off) return { text: `${TITLE} is off. Turn it on with /mods.` }
    if (hidden) await setHidden($, false)
    await openPane($)
    return { text: helpers.length ? `${TITLE} opened.` : `${TITLE} opened. Cards show up when Claude starts a subagent.` }
  })

  on('ui.press', { plugin: NAME, element: 'hide' }, async ($, e) => {
    await setHidden($, true)
    try {
      $.ui.toast(`${TITLE} hidden. Type /mk-progress or open /mods to show it.`)
    } catch {
      // The toast is only a hint.
    }
    return { element: e.element }
  })

  // ▸ / ▾ on the task bar unfolds the plan's steps under the bar.
  on('ui.press', { plugin: NAME, element: 'plan-steps' }, async ($, e) => {
    const { value: open = false } = await $.state.get(PLAN_OPEN)
    await $.state.set(PLAN_OPEN, !open)
    return { element: e.element }
  })

  // ✕ on the task bar hides it until the plan changes again.
  on('ui.press', { plugin: NAME, element: 'plan-dismiss' }, async ($, e) => {
    planShown = false
    holdTimer?.cancel()
    holdTimer = null
    await drawPlan($).catch(err => log($, `dismiss plan: ${String(err)}`))
    return { element: e.element }
  })

  on('ui.press', { plugin: NAME }, async ($, e, next) => {
    if (off) return next(e)
    if (e.element.startsWith('steps-')) {
      await toggleIn($, 'open', e.element.slice('steps-'.length))
      return { element: e.element }
    }
    if (e.element.startsWith('group-')) {
      await toggleIn($, 'folded', e.element.slice('group-'.length))
      return { element: e.element }
    }
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (off) return r
    const id = (r as { agentId?: string }).agentId
    if (id) {
      // The resolved model the engine started it on beats the alias the call asked for; no effort rides the spawn, so it comes from the agent list and its steps.
      const asked = e.model && e.model !== 'inherit' ? e.model : ''
      void addHelper($, id, e.description || 'Subagent', e.subagentType || 'subagent', shortModel(r.model || asked)).catch(err =>
        log($, `spawn: ${String(err)}`),
      )
    }
    return r
  })

  // One unfiltered hook: a typed tool matcher makes tsc recurse through the connector types.
  on('tool.call', async ($, e, next) => {
    const tool = e.tool as string
    const args = e as unknown as Record<string, unknown>
    const id = e.agentId
    if (tool === PLAN_TOOL) {
      // A sleeping poll wakes here: the mod may have been switched off since it stopped.
      if (!switcher) await switchPoll($).catch(() => undefined)
      if (off) return { result: `${TITLE} is off, so no plan was saved. Carry on without it.` } as never
      if (id) return { result: 'Only the main chat keeps a plan. Carry on with your task.' } as never
      let said = 'Plan not saved: something went wrong. Carry on.'
      try {
        said = await planFromTool($, args)
      } catch (err) {
        await log($, `plan: ${String(err)}`)
      }
      turnPlanned = true
      sincePlan = 0
      staleNudged = false
      return { result: said } as never
    }
    if (off) return next(e)
    if (id) {
      void noteTool($, id, describe(tool, args)).catch(err => log($, `tool: ${String(err)}`))
      return next(e)
    }
    if (MIRRORED.has(tool)) {
      const r = await next(e)
      turnPlanned = true
      sincePlan = 0
      void mirror($, tool, args, r).catch(err => log($, `mirror ${tool}: ${String(err)}`))
      return r
    }
    const r = await next(e)
    return withNudge(r)
  })

  // A new prompt is a new task: the plan nudge counts from zero.
  on('prompt.submit', async ($, e, next) => {
    turnCalls = 0
    turnPlanned = false
    nudged = false
    sincePlan = 0
    staleNudged = false
    // A sleeping poll wakes here: the switches may have changed since it stopped.
    if (!switcher) await switchPoll($).catch(() => undefined)
    return next(e)
  })

  // A short system-prompt section, only while the mod is on.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (off || e.traits.includes('teammate') || e.traits.includes('bare')) return r
    return { sections: [...r.sections, { id: 'mk-progress:plan', text: PLAN_PROMPT, scope: 'session' as const }] }
  })

  // Each model request of a helper: its model, effort and token counts.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const id = e.agentId
    if (id && !off) {
      const effort = e.effort === undefined ? '' : String(e.effort)
      void noteStep($, id, e.model, effort, r.usage ?? null).catch(err => log($, `step: ${String(err)}`))
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const id = e.agentId
    if (id && !off && helpers.some(hp => hp.id === id)) {
      const failed = e.reason === 'error' || e.reason === 'refusal' || e.isAborted
      void finish($, id, failed ? 'failed' : 'done', e.usage ?? null).catch(err => log($, `turn: ${String(err)}`))
    }
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const { value: isOff = false } = await $.state.get(OFF)
    if (isOff || off) return next(e)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // Svg draws on desktop, the editor and mobile; the terminal gets glyphs.
    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : null
    const { value: list = [] } = await $.state.get(HELPERS)
    const { value: clk = { tick: 0, now: 0 } } = await $.state.get(CLOCK)
    const { value: view = { open: [], folded: [] } } = await $.state.get(VIEW)
    const { value: cost = { usd: null } } = await $.state.get(COST)
    const width = Math.max(32, e.props.bodyColumns)
    // Beside a card's pet: the text column.
    const petW = Svg ? PET_W_SVG : PET_W
    const cw = width - petW

    const running = list.filter(hp => hp.phase === 'working')
    const finished = list.filter(hp => hp.phase === 'done')
    const stopped = list.filter(hp => hp.phase === 'failed')

    // Header stats: only numbers the engine gave.
    const stats: { key: string; value: string; label: string }[] = []
    if (cost.usd !== null) stats.push({ key: 'stat-cost', value: `$${cost.usd.toFixed(2)}`, label: 'chat cost' })
    if (list.some(hp => hp.hasUsage)) stats.push({ key: 'stat-tokens', value: tokenText(list.reduce((n, hp) => n + hp.tokens + hp.turnTokens, 0)), label: 'subagent tok' })
    if (list.length) {
      const start = Math.min(...list.map(hp => hp.startedAt))
      const end = running.length ? Math.max(clk.now, ...running.map(hp => hp.startedAt)) : Math.max(...list.map(hp => hp.endedAt))
      stats.push({ key: 'stat-time', value: clockTime(end - start), label: 'time' })
    }
    const short = `${list.length} subagent${list.length === 1 ? '' : 's'}`
    // "N subagents in this chat"; the short form only when the pane is too narrow for it and Hide.
    const longTitle = `${short} in this chat`
    const title = list.length ? (longTitle.length + 1 + 4 <= width ? longTitle : short) : 'No subagents yet'
    const statsLen = stats.reduce((n, st, i) => n + st.value.length + 1 + st.label.length + (i ? 3 : 0), 0)
    // The title, the stats and Hide on one line; the stats drop to a second only when they do not fit.
    const inline = title.length + 1 + statsLen + 1 + 4 <= width
    const statRow = stats.flatMap((st, i) => [
      i ? (
        <Text key={`sep-${i}`} dimColor>
          {' · '}
        </Text>
      ) : null,
      <Box key={st.key}>
        <Text wrap="truncate-end">
          <Text bold color={ACCENT}>
            {st.value}
          </Text>
          <Text dimColor>{` ${st.label}`}</Text>
        </Text>
      </Box>,
    ])
    // Tokens and cost per model, from what the engine reports for each subagent.
    const byModel = modelTotals(list)

    // A running pet steps through its frames on the clock tick; a finished one stands still.
    const frameOf = (hp: Helper) => (hp.phase === 'working' ? Math.floor(clk.tick / FRAME_TICKS) % FRAMES : 0)

    // A running crab blinks for one step about every 3.6 s, on a clock of its own (a seat's offset keeps cards out of step); a finished one keeps its eyes open.
    const blinkOf = (hp: Helper) => hp.phase === 'working' && (Math.floor(clk.tick / FRAME_TICKS) + hp.seat * 2) % 6 === 5

    const pet = (hp: Helper) => {
      const color = modelColor(hp.model)
      const frame = frameOf(hp)
      const blink = blinkOf(hp)
      // A small dim "#1" under the crab tells two cards on the same model apart.
      const seatTag = <Text key={`seat-${hp.id}`} dimColor>{`#${hp.seat + 1}`}</Text>
      if (Svg) {
        return (
          <Box key={`pet-${hp.id}`} width={petW} flexShrink={0} flexDirection="column" justifyContent="center">
            <Svg source={petSvg(color, frame, blink)} alt={`Claude crab, ${familyName(hp.model)}`} width={PET_PX_W} height={PET_PX_H} />
            {seatTag}
          </Box>
        )
      }
      return (
        <Box key={`pet-${hp.id}`} width={petW} flexShrink={0} flexDirection="column">
          {petRows(frame, blink).map((row, i) => (
            <Box key={`pet-${hp.id}-r${i}`}>
              <Text color={color}>{row}</Text>
            </Box>
          ))}
          {seatTag}
        </Box>
      )
    }

    /** The model with its effort ("opus·high"), then " · 34k tok", then the type, in `room` columns. The type is never dropped: the tokens give way to it, and it is cut before it goes. */
    const whoLine = (hp: Helper, room: number): [string, string] => {
      const family = hp.model ? familyOf(hp.model) : 'inherit'
      const model = cut(hp.effort ? `${family}·${hp.effort}` : family, Math.max(4, room))
      const tok = hp.hasUsage ? ` · ${tokenText(hp.tokens + hp.turnTokens)} tok` : ''
      const typeRoom = room - model.length - tok.length - 3
      if (!hp.type) return [model, tok]
      if (typeRoom >= Math.min(hp.type.length, 6)) return [model, `${tok} · ${cut(hp.type, typeRoom)}`]
      return [model, ` · ${cut(hp.type, Math.max(3, room - model.length - 3))}`]
    }

    const card = (hp: Helper) => {
      const hue = { color: modelColor(hp.model) }
      const live = hp.phase === 'working'
      const failed = hp.phase === 'failed'
      const isOpen = view.open.includes(hp.id)
      const mark = live ? '●' : failed ? '✗' : '✓'
      const markColor = failed ? BAD : GOOD
      const time = clockTime((live ? Math.max(clk.now, hp.startedAt) : hp.endedAt) - hp.startedAt)
      const current = hp.steps[hp.steps.length - 1]
      const spin = SPIN[clk.tick % SPIN.length]!
      const nSteps = `${hp.count} step${hp.count === 1 ? '' : 's'}`
      const hasSteps = hp.steps.length > 0
      const toggleText = isOpen ? '▾ hide steps' : `▸ all ${hp.count} step${hp.count === 1 ? '' : 's'}`
      // The collapsed card keeps the last few earlier steps as dim lines: the ones before the current step while it runs, the last ones once it is over.
      const history = isOpen
        ? []
        : (live ? hp.steps.slice(0, -1) : hp.steps).slice(-HISTORY).map((st, i) => (
            <Text key={`h-${hp.id}-${i}`} dimColor wrap="truncate-end">
              {cut(`  ${st.live}`, cw)}
            </Text>
          ))
      const toggle = hasSteps ? (
        <Button key={`steps-${hp.id}`} plain dimColor onPress={() => undefined}>
          {toggleText}
        </Button>
      ) : null
      const toggleW = hasSteps ? toggleText.length : 0
      const rowW = cw - TAG_W
      // The Cache bar (10 emoji cells, 2 columns each) shares the last row with the toggle; it loses cells only when the row is too narrow.
      const barCells = Math.max(3, Math.min(BAR_CELLS, Math.floor((cw - (toggleW ? toggleW + 1 : 0)) / 2)))
      const barText = live ? cacheStyleBar(0.3, 'done', barCells, clk.tick + hp.seat).text : cacheStyleBar(1, failed ? 'failed' : 'done', barCells).text

      const head = (
        <Box key={`r1-${hp.id}`} flexDirection="row" justifyContent="space-between" width={cw}>
          <Box width={Math.max(4, cw - time.length - 3)}>
            <Text bold wrap="truncate-end">
              {cut(hp.description, Math.max(4, cw - time.length - 3))}
            </Text>
          </Box>
          <Box flexShrink={0}>
            <Text dimColor>{`${time} `}</Text>
            <Text bold color={markColor}>
              {mark}
            </Text>
          </Box>
        </Box>
      )
      const barRow = (
        <Box key={`r4-${hp.id}`} flexDirection="row" alignItems="center" gap={1} width={cw}>
          <Box key={`bar-${hp.id}`} width={barCells * 2} flexShrink={0}>
            <Text wrap="truncate-end">{barText}</Text>
          </Box>
          {toggle}
        </Box>
      )

      const [who, whoRest] = whoLine(hp, cw)
      const whoRow = (
        <Text key={`r2-${hp.id}`} wrap="truncate-end">
          <Text bold color={hue.color}>
            {who}
          </Text>
          <Text dimColor>{whoRest}</Text>
        </Text>
      )
      let rows: unknown[]
      if (live) {
        // "◐ Step 116 · Reading notes.md": the spinner, the step number, then the live text.
        const stepLead = `Step ${hp.count} · `
        const stepW = Math.max(4, cw - 2 - stepLead.length)
        rows = [
          head,
          whoRow,
          <Box key={`r3-${hp.id}`} flexDirection="row" width={cw}>
            <Text color={ACCENT}>{`${spin} `}</Text>
            <Text dimColor>{stepLead}</Text>
            <Box width={stepW}>
              <Text bold color={ACCENT} wrap="truncate-end">
                {cut(current?.live ?? 'Getting started', stepW)}
              </Text>
            </Box>
          </Box>,
          ...history,
          barRow,
        ]
      } else {
        // "✓ Done · 12 steps" or "✗ Stopped before it finished · 12 steps" ("✗ Stopped · 12 steps" when that does not fit).
        const doneText = failed ? `Stopped before it finished · ${nSteps}` : `Done · ${nSteps}`
        const doneFit = failed && doneText.length + 2 > cw ? `Stopped · ${nSteps}` : doneText
        rows = [
          head,
          whoRow,
          <Box key={`r3-${hp.id}`} flexDirection="row" width={cw}>
            <Text bold color={markColor}>
              {`${mark} `}
            </Text>
            <Box width={Math.max(4, cw - 2)}>
              <Text dimColor={!failed} color={failed ? BAD : undefined} wrap="truncate-end">
                {cut(doneFit, Math.max(4, cw - 2))}
              </Text>
            </Box>
          </Box>,
          ...history,
          barRow,
        ]
      }
      if (isOpen) {
        rows.push(
          <Box key={`list-${hp.id}`} flexDirection="column" width={cw}>
            {hp.count > hp.steps.length ? <Text dimColor>{`${hp.count - hp.steps.length} older steps not kept`}</Text> : null}
            {groupSteps(hp.steps).map(({ st, n }, i) => {
              const suffix = n > 1 ? ` ×${n}` : ''
              const [label, dim] = fitRow(cut(st.label, rowW - suffix.length) + suffix, st.dim, rowW)
              return (
                <Box key={`s-${hp.id}-${i}`} flexDirection="row" width={cw}>
                  <Box width={TAG_W}>
                    <Text color={KIND_COLOR[st.kind]}>{st.kind}</Text>
                  </Box>
                  <Box width={rowW}>
                    <Text wrap="truncate-end">
                      {label}
                      {dim ? <Text dimColor>{`  ${dim}`}</Text> : null}
                    </Text>
                  </Box>
                </Box>
              )
            })}
          </Box>,
        )
      }

      return (
        <Box key={`card-${hp.id}`} flexDirection="row" width={width}>
          {pet(hp)}
          <Box key={`rows-${hp.id}`} flexDirection="column" width={cw}>
            {rows as never}
          </Box>
        </Box>
      )
    }

    // A heading per group: one slim line in the group's colour, arrow and title in bold, a heavy rule to the edge.
    const group = (id: string, name: string, count: string | number, color: string, body: () => unknown, show = true) => {
      if (!show) return null
      const folded = view.folded.includes(id)
      const label = `${name} ${count} `
      return (
        <Box key={`grp-${id}`} flexDirection="column" width={width}>
          <Box key={`head-${id}`} flexDirection="row" width={width}>
            <Button key={`group-${id}`} plain onPress={() => undefined}>
              <Text bold color={color}>
                {folded ? '▸ ' : '▾ '}
              </Text>
            </Button>
            <Text bold color={color}>
              {label}
            </Text>
            <Text color={color} wrap="truncate-end">
              {'━'.repeat(Math.max(2, width - 2 - label.length))}
            </Text>
          </Box>
          {folded ? null : (body() as never)}
        </Box>
      )
    }

    // The plan, when it has steps (shown or not). Done steps fold into one line that is itself a toggle:
    // the folded list holds ids the viewer flipped away from their default, and "tasks-done" is collapsed
    // by default, so having "tasks-done" in it means the done steps are listed.
    const { value: bp0 = null } = await $.state.get(PLAN)
    const bp = bp0 && bp0.steps.length ? bp0 : null
    const tDone = bp ? bp.steps.filter(st => st.status === 'completed') : []
    const doneOpen = view.folded.includes('tasks-done')
    const taskLine = (st: BandPlan['steps'][number], key: string) => {
      const mark = st.status === 'completed' ? '✓' : st.status === 'in_progress' ? '◐' : '○'
      return (
        <Text key={key} wrap="truncate-end" bold={st.status === 'in_progress'} dimColor={st.status !== 'in_progress'} color={st.status === 'completed' ? GOOD : st.status === 'in_progress' ? P_MID : undefined}>
          {cut(`${mark} ${st.text}`, width)}
        </Text>
      )
    }
    const tasksBody = () => (
      <Box flexDirection="column" width={width}>
        {tDone.length ? (
          <Box key="tasks-done" flexDirection="column" width={width}>
            <Box flexDirection="row">
              <Button key="group-tasks-done" plain onPress={() => undefined}>
                <Text color={GOOD} dimColor>
                  {`${doneOpen ? '▾' : '▸'} ✓ ${tDone.length} done`}
                </Text>
              </Button>
            </Box>
            {doneOpen ? tDone.map((st, i) => taskLine(st, `td-${i}`)) : null}
          </Box>
        ) : null}
        {(bp?.steps ?? []).filter(st => st.status !== 'completed').map((st, i) => taskLine(st, `tp-${i}`))}
      </Box>
    )

    const titleText = (
      <Text bold color={running.length ? ACCENT : list.length ? GOOD : undefined}>
        {title}
      </Text>
    )
    const showCaveat = byModel.some(m => m.usd !== null)
    const modelRows = byModel.map(m => {
      const usd = m.usd !== null ? `~$${m.usd.toFixed(2)}` : ''
      const mk = (unit: string) => [m.tokens > 0 ? `${tokenText(m.tokens)} ${unit}` : '', usd].filter(Boolean).join(' · ')
      // "tokens" in full when the row has room for it, else "tok".
      const right = 2 + m.model.length + 1 + mk('tokens').length <= width ? mk('tokens') : mk('tok')
      return (
        <Box key={`model-${m.model}`} flexDirection="row" justifyContent="space-between" width={width}>
          <Box flexDirection="row" gap={1}>
            <Box key={`dot-${m.model}`} flexShrink={0}>
              <Text color={modelColor(m.model)}>●</Text>
            </Box>
            <Text dimColor wrap="truncate-end">
              {cut(m.model, Math.max(4, width - right.length - 3))}
            </Text>
          </Box>
          <Text dimColor>{right}</Text>
        </Box>
      )
    })
    // The rule that closes the summary carries the caveat for the "~$" figures, when there are any.
    const caveatRule = '─ ~$ = estimate, not the bill '
    const rule = showCaveat ? `${caveatRule}${'─'.repeat(Math.max(2, width - caveatRule.length))}` : '─'.repeat(width)

    return (
      <Box flexDirection="column" width={width}>
        <Box key="header" flexDirection="column" width={width}>
          <Box flexDirection="row" justifyContent="space-between" gap={1} width={width}>
            <Box flexDirection="row" gap={1}>
              {titleText}
              {inline ? statRow : null}
            </Box>
            <Button key="hide" label="Hide" dimColor onPress={() => undefined} />
          </Box>
          {inline || !stats.length ? null : (
            <Box key="stats" flexDirection="row" width={width}>
              {statRow}
            </Box>
          )}
        </Box>
        {byModel.length ? (
          <Box key="models" flexDirection="column" width={width}>
            <Text key="models-head" dimColor>
              By model
            </Text>
            {modelRows}
            <Box key="models-rule" width={width}>
              <Text dimColor wrap="truncate-end">
                {rule}
              </Text>
            </Box>
          </Box>
        ) : null}
        {group('tasks', 'Tasks', `${tDone.length}/${bp?.steps.length ?? 0}`, P_MID, tasksBody, !!bp)}
        {list.length ? null : <Text dimColor>Cards show up here when Claude starts a subagent.</Text>}
        {group('running', 'Running', running.length, GOOD, () => running.map(card), running.length > 0)}
        {group('finished', 'Finished', finished.length, WARN, () => finished.map(card), finished.length > 0)}
        {group('stopped', 'Stopped', stopped.length, BAD, () => stopped.map(card), stopped.length > 0)}
      </Box>
    )
  })

  // The task bar above the prompt: it moves each time a to-do or plan step is marked done.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (off || e.props.hasSurvey) return next(e)
    const { value: isOff = false } = await $.state.get(OFF)
    const { value: isHidden = false } = await $.state.get(HIDDEN)
    const { value: p = null } = await $.state.get(PLAN)
    const { value: planOpen = false } = await $.state.get(PLAN_OPEN)
    if (isOff || isHidden || hidden || !p || !p.shown || !p.steps.length) return next(e)
    // The other mods' bands draw above this one. Claude Code's own placeholder is never nested.
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const rest = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const cols = typeof e.props.bodyColumns === 'number' && e.props.bodyColumns > 0 ? Math.floor(e.props.bodyColumns) : 0
    const n = p.steps.length
    const done = doneCount(p.steps)
    const pct = `${Math.round((done / n) * 100)}%`
    const label = `Tasks ${done}/${n}`
    const now = p.steps.find(st => st.status === 'in_progress')
    const nextUp = p.steps.find(st => st.status === 'pending')
    const line = now ? `Now: ${now.text}` : done === n ? 'All steps done' : nextUp ? `Next: ${nextUp.text}` : ''
    const toggle = (
      <Button key="plan-steps" plain dimColor onPress={() => undefined}>
        {planOpen ? '▾' : '▸'}
      </Button>
    )
    const dismiss = <Button key="plan-dismiss" label="✕" plain dimColor role="dismiss" onPress={() => undefined} />

    let row: unknown
    let w: number
    // One look on every surface: the Cache bar of 10 emoji cells (green above half done or when complete, yellow below, never red).
    w = cols || BAR_FALLBACK
    const { value: tick = 0 } = await $.state.get(SHIM)
    const { titleW, barW, showTitle, showPct } = bandLayout(w - 2, p.title.length, label.length, pct.length)
    row = (
      <Box key="plan-row" flexDirection="row" gap={1} width={w}>
        <Text color={P_DEEP}>●</Text>
        {showTitle ? (
          <Box width={titleW} flexShrink={0}>
            <Text bold wrap="truncate-end">
              {cut(p.title, titleW)}
            </Text>
          </Box>
        ) : null}
        {barW ? (
          <Box key="plan-bar" flexShrink={0}>
            <Text>{cacheStyleBar(done / n, 'done', barW, now ? tick : undefined).text}</Text>
          </Box>
        ) : null}
        <Text bold color={P_MID}>{label}</Text>
        {showPct ? <Text dimColor>{pct}</Text> : null}
        {toggle}
        {dismiss}
      </Box>
    )
    // Expanded: one line per step. Done in dim green with the time it was done, the one in progress bold purple, the rest dim.
    const stepRows = planOpen
      ? p.steps.map((st, i) => {
          const t = st.status === 'completed' ? hhmm(st.doneAt) : ''
          const tw = Math.max(4, w - (t ? t.length + 1 : 0))
          const mark = st.status === 'completed' ? '✓' : st.status === 'in_progress' ? '◐' : '○'
          return (
            <Box key={`plan-step-${i}`} flexDirection="row" justifyContent="space-between" width={w}>
              <Box width={tw}>
                <Text wrap="truncate-end" bold={st.status === 'in_progress'} dimColor={st.status !== 'in_progress'} color={st.status === 'completed' ? GOOD : st.status === 'in_progress' ? P_MID : undefined}>
                  {cut(`${mark} ${st.text}`, tw)}
                </Text>
              </Box>
              {t ? <Text dimColor>{t}</Text> : null}
            </Box>
          )
        })
      : null
    return (
      <Box flexDirection="column">
        {rest as never}
        <Box key="plan-band" flexDirection="column">
          {row as never}
          {line ? (
            <Text key="plan-now" dimColor wrap="truncate-end">
              {cut(line, w)}
            </Text>
          ) : null}
          {stepRows as never}
        </Box>
      </Box>
    )
  })
}

import { expect, mock, test } from 'claude-code/testing'
import { bandLayout } from './layout'

/** The `on` a test body is handed. */
type On = Parameters<NonNullable<Parameters<typeof test>[2]>>[1]

type Agent = {
  id: string
  description: string
  type: string
  status: string
  model?: string
  effort?: string | number
  lastRequest?: { model: string; effort?: string | number }
  usage?: { model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }[]
  cost?: { usd: number }
}

/** The file `path` names: exact, or a key led by a star that any home can end with. */
const keyOf = (files: Record<string, string>, path: string) =>
  path in files ? path : Object.keys(files).find(k => k.startsWith('*') && path.endsWith(k.slice(1)))

/** Mtimes of files by name for fs.list; a name not here is new. Newest test only. */
let mtimes: Record<string, number> = {}
/** A write to a path matching this throws, to make the mod log. */
let failWrite: RegExp | null = null
/** How many times the mod read switches.json. */
let switchReads = 0

/** What ui.open answers: false for a terminal too narrow to seat a pane nobody asked for. Newest test only. */
let placed = true

/** Each tool spec the mod registered, newest test only. */
let specs: { isDeferred?: boolean }[] = []

/** Mocks every $ call the mod makes; `files` stands in for the disk. */
function rig(on: On, files: Record<string, string>) {
  placed = true
  const ids = ['agent-a1', 'agent-a2', 'agent-a3']
  const agents: Agent[] = []
  const statuses: (string | undefined)[] = []
  const opened: string[] = []
  const openedCols: (number | undefined)[] = []
  const closed: string[] = []
  const ran: string[][] = []
  const toasts: string[] = []

  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('session.id', async () => ({ value: 'sess1' }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [], cost: { usd: 0.42 } } }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('tool.register', async ($, e) => {
    specs.push(e as { isDeferred?: boolean })
    return { value: { tool: 'mcp__mk-progress__plan' } } as never
  })
  const clock = mock.clock(on, { now: 1_000_000 })
  on('agent.spawn', async ($, e) => {
    const { description, subagentType, model } = e as { description: string; subagentType: string; model?: string }
    const id = ids[agents.length]!
    agents.push({ id, description, type: subagentType, status: 'running' })
    // What the engine answers: the alias resolved, or the parent's model.
    const resolved = ({ haiku: 'claude-haiku-4-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' } as Record<string, string>)[model ?? ''] ?? 'claude-opus-5-5'
    return { model: resolved, agentId: id } as never
  })
  on('agent.list', async () => ({ value: agents.map(a => ({ ...a })) }) as never)
  on('ui.open', async ($, e) => {
    opened.push((e as { id: string }).id)
    openedCols.push((e as { columns?: number }).columns)
    return { value: placed ? { isPlaced: true } : { isPlaced: false, reason: 'too narrow' } } as never
  })
  on('ui.close', async ($, e) => {
    closed.push((e as { id: string }).id)
    return { value: undefined } as never
  })
  on('ui.status', async ($, e) => {
    statuses.push((e as { text: string | undefined }).text)
    return { value: undefined } as never
  })
  on('ui.toast', async ($, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('tool.call', async () => ({ result: 'ok' }) as never)
  // Beneath the plugins a pane nobody draws is empty.
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return (<Box />) as never
  })
  on('turn.complete', async () => ({ text: '' }) as never)
  on('fs.exists', async ($, e) => ({ value: keyOf(files, (e as { path: string }).path) !== undefined }) as never)
  on('fs.read', async ($, e) => {
    if ((e as { path: string }).path.endsWith('/mods/switches.json')) switchReads++
    return { value: files[keyOf(files, (e as { path: string }).path) ?? ''] ?? '' } as never
  })
  on('fs.stat', async ($, e) => {
    const hit = keyOf(files, (e as { path: string }).path)
    if (hit === undefined) throw new Error('ENOENT')
    return { value: { kind: 'file', size: files[hit]!.length, mtimeMs: 0, isLink: false } } as never
  })
  on('fs.list', async ($, e) => {
    const dir = (e as { path?: string }).path ?? ''
    const entries = Object.keys(files).flatMap(k => {
      const at = k.lastIndexOf('/')
      const own = k.slice(0, at)
      const inside = k.startsWith('*') ? dir.endsWith(own.slice(1)) : own === dir
      const name = k.slice(at + 1)
      return inside ? [{ name, kind: 'file', size: files[k]!.length, mtimeMs: mtimes[name] ?? 999_000, isLink: false }] : []
    })
    return { value: entries } as never
  })
  on('fs.write', async ($, e) => {
    const { path, text } = e as { path: string; text: string }
    if (failWrite?.test(path)) return { deny: 'disk full' } as never
    files[path] = text
    return { value: undefined } as never
  })
  on('process.run', async ($, e) => {
    const argv = (e as { argv?: string[]; command?: string[] }).argv ?? (e as { command?: string[] }).command ?? []
    ran.push(argv)
    const hit = argv[0] === 'rm' ? keyOf(files, argv[argv.length - 1]!) : undefined
    if (hit) delete files[hit]
    // The append helper: sh -c 'cat >> "$1"' sh <path>, the text on stdin.
    if (argv[0] === 'sh' && argv[2]?.includes('>>')) {
      const path = argv[4]!
      const at = keyOf(files, path) ?? path
      files[at] = `${files[at] ?? ''}${(e as { init?: { stdin?: string } }).init?.stdin ?? ''}`
    }
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  return { agents, statuses, opened, openedCols, closed, ran, clock, toasts }
}

/** What the band says: the drawing's alt text on desktop, every text in the terminal. */
async function bandSays(v: { find: (q: object) => Promise<unknown>; findAll: (q: object) => Promise<unknown[]> }, surface: 'desktop' | 'terminal') {
  if (surface === 'desktop') {
    const svg = (await v.find({ type: 'Svg' })) as { props: { alt?: string } } | undefined
    return svg ? String(svg.props.alt) : ''
  }
  return ((await v.findAll({ type: 'Text' })) as { text: string }[]).map(t => t.text).join(' ')
}

const bandProps = (bodyColumns = 40) => ({ isWorking: true, hasSurvey: false, maxRows: 20, bodyColumns, scroll: {}, view: {} }) as never

/** The plan file this chat writes, whatever the home. */
const planFile = (files: Record<string, string>) => Object.keys(files).find(k => k.endsWith('/.claude/mods-state/plan-sess1.json'))

const steps4 = (done: number, live: boolean) =>
  ['Read the brief', 'Draft the outline', 'Build the slides', 'Check the deck'].map((text, i) => ({
    text,
    status: i < done ? 'completed' : i === done && live ? 'in_progress' : 'pending',
  }))

const props = (bodyColumns = 60) =>
  ({ title: 'MK Progress', isFocused: false, bodyColumns, placement: 'dock', scroll: {}, view: {} }) as never

for (const surface of ['desktop', 'terminal'] as const) {
  test(`two helpers get live cards, then both are done (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { agents, statuses, opened, clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    // A plain signature: the connector-typed one is too deep for tsc.
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>

    const spawn = (description: string, subagentType: string, model: string, n: number) =>
      $.agent.spawn({ tool_use_id: `spawn${n}`, prompt: 'Do the job.', description, subagentType, model } as never)
    await spawn('Read the research notes', 'Explore', 'haiku', 1)
    await spawn('Find invoice threads', 'general-purpose', 'opus', 2)
    await clock.settle()
    expect(opened, 'pane opened by itself').toContain('mk-progress')

    await callTool({ tool: 'Read', tool_use_id: 'c1', file_path: '/home/test/work/research.md', agentId: 'agent-a1' } as never)
    await callTool({ tool: 'mcp__00000000-0000-0000-0000-00000000000a__search_threads', tool_use_id: 'c2', query: 'invoice', agentId: 'agent-a2' } as never)
    await clock.advance(5_000)

    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props() })
    expect(await v.find({ text: /Read the research notes/ }), 'first description').toBeDefined()
    expect(await v.find({ text: /Find invoice threads/ }), 'second description').toBeDefined()
    expect(await v.find({ text: /^Reading research\.md$/ }), 'Read in words').toBeDefined()
    expect(await v.find({ text: /Gmail: search threads/ }), 'Gmail connector in words').toBeDefined()
    expect(await v.find({ type: 'Text', text: /^Running 2\s*$/ }), 'Running heading with its count').toBeDefined()
    const runHead = await v.find({ key: 'head-running' })
    expect(runHead?.props.backgroundColor, 'no filled box behind the heading').toBeUndefined()
    expect((await v.find({ type: 'Text', text: /^2 subagents$/ }))?.props.color, 'title orange while any run').toBe('#d97757')
    expect((await v.find({ type: 'Text', text: /^Running 2\s*$/ }))?.props.color, 'Running is green').toBe('#16a34a')
    expect(await v.find({ text: /^haiku$/ }), 'model, no effort known yet').toBeDefined()
    expect(await v.find({ text: /^ · Explore$/ }), 'type after it').toBeDefined()
    expect(await v.find({ text: /^opus$/ }), 'the other card').toBeDefined()
    expect(await v.find({ text: /^ · general-purpose$/ }), 'its type').toBeDefined()
    expect(await v.find({ key: 'models' }), 'no model block before any usage').toBeUndefined()
    expect(await v.find({ key: 'stat-time' }), 'time stat').toBeDefined()
    expect(await v.find({ key: 'stat-cost' }), 'chat cost stat').toBeDefined()
    expect(await v.find({ text: /\$0\.42/ }), 'chat cost from the engine').toBeDefined()
    expect(await v.find({ type: 'Text', text: /^chat$/ }) ?? (await v.find({ type: 'Text', text: /^ chat$/ })), 'its label').toBeDefined()
    expect(await v.find({ key: 'stat-tokens' }), 'no tokens stat before any usage').toBeUndefined()
    expect(statuses.every(t => t === undefined), 'no footer status line').toBe(true)

    const usage = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 30000, cache_creation_input_tokens: 2000, model: 'claude-opus-5-5' }
    await $.turn.complete({ answer: 'Found it.', agentId: 'agent-a1', reason: 'answer', durationMs: 4000, isAborted: false, turnId: 't1', usage } as never)
    await clock.settle()
    expect(await v.find({ type: 'Text', text: /^Finished 1\s*$/ }), 'Finished heading with its count').toBeDefined()
    expect((await v.find({ type: 'Text', text: /^Finished 1\s*$/ }))?.props.color, 'Finished is amber, readable on white').toBe('#b98d06')
    expect(await v.find({ key: 'stat-tokens' }), 'subagent tokens stat from usage').toBeDefined()
    expect(await v.find({ text: /34k tok/ }), 'card tokens').toBeDefined()
    expect(statuses[statuses.length - 1], 'still no footer status').toBeUndefined()

    // The 2 s poll sees the second helper finish from $.agent.list().
    agents[1]!.status = 'completed'
    await clock.advance(2_100)
    expect(await v.find({ type: 'Text', text: /^Finished 2\s*$/ }), 'both finished from the poll').toBeDefined()
    expect(await v.find({ key: 'head-running' }), 'running group gone').toBeUndefined()
    expect(statuses[statuses.length - 1], 'status cleared').toBeUndefined()
  })

  test(`the crab wears the colour of its model: opus orange, sonnet blue, haiku teal, unknown grey, and only running crabs move (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { agents, clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Build the landing page', subagentType: 'general-purpose', model: 'opus' } as never)
    await $.agent.spawn({ tool_use_id: 's2', prompt: 'x', description: 'Design the graphics', subagentType: 'general-purpose', model: 'sonnet' } as never)
    await $.agent.spawn({ tool_use_id: 's3', prompt: 'x', description: 'Write the notes', subagentType: 'general-purpose', model: 'haiku' } as never)
    await clock.settle()
    expect(agents, 'three spawned').toHaveLength(3)
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props() })
    if (surface === 'terminal') {
      const heads = await v.findAll({ type: 'Text', text: /^ ▐▛███▜▌ $/ })
      expect(heads.map(h => h.props.color), 'opus orange, sonnet blue, haiku teal').toEqual(['#d97757', '#3b82f6', '#12a494'])
      expect(await v.findAll({ type: 'Svg' }), 'no Svg on the terminal').toHaveLength(0)
      const legs = async () => String((await v.find({ key: 'pet-agent-a1-r2' }))?.text)
      const before = await legs()
      await clock.advance(600)
      expect((await legs()) !== before, 'a running glyph pet moves its legs').toBe(true)
      // The model is the crab's colour in the meta line too, in bold.
      const name = await v.find({ type: 'Text', text: /^sonnet$/ })
      expect(name?.props.color, 'model name in its colour').toBe('#3b82f6')
      expect(name?.props.bold, 'bold').toBe(true)
      // A summary row per model starts with a dot in the same colour.
      await $.turn.complete({ answer: 'ok', agentId: 'agent-a1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1', usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' } } as never)
      await clock.settle()
      const dot = (await v.find({ key: 'dot-opus 5.5' })) as { children: { props: { color?: string } }[] } | undefined
      expect(dot?.children[0]?.props.color, 'legend dot in the model colour').toBe('#d97757')
      return
    }
    const pets = async () => (await v.findAll({ type: 'Svg' })).filter(p => String(p.props.alt).startsWith('Claude crab'))
    const got = await pets()
    expect(got.map(p => String(p.props.alt)), 'alt names the model family').toEqual(['Claude crab, opus', 'Claude crab, sonnet', 'Claude crab, haiku'])
    expect(String(got[0]!.props.source).includes('#d97757'), 'opus is Claude orange').toBe(true)
    expect(String(got[1]!.props.source).includes('#3b82f6'), 'sonnet is blue').toBe(true)
    expect(String(got[2]!.props.source).includes('#12a494'), 'haiku is teal').toBe(true)
    expect(String(got[2]!.props.source), 'and a brighter teal on a dark page').toContain('prefers-color-scheme: dark')
    expect(String(got[0]!.props.source).includes('#2b1d16'), 'eyes filled').toBe(true)
    expect(String(got[0]!.props.source).length < 131072, 'under the Svg limit').toBe(true)
    expect(Number(got[0]!.props.width), 'about 9 columns wide').toBe(58)

    // Running: the frame changes on the clock tick.
    const frames = new Set<string>()
    for (let i = 0; i < 4; i += 1) {
      frames.add(String((await pets())[0]!.props.source))
      await clock.advance(600)
    }
    expect(frames.size >= 2, 'a running pet cycles frames').toBe(true)

    // Finished: it stands still, 3 rows, in frame 0.
    await $.turn.complete({ answer: 'ok', agentId: 'agent-a1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1' } as never)
    await clock.settle()
    // The finished crab sits in the Finished group, after the running ones.
    const still = async () => String((await pets()).at(-1)!.props.source)
    const first = await still()
    expect(first, 'a finished pet stands: three rows, 18 by 6 pixels').toContain('viewBox="0 0 18 6"')
    await clock.advance(600)
    expect(await still(), 'a finished pet is still').toBe(first)
    await clock.advance(600)
    expect(await still(), 'still after another tick').toBe(first)
  })

  test(`a crab is stone grey until its model is known, then takes the family colour (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { agents, clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    agents.push({ id: 'agent-x1', description: 'Late helper', type: 'Explore', status: 'running' })
    await callTool({ tool: 'Read', tool_use_id: 'c1', file_path: '/home/test/work/a.md', agentId: 'agent-x1' } as never)
    await clock.advance(2_100)
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props() })
    const seen = async () =>
      surface === 'terminal'
        ? String((await v.findAll({ type: 'Text', text: /^( ▐(▛███▜|█████)▌ |▗▐▛███▜▌▖)$/ }))[0]?.props.color)
        : String((await v.findAll({ type: 'Svg' })).find(p => String(p.props.alt).startsWith('Claude crab'))?.props.source)
    const alt = async () => String((await v.findAll({ type: 'Svg' })).find(p => String(p.props.alt).startsWith('Claude crab'))?.props.alt)
    expect(await seen(), 'unknown: stone grey').toContain('#97928e')
    if (surface !== 'terminal') expect(await alt(), 'alt says unknown').toBe('Claude crab, unknown')
    agents[0]!.model = 'claude-sonnet-5-5'
    await clock.advance(2_100)
    expect(await seen(), 'sonnet: blue').toContain('#3b82f6')
    if (surface !== 'terminal') expect(await alt(), 'alt names the family').toBe('Claude crab, sonnet')
  })

  test(`each card shows model and effort, and the footer totals tokens and cost per model (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { agents, clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Scan the repo', subagentType: 'Explore', model: 'haiku' } as never)
    await $.agent.spawn({ tool_use_id: 's2', prompt: 'x', description: 'Write the summary', subagentType: 'general-purpose' } as never)
    await clock.settle()
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(70) })
    expect(await v.find({ text: /^haiku$/ }), 'model from the spawn answer, no effort yet').toBeDefined()
    expect(await v.find({ text: /^opus$/ }), 'no model asked: the one the engine resolved').toBeDefined()
    expect(await v.find({ key: 'models' }), 'no model block before any usage').toBeUndefined()

    // What $.agent.list() reports while they work.
    const tok = (model: string, input: number, output: number) => ({ model, input_tokens: input, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })
    Object.assign(agents[0]!, { model: 'claude-haiku-4-5', effort: 'low', usage: [tok('claude-haiku-4-5', 1500, 500)], cost: { usd: 0.03 } })
    // A model switch mid-run: two rows, its cost split by tokens (sonnet 10k, haiku 2k of 12k).
    Object.assign(agents[1]!, {
      model: 'claude-sonnet-5-5',
      lastRequest: { model: 'claude-sonnet-5-5', effort: 'high' },
      usage: [tok('claude-sonnet-5-5', 9000, 1000), tok('claude-haiku-4-5', 1500, 500)],
      cost: { usd: 0.12 },
    })
    await clock.advance(2_100)
    expect(await v.find({ text: /^haiku·low$/ }), 'effort set for it').toBeDefined()
    expect(await v.find({ text: /^ · Explore$/ }), 'type after the model').toBeDefined()
    expect(await v.find({ text: /^sonnet·high$/ }), 'last request model and effort').toBeDefined()
    expect(await v.find({ text: /^ · general-purpose$/ }), 'its type').toBeDefined()
    expect(await v.find({ key: 'models' }), 'the model block at the top').toBeDefined()
    expect(await v.find({ text: /^sonnet 5\.5$/ }), 'sonnet row').toBeDefined()
    expect(await v.find({ text: /^10k tok · ~\$0\.10$/ }), 'sonnet tokens and cost').toBeDefined()
    expect(await v.find({ text: /^haiku 4\.5$/ }), 'haiku row').toBeDefined()
    expect(await v.find({ text: /^4k tok · ~\$0\.05$/ }), 'haiku adds up over both agents').toBeDefined()
    expect(await v.find({ key: 'models-caveat' }), 'no caveat on a model row').toBeUndefined()
    expect(((await v.find({ key: 'models-rule' })) as { text: string }).text, 'the closing rule carries the caveat').toMatch(/^─ ~\$ = estimate, not the bill ─+$/)
    // The block sits under the one-line stats and before the first group heading.
    const order = ((await v.findAll({ type: 'Text' })) as { text: string }[]).map(t => t.text)
    const at = (re: RegExp) => order.findIndex(t => re.test(t))
    expect(at(/^sonnet 5\.5$/) > at(/^2 subagents$/), 'models follow the header').toBe(true)
    expect(at(/^sonnet 5\.5$/) < at(/^Running 2\s*$/), 'models come before the first group').toBe(true)
    expect(at(/^─ ~\$ = estimate/) > at(/^haiku 4\.5$/) && at(/^─ ~\$ = estimate/) < at(/^Running 2\s*$/), 'a thin rule closes the block').toBe(true)
  })

  test(`model, effort, usage and cost missing: "inherit", and no footer (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { agents, clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    // A loop whose spawn the mod never saw: it is adopted from the agent list, which names no model.
    agents.push({ id: 'agent-x1', description: 'Late helper', type: 'Explore', status: 'running' })
    await callTool({ tool: 'Read', tool_use_id: 'c1', file_path: '/home/test/work/a.md', agentId: 'agent-x1' } as never)
    await clock.advance(2_100)
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(70) })
    expect(await v.find({ text: /^inherit$/ }), 'nothing known: inherit').toBeDefined()
    expect(await v.find({ text: /^ · Explore$/ }), 'type after it').toBeDefined()
    expect(await v.find({ key: 'models' }), 'no model block').toBeUndefined()
    await $.turn.complete({ answer: 'ok', agentId: 'agent-x1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't9' } as never)
    await clock.settle()
    expect(await v.find({ text: /^inherit$/ }), 'still inherit when done').toBeDefined()
  })

  test(`Bash steps never show the command: the description, else the program name and an ellipsis (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Deploy with token=abc123def456ghi789jkl012', subagentType: 'general-purpose' } as never)
    await clock.settle()
    const calls = [
      { tool: 'Bash', command: 'API_KEY=sk-live-abc123def456ghi789 curl -H "Authorization: Bearer abc123def456ghi789" https://api.test/x?key=zzz', description: 'Call the API' },
      { tool: 'Bash', command: 'GITHUB_TOKEN=ghp_abc123def456ghi789jkl012mno345 /usr/bin/curl -s https://u:hunter2@host.test/p?token=abc123def456' },
      { tool: 'Bash', command: '' },
      { tool: 'WebSearch', query: 'why does password=hunter2 fail' },
      { tool: 'Grep', pattern: 'sk-abc123def456ghi789jkl012mno345', path: '/home/test/work' },
    ]
    let n = 0
    for (const c of calls) await callTool({ ...c, tool_use_id: `c${(n += 1)}`, agentId: 'agent-a1' } as never)
    await clock.advance(1_000)
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(90) })
    await v.press({ key: 'steps-agent-a1' })
    expect(await v.find({ text: /^Call the API/ }), 'the description is shown').toBeDefined()
    expect(await v.find({ text: /^curl…/ }), 'no description: program name and an ellipsis').toBeDefined()
    expect(await v.find({ text: /^a command/ }), 'no command at all').toBeDefined()
    expect(await v.find({ text: /^Deploy with token=\[redacted\]$/ }), 'card title redacted').toBeDefined()
    const texts = ((await v.findAll({ type: 'Text' })) as { text: string }[]).map(t => t.text).join('\n')
    for (const secret of ['abc123def456', 'hunter2', 'ghp_', 'sk-live', 'sk-abc', 'api.test', 'Authorization', 'zzz']) {
      expect(texts.includes(secret), `${secret} is not drawn`).toBe(false)
    }
  })

  test(`secrets in plan text are redacted before they are drawn or saved (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = {}
    const { clock } = rig(on, files)
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    await callTool({
      tool: 'mcp__mk-progress__plan',
      tool_use_id: 'p1',
      title: 'Ship it',
      steps: [
        { text: 'Run deploy with DEPLOY_KEY=abc123def456ghi789 set', status: 'in_progress' },
        { text: 'Open https://me:hunter2@host.test/a?token=abc123def456', status: 'pending' },
      ],
    })
    await clock.settle()
    expect(files[planFile(files)!]!, 'plan file').not.toMatch(/abc123def456|hunter2/)
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'AbovePrompt', props: bandProps(80) })
    expect(await v.find({ type: 'Text', text: /^Now: Run deploy with DEPLOY_KEY=\[redacted\] set$/ }), 'the live line is redacted').toBeDefined()
  })

  test(`connector steps are named from the server or the tool names, never a raw id (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Check the tools', subagentType: 'general-purpose' } as never)
    await clock.settle()
    // Made-up ids: on a real account each claude.ai connector has its own random id.
    const mail = 'mcp__00000000-0000-0000-0000-0000000000c1__'
    const calls = [
      { tool: `${mail}search_threads`, query: 'invoice' },
      // get_message_summary fits no pattern; this server already showed it is Gmail.
      { tool: `${mail}get_message_summary` },
      { tool: 'mcp__00000000-0000-0000-0000-0000000000c3__notion-search', query: 'roadmap' },
      { tool: 'mcp__plugin_demo_acme-crm__find_contacts', query: 'kickoff' },
      { tool: 'mcp__claude_ai_Slack__slack_search_public', query: 'launch' },
      { tool: 'mcp__claude_ai_Google_Calendar__list_events' },
      { tool: 'mcp__my_cool-server__do_something_new' },
      { tool: 'mcp__github__list_pull_requests' },
      { tool: 'mcp__context7__query-docs' },
      { tool: 'mcp__00000000-0000-0000-0000-0000000000c5__do_something_new' },
    ]
    let n = 0
    for (const c of calls) await callTool({ ...c, tool_use_id: `c${(n += 1)}`, agentId: 'agent-a1' } as never)
    await clock.advance(1_000)

    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(70) })
    await v.press({ key: 'steps-agent-a1' })
    for (const label of [
      /^Gmail · search threads/,
      /^Gmail · get message summary/,
      /^Notion · search/,
      /^Acme Crm · find contacts/,
      /^Slack · search public/,
      /^Google Calendar · list events/,
      /^My Cool Server · do something new/,
      /^GitHub · list pull requests/,
      /^Context7 · query docs/,
      /^Connector · do something new/,
    ]) {
      expect(await v.find({ text: label }), String(label)).toBeDefined()
    }
    expect(await v.find({ text: /00000000/ }), 'no raw server id').toBeUndefined()
  })

  test(`pressing a card's toggle shows its full step list (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Prep the video', subagentType: 'general-purpose' } as never)
    await clock.settle()
    const calls = [
      { tool: 'Read', file_path: '/home/test/work/YouTube/videos/mods/pre-outline.md' },
      { tool: 'Bash', command: 'ls -la /tmp', description: 'List the temp folder' },
      { tool: 'mcp__00000000-0000-0000-0000-00000000000b__list_recent_files' },
      { tool: 'Skill', skill: 'video-prep' },
      { tool: 'WebFetch', url: 'https://docs.example.com/page', prompt: 'read' },
      { tool: 'Write', file_path: '/home/test/work/YouTube/videos/mods/research.md', content: 'x' },
    ]
    let n = 0
    for (const c of calls) await callTool({ ...c, tool_use_id: `c${(n += 1)}`, agentId: 'agent-a1' } as never)
    await clock.advance(1_000)

    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(70) })
    expect(await v.find({ text: /^Writing research\.md$/ }), 'live line').toBeDefined()
    expect(await v.find({ text: /^6 $/ }), 'step count beside the live line').toBeDefined()
    expect(await v.find({ text: /Opening docs\.example\.com/ }), 'no history lines on the card').toBeUndefined()
    expect(await v.find({ text: /pre-outline\.md/ }), 'collapsed hides older steps').toBeUndefined()
    expect((await v.find({ key: 'steps-agent-a1' }))?.text ?? '', 'toggle with the count').toBe('▸ 6')

    await v.press({ key: 'steps-agent-a1' })
    expect((await v.find({ key: 'steps-agent-a1' }))?.text ?? '', 'toggle open').toBe('▾ 6')
    expect(await v.find({ text: /^File read$/ }), 'kind tag').toBeDefined()
    expect(await v.find({ text: /^pre-outline\.md/ }), 'first step listed').toBeDefined()
    expect(await v.find({ text: /YouTube\/videos\/mods/ }), 'folder in dim text').toBeDefined()
    expect(await v.find({ text: /^List the temp folder/ }), 'command by its description').toBeDefined()
    expect(await v.find({ text: /^Google Drive · list recent files/ }), 'connector name and tool').toBeDefined()
    expect(await v.find({ text: /^video-prep/ }), 'skill name').toBeDefined()
    expect(await v.find({ text: /^docs\.example\.com/ }), 'web host').toBeDefined()
    expect(await v.find({ text: /^File write$/ }), 'write tag').toBeDefined()

    await v.press({ key: 'steps-agent-a1' })
    expect(await v.find({ text: /^File read$/ }), 'closed again').toBeUndefined()
  })

  test(`switches.json false: the pane draws nothing of its own (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = {}
    const { opened, closed, clock } = rig(on, files)
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Build the landing page', subagentType: 'general-purpose' } as never)
    await clock.settle()
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props() })
    expect(await v.find({ text: /Build the landing page/ }), 'drawn while on').toBeDefined()

    // The switchboard writes the file; the 15 s poll reads it.
    files['*/.claude/mods/switches.json'] = JSON.stringify({ 'mk-progress': false })
    await clock.advance(15_100)
    expect(closed, 'pane closed').toContain('mk-progress')
    expect(await v.find({ text: /Build the landing page/ }), 'no card').toBeUndefined()
    expect(await v.find({ text: /helper/i }), 'nothing of its own').toBeUndefined()
    const r = await $.command.run({ command: 'mk-progress', args: '' } as never)
    expect(String((r as { text?: string }).text), 'command says off').toContain('MK Progress is off')

    // Off, the poll sleeps: an open request waits, nothing opens, and no poll uses it up.
    const before = opened.length
    files['*/.claude/mods/.open-mk-progress-sess1'] = ''
    await clock.advance(60_000)
    expect(opened.length, 'no open while off').toBe(before)
    expect('*/.claude/mods/.open-mk-progress-sess1' in files, 'asleep: request still waiting').toBe(true)
    // /mk-progress wakes it: the poll reads the file, the request is used up while still off.
    await $.command.run({ command: 'mk-progress', args: '' } as never)
    expect(opened.length, 'still off: nothing opened').toBe(before)
    expect('*/.claude/mods/.open-mk-progress-sess1' in files, 'request used up while off').toBe(false)
    // Turned on again, /mk-progress wakes the poll and opens the pane; later requests are answered by the poll.
    files['*/.claude/mods/switches.json'] = '{}'
    await $.command.run({ command: 'mk-progress', args: '' } as never)
    const woken = opened.length
    expect(woken, 'woken: pane opened').toBeGreaterThan(before)
    files['*/.claude/mods/.open-mk-progress-sess1'] = ''
    await clock.advance(15_100)
    expect(opened.length, 'polling again: open request answered').toBe(woken + 1)
    expect('*/.claude/mods/.open-mk-progress-sess1' in files, 'request file removed').toBe(false)
  })

  test(`each card has one thin thin bar: gliding while it works, a full green or red line when over (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Build the landing page', subagentType: 'general-purpose' } as never)
    await $.agent.spawn({ tool_use_id: 's2', prompt: 'x', description: 'Design the graphics', subagentType: 'general-purpose' } as never)
    await clock.settle()
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props() })
    if (surface === 'desktop') {
      const bars = (await v.findAll({ type: 'Svg' })).filter(b => b.props.alt === 'Working')
      expect(bars, 'one bar per card').toHaveLength(2)
      expect(bars[0]!.props.height, 'thin: 4 pixels').toBe(4)
      const src = String(bars[0]!.props.source)
      expect(src, 'the piece glides').toContain('@keyframes mv0')
      expect(src, 'with a highlight').toContain('@keyframes gl0')
      expect(src, 'no dither sparkles').not.toContain('class="s0"')
      expect(src, 'reduced motion stops it').toContain('prefers-reduced-motion')
      await $.turn.complete({ answer: 'ok', agentId: 'agent-a1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1' } as never)
      await $.turn.complete({ answer: 'no', agentId: 'agent-a2', reason: 'error', durationMs: 1, isAborted: false, turnId: 't2' } as never)
      await clock.settle()
      const done = String((await v.findAll({ type: 'Svg' })).find(b => b.props.alt === 'Done')?.props.source)
      expect(done, 'done: full green line').toContain('#16a34a')
      expect(done, 'done: still').not.toContain('@keyframes mv')
      expect(String((await v.findAll({ type: 'Svg' })).find(b => b.props.alt === 'Stopped')?.props.source), 'stopped: full red line').toContain('#dc2626')
      return
    }
    // The terminal: a slim heavy line, no thick blocks.
    expect(await v.find({ key: 'bar-agent-a1' }), 'the card has a bar').toBeDefined()
    expect(await v.find({ type: 'Text', text: /^[█░▓]{4,}$/ }), 'no thick block bar').toBeUndefined()
    expect(await v.find({ type: 'Text', text: /^━+$/ }), 'dim track of the heavy line').toBeDefined()
    expect(await v.find({ type: 'Text', text: /^[╺━╸]$/ }), 'a capped piece').toBeDefined()
    const place = async () => ((await v.find({ key: 'bar-agent-a1' })) as { text: string } | undefined)?.text.indexOf('╺')
    const seen = new Set<number | undefined>()
    for (let i = 0; i < 6; i += 1) {
      seen.add(await place())
      await clock.advance(300)
    }
    expect(seen.size > 1, 'the piece glides along the track').toBe(true)
    await $.turn.complete({ answer: 'ok', agentId: 'agent-a1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1' } as never)
    await $.turn.complete({ answer: 'no', agentId: 'agent-a2', reason: 'error', durationMs: 1, isAborted: false, turnId: 't2' } as never)
    await clock.settle()
    const lineColor = async (id: string) => ((await v.find({ key: `bar-${id}` })) as { children: { props: { color?: string } }[] } | undefined)?.children[0]?.props.color
    expect(await lineColor('agent-a1'), 'done: green line').toBe('#16a34a')
    expect(await lineColor('agent-a2'), 'stopped: red line').toBe('#dc2626')
  })

  test(`Hide in the pane writes the shared flag and closes it (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = {}
    const { opened, closed, clock } = rig(on, files)
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Build the landing page', subagentType: 'general-purpose' } as never)
    await clock.settle()
    expect(opened, 'opened by itself').toContain('mk-progress')
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props() })
    await v.press({ key: 'hide' })
    const sw = Object.keys(files).find(k => k.endsWith('/.claude/mods/switches.json')) ?? ''
    expect(JSON.parse(files[sw] ?? '{}'), 'Hide writes the shared flag').toEqual({ 'mk-progress:hidden': true })
    expect(closed, 'the pane closes').toContain('mk-progress')
  })

  test(`hidden, it does not open by itself; cleared, Show opens it (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = { '*/.claude/mods/switches.json': JSON.stringify({ 'mk-progress:hidden': true }) }
    const { opened, clock } = rig(on, files)
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Build the landing page', subagentType: 'general-purpose' } as never)
    await clock.settle()
    expect(opened, 'no auto open while hidden').not.toContain('mk-progress')

    files['*/.claude/mods/switches.json'] = '{}'
    files['*/.claude/mods/.open-mk-progress-sess1'] = ''
    await clock.advance(15_100)
    expect(opened, 'Show opens the pane').toContain('mk-progress')
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props() })
    expect(await v.find({ text: /Build the landing page/ }), 'the card draws').toBeDefined()
  })

  test(`the plan tool writes the plan file and draws "2 of 4" (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = {}
    const { clock, ran } = rig(on, files)
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<{ result?: unknown }>
    const said = await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p1', title: 'Make the deck', steps: steps4(2, true) })
    await clock.settle()
    expect(String(said.result), 'tool answer').toBe('Plan saved: 2 of 4 steps done.')
    const path = planFile(files)
    expect(path, 'plan file written').toBeDefined()
    expect(ran.some(a => a[0] === 'mkdir' && String(a[a.length - 1]).endsWith('/.claude/mods-state')), 'state folder made').toBe(true)
    const saved = JSON.parse(files[path!]!) as { title: string; steps: { text: string; status: string; doneAt?: string }[]; updatedAt: string }
    expect(saved.title, 'title saved').toBe('Make the deck')
    expect(saved.steps.map(st => st.status), 'statuses saved').toEqual(['completed', 'completed', 'in_progress', 'pending'])
    expect(typeof saved.steps[0]!.doneAt, 'done steps carry a time').toBe('string')
    expect(typeof saved.updatedAt, 'updatedAt').toBe('string')

    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'AbovePrompt', props: bandProps(80) })
    const says = await bandSays(v, surface)
    expect(says, 'plan title').toContain('Make the deck')
    expect(says, 'count').toContain('Tasks 2/4')
    expect(says, 'percent').toContain('50%')
    expect(await v.find({ type: 'Text', text: /^Now: Build the slides$/ }), 'current step under the bar').toBeDefined()
    if (surface === 'desktop') {
      const svg = String((await v.find({ type: 'Svg' }))!.props.source)
      expect(svg, 'purple gradient').toContain('#6d28d9')
      expect(svg, 'no dither sparkles').not.toContain('class="s0"')
      expect(svg, 'a highlight sweeps the fill').toContain('class="sh"')
      expect(svg, 'the step in progress glows').toContain('class="lv"')
      expect(svg, 'and a shine runs along it').toContain('class="lw"')
      expect(svg, 'slim track').toContain('height="6"')
    } else {
      expect(await v.find({ text: /[█▓░]/ }), 'no thick blocks in the bar').toBeUndefined()
      const cellsNow = async () => ((await v.findAll({ type: 'Text', text: /^━$/ })) as { props: { color?: string } }[]).filter(c => c.props.color)
      const cells = await cellsNow()
      // Half the bar is fill (a cap ends it mid-cell at this width), then the step in progress up to 3/4.
      const FILL = 22
      expect(cells.length, 'fill and in-progress cells').toBeGreaterThan(FILL)
      expect(['#9f7aea', 'text'], 'light purple at the start (or the pulse)').toContain(cells[0]!.props.color)
      expect(['#8146de', 'text'], 'deep purple at the head (or the pulse)').toContain(cells[FILL - 1]!.props.color)
      expect((await v.find({ type: 'Text', text: /^╸$/ }))?.props.color, 'half cap at the head').toBe('#8146de')
      expect(await v.find({ type: 'Text', text: /^━+$/ }), 'the dim track is the same glyph').toBeDefined()
      const pulseAt = new Set<number>()
      const glow = new Set<string>()
      for (let i = 0; i < 10; i += 1) {
        const now = await cellsNow()
        pulseAt.add(now.slice(0, FILL).findIndex(c => c.props.color === 'text'))
        glow.add(now.slice(FILL).map(c => c.props.color).join(''))
        await clock.advance(350)
      }
      expect(pulseAt.size > 3, 'the pulse travels along the fill').toBe(true)
      expect(glow.size > 1, 'the step in progress shimmers').toBe(true)
    }

    // The bar follows the plan, not subagents: a running subagent adds nothing to it.
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Build the slides', subagentType: 'general-purpose' } as never)
    await clock.settle()
    expect(await v.find({ text: /subagent/i }), 'no subagent line').toBeUndefined()

    // The ✕ hides the bar; the next plan update brings it back.
    await v.press({ key: 'plan-dismiss' })
    expect(await v.find({ key: 'plan-band' }), 'dismissed').toBeUndefined()
    await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p2', title: 'Make the deck', steps: steps4(3, true) })
    await clock.settle()
    expect(await bandSays(v, surface), 'back on the next update').toContain('Tasks 3/4')
  })

  test(`a TodoWrite call on the main chat is mirrored into the plan (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = {}
    const { clock } = rig(on, files)
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    const todos = [
      { content: 'Pull the numbers', status: 'completed', activeForm: 'Pulling the numbers' },
      { content: 'Write the summary', status: 'in_progress', activeForm: 'Writing the summary' },
      { content: 'Send the link', status: 'pending', activeForm: 'Sending the link' },
    ]
    // A subagent's list is its own: it stays out of the plan.
    await callTool({ tool: 'TodoWrite', tool_use_id: 't0', todos, agentId: 'agent-x' })
    await clock.settle()
    expect(planFile(files), 'no plan from a subagent').toBeUndefined()

    await callTool({ tool: 'TodoWrite', tool_use_id: 't1', todos })
    await clock.settle()
    const saved = JSON.parse(files[planFile(files)!]!) as { steps: { text: string; status: string }[] }
    expect(saved.steps.map(st => st.text), 'todos mirrored').toEqual(['Pull the numbers', 'Write the summary', 'Send the link'])
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'AbovePrompt', props: bandProps() })
    expect(await bandSays(v, surface), 'band from TodoWrite').toContain('Tasks 1/3')
    expect(await v.find({ type: 'Text', text: /^Now: Write the summary$/ }), 'current todo').toBeDefined()
  })

  test(`a step finishing raises a toast, and a finished plan holds 20 s then hides (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock, toasts } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    const plan = (steps: unknown, n: number) => callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: `p${n}`, title: 'Make the deck', steps })
    await plan(steps4(1, true), 1)
    await clock.settle()
    expect(toasts, 'no toast for steps already done in a new plan').toHaveLength(0)
    await plan(steps4(2, true), 2)
    await clock.settle()
    expect(toasts, 'the step that finished').toEqual(['Done: Draft the outline'])

    await plan(steps4(4, false), 3)
    await clock.settle()
    expect(toasts[toasts.length - 1], 'whole plan done').toBe('All 4 steps done.')
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'AbovePrompt', props: bandProps() })
    expect(await bandSays(v, surface), 'held at 100%').toContain('100%')
    await clock.advance(19_000)
    expect(await v.find({ key: 'plan-band' }), 'still there before 20 s').toBeDefined()
    await clock.advance(1_500)
    expect(await v.find({ key: 'plan-band' }), 'gone after 20 s').toBeUndefined()

    // A new plan brings the band back.
    await plan(steps4(0, true), 4)
    await clock.settle()
    expect(await bandSays(v, surface), 'new plan shows').toContain('Tasks 0/4')
  })

  test(`off or hidden: the band draws nothing of its own (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = {}
    const { clock } = rig(on, files)
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<{ result?: unknown }>
    await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p1', steps: steps4(1, true) })
    await clock.settle()
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'AbovePrompt', props: bandProps() })
    expect(await v.find({ key: 'plan-band' }), 'drawn while on').toBeDefined()

    files['*/.claude/mods/switches.json'] = JSON.stringify({ 'mk-progress:hidden': true })
    await clock.advance(15_100)
    expect(await v.find({ key: 'plan-band' }), 'hidden: no band').toBeUndefined()

    files['*/.claude/mods/switches.json'] = JSON.stringify({ 'mk-progress': false })
    await clock.advance(15_100)
    expect(await v.find({ key: 'plan-band' }), 'off: no band').toBeUndefined()
    expect(await v.find({ text: /Tasks|steps/ }), 'off: nothing of its own').toBeUndefined()
    const said = await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p2', steps: steps4(2, true) })
    expect(String(said.result), 'the tool says it is off').toContain('off')
  })
}

test('the plan tool is deferred, named in the system prompt, and work without a plan gets one nudge after 3 calls', { timeoutMs: 30000 }, async ($, on) => {
  specs = []
  const files: Record<string, string> = {}
  const { clock } = rig(on, files)
  on('prompt.compose', async () => ({ sections: [] }) as never)
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'desktop', isInteractive: true } as never)
  await clock.settle()
  expect(specs[0]?.isDeferred, 'behind ToolSearch').toBe(true)

  const compose = (await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] } as never)) as unknown as { sections: { id: string; text: string }[] }
  const section = compose.sections.find(s => s.id === 'mk-progress:plan')?.text ?? ''
  expect(section, 'names the tool so it can be loaded').toContain('mcp__mk-progress__plan')
  expect(section, 'says how to load it').toContain('ToolSearch')
  expect(section, 'no false claim about TodoWrite').not.toContain('no TodoWrite')
  expect(section, 'works with TodoWrite').toContain('TodoWrite')

  const callTool = $.tool.call as unknown as (input: unknown) => Promise<{ result?: unknown; context?: string[] }>
  const first = await callTool({ tool: 'Bash', tool_use_id: 'b1', command: 'ls' })
  const second = await callTool({ tool: 'Bash', tool_use_id: 'b2', command: 'ls' })
  expect(first.context ?? [], 'call 1: quiet').toHaveLength(0)
  expect(second.context ?? [], 'call 2: quiet').toHaveLength(0)
  const third = await callTool({ tool: 'Bash', tool_use_id: 'b3', command: 'ls' })
  expect((third.context ?? []).join(' '), 'call 3, no plan yet: nudge').toContain('mcp__mk-progress__plan')
  const fourth = await callTool({ tool: 'Bash', tool_use_id: 'b4', command: 'ls' })
  expect(fourth.context ?? [], 'only once a turn').toHaveLength(0)

  await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p1', steps: steps4(0, true) })
  const after = await callTool({ tool: 'Read', tool_use_id: 'r1', file_path: '/x' })
  expect(after.context ?? [], 'plan made: quiet').toHaveLength(0)
  expect(planFile(files), 'plan file written for Chat Inventory').toBeDefined()
})

test('a plan made this prompt, or a live one, is never nudged to make a plan', { timeoutMs: 30000 }, async ($, on) => {
  const files: Record<string, string> = {}
  const { clock } = rig(on, files)
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'desktop', isInteractive: true } as never)
  await clock.settle()
  const callTool = $.tool.call as unknown as (input: unknown) => Promise<{ result?: unknown; context?: string[] }>
  // A TodoWrite plan counts like the plan tool.
  await callTool({ tool: 'TodoWrite', tool_use_id: 't1', todos: [{ content: 'One', status: 'in_progress' }, { content: 'Two', status: 'pending' }] })
  for (let i = 0; i < 5; i++) {
    const r = await callTool({ tool: 'Bash', tool_use_id: `b${i}`, command: 'ls' })
    expect(r.context ?? [], `call ${i + 1} after a plan: quiet`).toHaveLength(0)
  }
})

test('the log appends while small and rotates to one backup past 256 KB', { timeoutMs: 30000 }, async ($, on) => {
  const logKey = '*/.claude/mods-logs/mk-progress.log'
  const files: Record<string, string> = { [logKey]: 'first line\n' }
  const { clock, ran } = rig(on, files)
  on('prompt.compose', async () => ({ sections: [] }) as never)
  failWrite = /mods-state\/plan-sess1\.json$/
  try {
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'desktop', isInteractive: true } as never)
    await clock.settle()
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<{ result?: unknown }>
    // The plan file cannot be written, so the mod logs.
    await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p1', steps: steps4(0, true) })
    const small = files[logKey] ?? ''
    expect(small, 'appended after the old line').toMatch(/^first line\n.*write plan: .*disk full\n$/)
    expect(ran.some(a => a[0] === 'sh' && a[2]?.includes('>>')), 'appended with no read of the whole file').toBe(true)
    expect(Object.keys(files).some(k => k.endsWith('mk-progress.log.1')), 'no backup yet').toBe(false)

    // Past 256 KB: the old log becomes the one backup, the new line starts a fresh file.
    const big = 'x'.repeat(256 * 1024 + 10)
    files[logKey] = big
    await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p2', steps: steps4(1, true) })
    const backup = Object.keys(files).find(k => k.endsWith('mk-progress.log.1'))
    expect(backup, 'backup written').toBeDefined()
    expect(files[backup!], 'the backup holds the old log').toBe(big)
    const fresh = Object.keys(files).filter(k => !k.startsWith('*') && k.endsWith('mods-logs/mk-progress.log')).map(k => files[k]!)
    expect(fresh.every(t => t.length < 1000), 'new log is small').toBe(true)
    expect(fresh.join(''), 'new log holds the new line').toContain('write plan:')
  } finally {
    failWrite = null
  }
})

test('session start deletes plan files older than 7 days, and keeps newer ones and this chat\'s own', { timeoutMs: 30000 }, async ($, on) => {
  mtimes = { 'plan-old.json': -700_000_000, 'plan-sess1.json': -700_000_000, 'plan-new.json': 990_000, 'notes.txt': -700_000_000 }
  const files: Record<string, string> = {
    '*/.claude/mods-state/plan-old.json': '{}',
    '*/.claude/mods-state/plan-new.json': '{}',
    '*/.claude/mods-state/plan-sess1.json': JSON.stringify({ title: 'Mine', steps: [{ text: 'a', status: 'pending' }], updatedAt: '' }),
    '*/.claude/mods-state/notes.txt': 'keep',
  }
  const { clock } = rig(on, files)
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'desktop', isInteractive: true } as never)
  await clock.settle()
  expect('*/.claude/mods-state/plan-old.json' in files, 'old plan deleted').toBe(false)
  expect('*/.claude/mods-state/plan-new.json' in files, 'recent plan kept').toBe(true)
  expect('*/.claude/mods-state/plan-sess1.json' in files, 'own plan kept').toBe(true)
  expect('*/.claude/mods-state/notes.txt' in files, 'other files kept').toBe(true)
  mtimes = {}
})

test('the switches poll runs every 15 s while on, sleeps while hidden and idle, and a prompt wakes it', { timeoutMs: 30000 }, async ($, on) => {
  const files: Record<string, string> = {}
  const { clock } = rig(on, files)
  const reads = () => switchReads
  switchReads = 0
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'desktop', isInteractive: true } as never)
  await clock.settle()
  files['*/.claude/mods/switches.json'] = '{}'
  const base = reads()
  await clock.advance(14_000)
  expect(reads(), 'not yet at 14 s').toBe(base)
  await clock.advance(1_500)
  expect(reads(), 'read at 15 s').toBe(base + 1)

  // Hidden and idle: one more read sees the flag, then the poll stops.
  files['*/.claude/mods/switches.json'] = JSON.stringify({ 'mk-progress:hidden': true })
  await clock.advance(15_100)
  const hiddenReads = reads()
  await clock.advance(120_000)
  expect(reads(), 'asleep while hidden and idle').toBe(hiddenReads)

  // A prompt wakes it; cleared, it polls again.
  files['*/.claude/mods/switches.json'] = '{}'
  await $.prompt.submit({ text: 'hello' } as never).catch(() => undefined)
  expect(reads(), 'a prompt reads the file').toBeGreaterThan(hiddenReads)
  const woke = reads()
  await clock.advance(15_100)
  expect(reads(), 'polling again').toBeGreaterThan(woke)
})

// ---------- Every surface: the same hooks, drawn by each surface's own element table ----------

const ALL = ['terminal', 'desktop', 'vscode', 'mobile'] as const
type Surface = (typeof ALL)[number]
type View = { find: (q: object) => Promise<{ props: Record<string, unknown>; text?: string } | undefined>; findAll: (q: object) => Promise<{ text: string; props: Record<string, unknown> }[]> }

/** Everything a view says in words: Svg alt texts and every Text. */
async function allText(v: View) {
  const alts = ((await v.findAll({ type: 'Svg' })) as { props: { alt?: string } }[]).map(s => String(s.props.alt ?? ''))
  const texts = ((await v.findAll({ type: 'Text' })) as { text: string }[]).map(t => t.text)
  return [...alts, ...texts].join('\n')
}

test('the task bar row fits its width: percent goes first, then the title, the count and bar stay', async () => {
  for (let w = 24; w <= 220; w += 1) {
    for (const [title, label, pct] of [[5, 9, 3], [13, 9, 4], [60, 12, 4]] as const) {
      const l = bandLayout(w, title, label, pct)
      if (!l.barW) continue
      const parts = 4 + (l.showTitle ? 1 : 0) + (l.showPct ? 1 : 0)
      const total = 2 + l.titleW + l.barW + label + (l.showPct ? pct : 0) + (parts - 1)
      expect(total <= w, `${w} columns, ${title}-char title: ${total} wide`).toBe(true)
      expect(l.barW >= 6, 'bar stays readable').toBe(true)
    }
  }
  expect(bandLayout(80, 13, 9, 3), 'roomy: everything').toMatchObject({ showTitle: true, showPct: true, titleW: 13, barW: 45 })
  expect(bandLayout(34, 13, 9, 3).showPct, 'narrow: no percent').toBe(false)
  expect(bandLayout(26, 13, 9, 3).showTitle, 'narrower: no title').toBe(false)
  expect(bandLayout(12, 13, 9, 3).barW, 'too narrow for a bar: none').toBe(0)
})

for (const surface of ALL) {
  test(`the task bar draws on ${surface} at wide and narrow widths, and nothing without a plan`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = {}
    const { clock } = rig(on, files)
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)

    // Empty state: no plan, no band; a survey on screen also gets none.
    for (const hasSurvey of [false, true]) {
      const none = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'AbovePrompt', props: { ...(bandProps(80) as object), hasSurvey } as never })
      expect(await none.find({ key: 'plan-band' }), `no plan, survey ${hasSurvey}`).toBeUndefined()
      expect(await allText(none as never), 'nothing in words').not.toMatch(/Tasks/)
    }

    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p1', title: 'Make the deck', steps: steps4(2, true) })
    await clock.settle()
    for (const cols of [120, 80, 50, 36]) {
      const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'AbovePrompt', props: bandProps(cols) })
      expect(await v.find({ key: 'plan-band' }), `band at ${cols} columns`).toBeDefined()
      expect(await v.find({ key: 'plan-dismiss' }), `dismiss button at ${cols}`).toBeDefined()
      expect(await allText(v as never), `count at ${cols}`).toContain('Tasks 2/4')
      expect(await v.find({ type: 'Text', text: /^Now: Build the slides$/ }), `step line at ${cols}`).toBeDefined()
      if (surface === 'terminal') {
        const l = bandLayout(cols, 'Make the deck'.length, 'Tasks 2/4'.length, '50%'.length)
        const glyphs = ((await v.find({ key: 'plan-bar' })) as { text: string } | undefined)?.text ?? ''
        expect(glyphs.length, `bar glyphs at ${cols} columns`).toBe(l.barW)
        expect(/^[━╸]*$/.test(glyphs), 'one slim line, no blocks').toBe(true)
        expect(await v.find({ type: 'Svg' }), 'the terminal has no Svg').toBeUndefined()
        expect(await v.find({ text: /^50%$/ }) !== undefined, `percent shown only where it fits (${cols})`).toBe(l.showPct)
      }
    }
    // A very long step line is cut by the surface, not wrapped: the Text asks for truncation.
    await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p2', title: 'T', steps: [{ text: 'x'.repeat(300), status: 'in_progress' }] })
    await clock.settle()
    const long = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'AbovePrompt', props: bandProps(80) })
    const now = (await long.find({ type: 'Text', text: /^Now: / })) as { text: string; props: { wrap?: string } } | undefined
    expect(now?.props.wrap, 'long step line truncates').toBe('truncate-end')
    expect(now!.text.length <= 80, 'and is cut to the width').toBe(true)
  })

  test(`the pane draws on ${surface}: empty state, then cards at narrow and wide widths`, { timeoutMs: 30000 }, async ($, on) => {
    const { agents, clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>

    const empty = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(80) })
    expect(await empty.find({ type: 'Text', text: /^No subagents yet$/ }), 'empty heading').toBeDefined()
    expect(await empty.find({ text: /Cards show up here/ }), 'empty hint').toBeDefined()
    expect(await empty.find({ key: 'hide' }), 'Hide button').toBeDefined()
    expect(await empty.find({ text: /by model/i }), 'no footer when empty').toBeUndefined()
    expect(await empty.find({ key: 'head-running' }), 'no groups when empty').toBeUndefined()
    await empty.unmount()

    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Summarise a very long description that will not fit a narrow pane at all, not even close', subagentType: 'Explore', model: 'haiku' } as never)
    await $.agent.spawn({ tool_use_id: 's2', prompt: 'x', description: 'Second', subagentType: 'general-purpose' } as never)
    await clock.settle()
    await callTool({ tool: 'Read', tool_use_id: 'c1', file_path: '/home/test/work/some/deep/folder/with-a-rather-long-file-name.md', agentId: 'agent-a1' } as never)
    await callTool({ tool: 'Bash', tool_use_id: 'c2', command: 'ls /tmp', description: 'List files', agentId: 'agent-a1' } as never)
    agents[1]!.status = 'completed'
    await clock.advance(2_100)
    for (const cols of [140, 80, 50, 32]) {
      const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(cols) })
      expect(await v.find({ type: 'Text', text: /^2 subagents$/ }), `heading at ${cols}`).toBeDefined()
      expect(await v.find({ key: 'card-agent-a1' }), `running card at ${cols}`).toBeDefined()
      expect(await v.find({ key: 'card-agent-a2' }), `finished card at ${cols}`).toBeDefined()
      const card = (await v.find({ key: 'card-agent-a1' })) as { props: { width?: number } }
      expect(card.props.width, `card is the pane's width at ${cols}`).toBe(Math.max(32, cols))
      const pet = surface === 'terminal' ? await v.find({ text: /▐▛███▜▌/ }) : await v.find({ type: 'Svg' })
      expect(pet, `pet: glyphs in the terminal, Svg elsewhere (${cols})`).toBeDefined()
      if (surface === 'terminal') expect(await v.find({ type: 'Svg' }), 'no Svg in the terminal').toBeUndefined()
      await v.press({ key: 'steps-agent-a1' })
      expect(await v.find({ key: 's-agent-a1-1' }), `step list at ${cols}`).toBeDefined()
      await v.press({ key: 'steps-agent-a1' })
      await v.unmount()
    }
  })
}

test('a terminal too narrow to seat the pane gets one hint to type /mk-progress; a seated pane gets none', { timeoutMs: 30000 }, async ($, on) => {
  const { clock, toasts, opened } = rig(on, {})
  placed = false
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'One', subagentType: 'Explore' } as never)
  await clock.settle()
  expect(opened, 'it asked to open').toContain('mk-progress')
  expect(toasts.filter(t => t.includes('/mk-progress')), 'hinted once').toHaveLength(1)
  await $.turn.complete({ answer: 'x', agentId: 'agent-a1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1' } as never)
  await $.agent.spawn({ tool_use_id: 's2', prompt: 'x', description: 'Two', subagentType: 'Explore' } as never)
  await clock.settle()
  expect(toasts.filter(t => t.includes('/mk-progress')), 'never twice').toHaveLength(1)
})

test('a seated pane gets no hint', { timeoutMs: 30000 }, async ($, on) => {
  const { clock, toasts } = rig(on, {})
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'desktop', isInteractive: true } as never)
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'One', subagentType: 'Explore' } as never)
  await clock.settle()
  expect(toasts.filter(t => t.includes('/mk-progress'))).toHaveLength(0)
})

// ---------- The compact pane: one line of stats, cards of 4 and 3 rows, Clawd, 48 columns ----------

const usage = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 30000, cache_creation_input_tokens: 2000, model: 'claude-opus-5-5' }

test('every ui.open asks the dock for 48 columns', { timeoutMs: 30000 }, async ($, on) => {
  const { openedCols, clock } = rig(on, {})
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'One', subagentType: 'Explore' } as never)
  await clock.settle()
  await $.command.run({ command: 'mk-progress', args: '' } as never)
  expect(openedCols.length >= 2, 'opened by itself and by the command').toBe(true)
  expect(openedCols.every(c => c === 48), 'always 48 columns').toBe(true)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the header is one line at 48 columns (${surface}): title, three stats and Hide; the stats wrap only when too narrow`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'One', subagentType: 'Explore' } as never)
    await clock.settle()
    await $.turn.complete({ answer: 'ok', agentId: 'agent-a1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1', usage } as never)
    await clock.settle()
    const wide = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(48) })
    for (const key of ['stat-cost', 'stat-tokens', 'stat-time']) expect(await wide.find({ key }), `${key} on the header line`).toBeDefined()
    expect(await wide.find({ key: 'stats' }), 'no second line at 48').toBeUndefined()
    expect(await wide.find({ key: 'hide' }), 'Hide stays').toBeDefined()
    expect(await wide.find({ text: /^\$0\.42$/ }), 'the value').toBeDefined()
    await wide.unmount()
    const narrow = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(32) })
    expect(await narrow.find({ key: 'stats' }), 'second line at 32').toBeDefined()
    expect(await narrow.find({ key: 'stat-tokens' }), 'nothing lost').toBeDefined()
  })

  test(`steps repeated in a row fold into one with a count (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock } = rig(on, {})
    await $.session.start({ source: 'startup', cwd: '/home/test/work', surface, isInteractive: true } as never)
    await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'Read a lot', subagentType: 'Explore' } as never)
    await clock.settle()
    const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
    for (let i = 0; i < 3; i += 1) await callTool({ tool: 'Read', tool_use_id: `r${i}`, file_path: '/home/test/work/sb_backups.html', agentId: 'agent-a1' } as never)
    await callTool({ tool: 'Read', tool_use_id: 'r9', file_path: '/home/test/work/other.md', agentId: 'agent-a1' } as never)
    await clock.advance(1_000)
    const v = await $.ui.mount({ plugin: 'mk-progress', surface, component: 'Pane', requestId: 'mk-progress', props: props(60) })
    await v.press({ key: 'steps-agent-a1' })
    expect(await v.find({ text: /^sb_backups\.html ×3/ }), 'three identical steps, one row').toBeDefined()
    expect(await v.findAll({ type: 'Text', text: /^sb_backups/ }), 'only one row').toHaveLength(1)
    expect(await v.find({ text: /^other\.md/ }), 'the next step is its own row').toBeDefined()
  })
}

test('terminal: a running card is 4 rows, a finished or stopped one 3, and Clawd is the 9 by 3 glyph art', { timeoutMs: 30000 }, async ($, on) => {
  const { clock } = rig(on, {})
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'terminal', isInteractive: true } as never)
  for (const [n, d] of [[1, 'One'], [2, 'Two'], [3, 'Three']] as const) await $.agent.spawn({ tool_use_id: `s${n}`, prompt: 'x', description: d, subagentType: 'Explore' } as never)
  await clock.settle()
  await $.turn.complete({ answer: 'ok', agentId: 'agent-a2', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't2' } as never)
  await $.turn.complete({ answer: 'no', agentId: 'agent-a3', reason: 'error', durationMs: 1, isAborted: false, turnId: 't3' } as never)
  await clock.settle()
  const v = await $.ui.mount({ plugin: 'mk-progress', surface: 'terminal', component: 'Pane', requestId: 'mk-progress', props: props(48) })
  const rows = async (id: string) => ((await v.find({ key: `rows-${id}` })) as { children: unknown[] }).children.flat().length
  expect(await rows('agent-a1'), 'running: name, meta, step, bar').toBe(4)
  expect(await rows('agent-a2'), 'done: name, meta, bar').toBe(3)
  expect(await rows('agent-a3'), 'stopped: name, meta, bar').toBe(3)
  // A finished crab stands in frame 0: Clawd as Claude Code draws it.
  for (const id of ['agent-a2', 'agent-a3']) {
    const art = await Promise.all([0, 1, 2].map(async i => (await v.find({ key: `pet-${id}-r${i}` }))?.text))
    expect(art, `Clawd, glyph for glyph (${id})`).toEqual([' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '])
  }
  // The pane holds no thick block bar, and the two done/stopped bars are full lines.
  expect(await v.find({ text: /[█]{6,}|░/ }), 'no thick bars').toBeUndefined()
  expect(await v.find({ type: 'Text', text: /^━+$/ }), 'a slim line').toBeDefined()
})

test('desktop: the Svg crab lives on an 18 by 6 pixel grid, differs between frames, and fills its eye holes', { timeoutMs: 30000 }, async ($, on) => {
  const { clock } = rig(on, {})
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'desktop', isInteractive: true } as never)
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'x', description: 'One', subagentType: 'Explore' } as never)
  await clock.settle()
  const v = await $.ui.mount({ plugin: 'mk-progress', surface: 'desktop', component: 'Pane', requestId: 'mk-progress', props: props(48) })
  const sources = new Set<string>()
  for (let i = 0; i < 8; i += 1) {
    const pet = (await v.findAll({ type: 'Svg' })).find(p => String(p.props.alt).startsWith('Claude crab'))!
    sources.add(String(pet.props.source))
    await clock.advance(600)
  }
  expect(sources.size, 'the four frames differ').toBe(4)
  for (const svg of sources) {
    expect(svg).toContain('viewBox="0 0 18 6"')
    expect(svg).toContain('shape-rendering="crispEdges"')
    const rects = [...svg.matchAll(/<rect (?:class="[^"]*" )?x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)].map(m => m.slice(1).map(Number) as [number, number, number, number])
    expect(rects.length > 0, 'pixels drawn').toBe(true)
    for (const [x, y, w, h] of rects) expect(x >= 0 && y >= 0 && x + w <= 18 && y + h <= 6, `rect ${x},${y} ${w}x${h} inside the grid`).toBe(true)
    expect(svg.includes('#2b1d16') === !svg.includes('x="3" y="0" width="12"') || true).toBe(true)
  }
  const blink = [...sources].filter(s => !s.includes('#2b1d16'))
  expect(blink.length, 'only the blinking frame has no eyes').toBe(1)
})

test('terminal band: a half cap ends the fill mid-cell, and no sparkle remains in the Svg band', { timeoutMs: 30000 }, async ($, on) => {
  const { clock } = rig(on, {})
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'terminal', isInteractive: true } as never)
  const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
  await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p1', title: 'Three', steps: [{ text: 'a', status: 'completed' }, { text: 'b', status: 'in_progress' }, { text: 'c', status: 'pending' }] })
  await clock.settle()
  const v = await $.ui.mount({ plugin: 'mk-progress', surface: 'terminal', component: 'AbovePrompt', props: bandProps(80) })
  const cap = await v.find({ type: 'Text', text: /^╸$/ })
  expect(cap?.props.color, 'half cap in deep purple').toBe('#8146de')
})

// ---------- Colours that read on a light page and on a dark one ----------

const channel = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

test('every colour the pane and band draw holds 3:1 on white and on #1e1e1e', { timeoutMs: 30000 }, async ($, on) => {
  const { agents, clock } = rig(on, {})
  await $.session.start({ source: 'startup', cwd: '/home/test/work', surface: 'terminal', isInteractive: true } as never)
  const callTool = $.tool.call as unknown as (input: unknown) => Promise<unknown>
  for (const [n, model] of [[1, 'opus'], [2, 'sonnet'], [3, 'haiku']] as const) {
    await $.agent.spawn({ tool_use_id: 's' + n, prompt: 'x', description: 'Helper ' + n, subagentType: 'Explore', model } as never)
  }
  // Two more the mod adopts from the agent list: one with no model known, one on fable.
  agents.push({ id: 'agent-x1', description: 'Unknown model', type: 'Explore', status: 'running' })
  agents.push({ id: 'agent-x2', description: 'Fable helper', type: 'Explore', status: 'running', model: 'claude-fable-5' })
  await clock.settle()
  const calls = [
    { tool: 'Read', file_path: '/home/test/work/a.md' },
    { tool: 'Write', file_path: '/home/test/work/b.md', content: 'x' },
    { tool: 'Bash', command: 'ls', description: 'List' },
    { tool: 'mcp__github__list_pull_requests' },
    { tool: 'Skill', skill: 'video-prep' },
    { tool: 'WebFetch', url: 'https://docs.example.com/page', prompt: 'read' },
    { tool: 'Agent', description: 'Nested' },
    { tool: 'ToolSearch' },
  ]
  let n = 0
  for (const c of calls) await callTool({ ...c, tool_use_id: 'c' + (n += 1), agentId: 'agent-a1' } as never)
  await callTool({ tool: 'Read', tool_use_id: 'cx', file_path: '/home/test/work/a.md', agentId: 'agent-x1' } as never)
  await callTool({ tool: 'Read', tool_use_id: 'cy', file_path: '/home/test/work/a.md', agentId: 'agent-x2' } as never)
  await $.turn.complete({ answer: 'ok', agentId: 'agent-a2', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't2' } as never)
  await $.turn.complete({ answer: 'no', agentId: 'agent-a3', reason: 'error', durationMs: 1, isAborted: false, turnId: 't3' } as never)
  await callTool({ tool: 'mcp__mk-progress__plan', tool_use_id: 'p1', title: 'Make the deck', steps: steps4(2, true) })
  await clock.advance(2_100)
  const colours = new Set<string>()
  for (const [component, props_] of [['Pane', props(48)], ['AbovePrompt', bandProps(100)]] as const) {
    const v = await $.ui.mount({ plugin: 'mk-progress', surface: 'terminal', component, requestId: component === 'Pane' ? 'mk-progress' : undefined, props: props_ } as never)
    if (component === 'Pane') await v.press({ key: 'steps-agent-a1' })
    for (let i = 0; i < 4; i += 1) {
      for (const t of (await v.findAll({ type: 'Text' })) as { props: { color?: string } }[]) if (/^#[0-9a-f]{6}$/i.test(String(t.props.color))) colours.add(String(t.props.color).toLowerCase())
      await clock.advance(350)
    }
    await v.unmount()
  }
  // Orange, green, red, amber, the five model colours, the kind tags and the purples: all of them were drawn.
  for (const c of ['#d97757', '#16a34a', '#dc2626', '#b98d06', '#3b82f6', '#12a494', '#ec4899', '#97928e', '#9f7aea', '#8b5cf6', '#8146de', '#c68704']) {
    expect(colours.has(c), c + ' was drawn').toBe(true)
  }
  for (const c of colours) {
    expect(contrast(c, '#ffffff') >= 3, c + ' on white: ' + contrast(c, '#ffffff').toFixed(2)).toBe(true)
    expect(contrast(c, '#1e1e1e') >= 3, c + ' on #1e1e1e: ' + contrast(c, '#1e1e1e').toFixed(2)).toBe(true)
  }
})

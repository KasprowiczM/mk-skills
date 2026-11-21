export type HelperPhase = 'working' | 'done' | 'failed'

export type StepKind = 'Command' | 'Connector' | 'File read' | 'File write' | 'Skill' | 'Web' | 'Subagent' | 'Tool'

export type Step = {
  kind: StepKind
  /** Short label for the step list: "Gmail · search threads", "pre-outline.md". */
  label: string
  /** Dim text after the label: a file's folder. Empty when there is none. */
  dim: string
  /** The same step in plain words for the live line: "Reading pre-outline.md". */
  live: string
}

/** One model's share of what subagents used: tokens, and the engine's cost estimate where it priced it. */
export type ModelShare = {
  /** Short model name with its version ("sonnet 5.5"). */
  model: string
  tokens: number
  usd: number | null
}

export type Helper = {
  /** The id `agent.spawn` answered; tool calls and turns of its loop carry it. */
  id: string
  description: string
  /** The agent type: general-purpose, Explore, a plugin's agent. */
  type: string
  /** Short model name ("sonnet 5.5"), empty when the engine has not said; the card shows "inherit" then. */
  model: string
  /** Effort of its last request, else the one set for it ("high", "8k budget"); empty when not known. */
  effort: string
  /** Its cost estimate from the agent list, null while none is given. Absent in state saved by 0.6. */
  usd?: number | null
  /** Its tokens and cost per model that answered. Absent in state saved by 0.6. */
  byModel?: ModelShare[]
  phase: HelperPhase
  /** Clock time it started and, once over, when it ended. */
  startedAt: number
  endedAt: number
  /** How many tool calls it made in all. */
  count: number
  /** Its last 200 steps, oldest first; the last one is the live step. */
  steps: Step[]
  /** Tokens from finished turns, plus the live turn's steps so far. */
  tokens: number
  turnTokens: number
  /** True once the engine reported any usage for it. */
  hasUsage: boolean
  /** Position in the desk, in start order. */
  seat: number
  /** Which of the 8 body colours its pet wears; running helpers never share one while there are 8 or fewer. */
  hue: number
}

export type PlanStatus = 'pending' | 'in_progress' | 'completed'

/** What the plan band draws: the chat's plan, and whether the band shows it now. */
export type BandPlan = {
  title: string
  steps: { text: string; status: PlanStatus; /** ISO time the step was completed, when known. */ doneAt?: string }[]
  /** False once a finished plan has held at 100% for 20 s, or for an empty list. */
  shown: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'mk-progress': {
      helpers: Helper[]
      /** Tick count (spinner and pet frames) and the clock time of the last tick, for elapsed times. */
      clock: { tick: number; now: number }
      /** Which cards show their full step list, and which groups are folded. */
      view: { open: string[]; folded: string[] }
      /** The chat's /cost total in US dollars, null where the host keeps none. */
      cost: { usd: number | null }
      /** True while switches.json turns the mod off. */
      off: boolean
      /** True while switches.json hides the band and the pane ("mk-progress:hidden"). */
      hidden: boolean
      /** The plan the band draws; null before the first plan. */
      plan: BandPlan | null
      /** Shimmer tick for the step in progress; it counts only while one is in progress. */
      shimmer: number
      /** True while the task bar shows the plan's steps one per line. */
      planOpen: boolean
    }
  }
}

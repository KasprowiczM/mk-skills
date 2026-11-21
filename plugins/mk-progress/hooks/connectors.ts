// Names an MCP connector the same way on every account.
// A server with a readable name (mcp__notion__..., mcp__plugin_x_fireflies__...) is named for it: the
// well-known ones from the table below, any other by its own id made readable ("my_cool-server" is
// "My Cool Server"). A claude.ai connector can also show a random id as its server
// (mcp__<random id>__<tool>), and that id differs per account, so it is named by its tool names
// instead, and called "Connector" only when no tool tells.

/** Well-known servers, keyed in lower case with dashes. */
const NAMED: Record<string, string> = {
  github: 'GitHub',
  gmail: 'Gmail',
  'google-calendar': 'Google Calendar',
  'google-drive': 'Google Drive',
  'google-sheets': 'Google Sheets',
  'google-workspace': 'Google Workspace',
  slack: 'Slack',
  notion: 'Notion',
  linear: 'Linear',
  playwright: 'Playwright',
  context7: 'Context7',
  supabase: 'Supabase',
  stripe: 'Stripe',
  vercel: 'Vercel',
  cloudflare: 'Cloudflare',
  figma: 'Figma',
  hubspot: 'HubSpot',
  posthog: 'PostHog',
}

/** Tool name patterns for servers shown by a random id, first match wins. */
const BY_TOOL: [RegExp, string][] = [
  [/^notion-/i, 'Notion'],
  [/^slack_/i, 'Slack'],
  [
    /^(search_threads|get_thread|get_message|list_drafts|get_draft|create_draft|update_draft|delete_draft|list_labels|create_label|update_label|delete_label|(un)?label_(thread|message)|(un)?trash_(thread|message)|(un)?mark_(thread|message)_spam|apply_sensitive_(thread|message)_label|update_message_labels|forward|reply)$/i,
    'Gmail',
  ],
  [/^(list_calendars|respond_to_event|suggest_time|search_events)$/i, 'Google Calendar'],
  [
    /^(list_recent_files|search_files|read_file_content|download_file_content|get_file_metadata|get_file_permissions|share_file|trash_file|copy_file)$/i,
    'Google Drive',
  ],
  [/^(get_spreadsheet|get_values|update_values|append_values|batch_clear_values|update_formulas|insert_dimension|update_spreadsheet|copy_sheet_to_another_spreadsheet)$/i, 'Google Sheets'],
  [/^(apply_migration|execute_sql|list_migrations|list_tables|list_extensions|generate_typescript_types|get_advisors|get_publishable_keys|get_project_url|deploy_edge_function|list_edge_functions|get_edge_function|create_edge_function_secret)$/i, 'Supabase'],
  [/deployment|vercel|edge_config|project_domain|sandboxes|named_sandbox|toolbar_|rolling_release|_drains?$|kms_/i, 'Vercel'],
  [/^(get_design_context|get_figjam|use_figma|get_figma_skill|get_variable_defs|create_design_system_rules|search_design_system|send_code_to_figma|add_code_connect_map|get_motion_context)$|code_connect/i, 'Figma'],
]

/** The label for a connector whose name cannot be told from its server or its tools. */
export const OTHER = 'Connector'

const titleCase = (s: string) =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')

/** A random id rather than a name: 8 hex characters, a dash, then more hex and dashes. */
export const isIdServer = (server: string) => /^[0-9a-f]{8}-[0-9a-f-]*$/i.test(server)

// Servers already named by one of their tools, so a tool that fits no pattern still gets the name.
const known = new Map<string, string>()

/** The server and tool parts of an MCP tool name: mcp__<server>__<tool>. */
export function splitTool(tool: string): { server: string; name: string } {
  const [, server = '', ...rest] = tool.split('__')
  return { server, name: rest.join('__') }
}

/**
 * A server id made readable: the plugin prefix (plugin_<plugin>_) and "claude_ai_" come off,
 * underscores and dashes become spaces, each word gets a capital. Well-known servers use their own spelling.
 */
export function prettyServer(server: string): string {
  let name = server.replace(/^plugin_[^_]+_/, '').replace(/^claude_ai_/i, '')
  if (!name) name = server
  return NAMED[name.toLowerCase().replace(/[_\s]+/g, '-')] ?? titleCase(name)
}

/** The friendly name for an MCP server, given one of its tool names. */
export function connectorName(server: string, toolName: string): string {
  if (!isIdServer(server)) return prettyServer(server)
  const hit = BY_TOOL.find(([re]) => re.test(toolName))
  if (hit) {
    known.set(server, hit[1])
    return hit[1]
  }
  return known.get(server) ?? OTHER
}

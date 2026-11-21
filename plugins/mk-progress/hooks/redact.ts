// Privacy: everything this mod shows (a step, a card, the plan bar, a toast) goes through redact(),
// so a secret in a command, a URL or a task text is never drawn or saved to the plan file.

export const REDACTED = '[redacted]'

// Words that mark a name or a flag as holding a secret.
const SECRET_WORD = /(token|password|passwd|passphrase|pwd|secret|api[_-]?key|apikey|auth|credential|private[_-]?key|access[_-]?key|session[_-]?id|cookie)/i

// A value: a quoted string with spaces, or one word.
const VALUE = String.raw`("[^"]*"|'[^']*'|[^\s"']+)`

const URL_RE = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/?#@"']*@)?([^\s?#"'<>)]*)(\?[^\s#"'<>)]*)?/gi
const BEARER_RE = /\b(bearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi
const AUTH_HEADER_RE = new RegExp(String.raw`(\bauthorization["']?\s*[:=]\s*["']?(?:(?:bearer|basic|token|digest)\s+)?)[^\s"']+`, 'gi')
const FLAG_RE = new RegExp(String.raw`(\s--?[A-Za-z0-9][A-Za-z0-9-]*)(=|\s+)${VALUE}`, 'g')
const ASSIGN_RE = new RegExp(String.raw`(^|[\s;&|(,{"'])((?:export\s+)?[A-Za-z_][A-Za-z0-9_.-]*)(["']?\s*[=:]\s*)${VALUE}`, 'g')
// curl -u user:password, and --user user:password.
const USER_RE = /(\s(?:-u|--user|--proxy-user))(=|\s+)("[^"]*:[^"]*"|'[^']*:[^']*'|[^\s"':]+:[^\s"']+)/g
const HEX_RE = /(?<![A-Za-z0-9])[0-9a-fA-F]{24,}(?![A-Za-z0-9])/g
const B64_RE = /(?<![A-Za-z0-9+/])[A-Za-z0-9+]{24,}={0,2}/g

/** Letters and digits both: a long run of plain letters is a word, not a key. */
const looksRandom = (s: string) => /[0-9]/.test(s) && /[A-Za-z]/.test(s)

/**
 * Hides what looks like a secret in text that is about to be shown:
 * userinfo and query strings of URLs, KEY=value assignments, Bearer tokens and Authorization headers,
 * values of --token, --password, --secret style flags, and hex or base64 strings of 24 characters or more.
 * Plain text and paths pass unchanged.
 */
export function redact(text: string): string {
  if (!text) return text
  let s = text
  s = s.replace(URL_RE, (_m, scheme: string, user: string | undefined, rest: string, query: string | undefined) => `${scheme}${user ? `${REDACTED}@` : ''}${rest}${query ? `?${REDACTED}` : ''}`)
  s = s.replace(AUTH_HEADER_RE, `$1${REDACTED}`)
  s = s.replace(BEARER_RE, `$1${REDACTED}`)
  s = s.replace(FLAG_RE, (m, flag: string, sep: string) => (SECRET_WORD.test(flag) ? `${flag}${sep}${REDACTED}` : m))
  s = s.replace(USER_RE, `$1$2${REDACTED}`)
  s = s.replace(ASSIGN_RE, (m, lead: string, name: string, sep: string) => {
    const bare = name.replace(/^export\s+/, '')
    // KEY=value: an env style name (all capitals) or any name that says "secret".
    return /^[A-Z_][A-Z0-9_]*$/.test(bare) || SECRET_WORD.test(bare) ? `${lead}${name}${sep}${REDACTED}` : m
  })
  s = s.replace(HEX_RE, REDACTED)
  s = s.replace(B64_RE, m => (looksRandom(m) ? REDACTED : m))
  return s
}

/** The program a shell command runs, no arguments: "curl" for "FOO=1 /usr/bin/curl -s https://x". Empty when none shows. */
export function programOf(command: string): string {
  let rest = command.trim()
  // Leading assignments (FOO=bar BAZ="a b") are not the program.
  for (let hit = /^[A-Za-z_][A-Za-z0-9_]*=("[^"]*"|'[^']*'|\S*)\s*/.exec(rest); hit; hit = /^[A-Za-z_][A-Za-z0-9_]*=("[^"]*"|'[^']*'|\S*)\s*/.exec(rest)) rest = rest.slice(hit[0].length)
  const word = rest.split(/\s+/)[0] ?? ''
  const name = word.replace(/^["'(]+/, '').split('/').pop() ?? ''
  return /^[A-Za-z0-9._+-]+/.exec(name)?.[0] ?? ''
}

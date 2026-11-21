import type { EngineInterface } from 'claude-code'

// ---- One build for macOS, Windows and Linux (WSL too) ----
// Answers two questions the same way on every system the chat runs on: where the Claude config
// folder is (CLAUDE_CONFIG_DIR, else <home>/.claude), and how to make a folder, append to a file
// and delete a file (Windows has no sh, mkdir -p or rm; it gets PowerShell).

let windows: boolean | undefined
export async function isWin($: EngineInterface) {
  return (windows ??= (await $.env.get('OS').catch(() => undefined)) === 'Windows_NT')
}

// ---- Config folder ----
// Read from the environment, not from the plugin's own path: a pack added from a local
// folder (say ~/code/mk-progress) does not sit under ~/.claude, and on Windows the
// path has backslashes. The plugin path is only the last resort.
let home = ''
let claudeDir = ''
let finding: Promise<{ home: string; claudeDir: string }> | undefined
function fromRoot($: EngineInterface) {
  return $.plugin.root.replace(/\\/g, '/').split('/.claude/')[0] ?? ''
}
function fwd(p: string, windows: boolean) {
  let s = p.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (windows) s = s.replace(/^\/([a-zA-Z])\//, (_, d: string) => `${d.toUpperCase()}:/`).replace(/^([a-z]):\//, (_, d: string) => `${d.toUpperCase()}:/`)
  return s
}
async function find($: EngineInterface) {
  const win = await isWin($)
  const clean = (v: string | undefined) => (v ?? '').trim()
  const profile = clean(await $.env.get('USERPROFILE').catch(() => undefined))
  const unix = clean(await $.env.get('HOME').catch(() => undefined))
  const pick = win ? profile || unix : unix || profile
  home = pick ? fwd(pick, win) : fromRoot($)
  const set = clean(await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined))
  const full = set === '~' ? home : set.startsWith('~/') || set.startsWith('~\\') ? `${home}${set.slice(1)}` : set
  claudeDir = full ? fwd(full, win) : `${home}/.claude`
  return { home, claudeDir }
}
// The home folder and the Claude config folder, found once per load.
export function findPaths($: EngineInterface): Promise<{ home: string; claudeDir: string }> {
  finding ??= find($).catch(err => {
    finding = undefined
    throw err
  })
  return finding
}
// For code that cannot wait: the found folder, or a guess from the plugin's path until it is found.
export function claudeDirOf($: EngineInterface) {
  return claudeDir || `${fromRoot($)}/.claude`
}

// ---- Windows helpers ----
// Windows has no /bin/sh, mkdir -p or rm. The same jobs run as PowerShell:
// values go in through env (Windows argv quoting breaks on quotes), text as base64 on stdin.
function b64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let raw = ''
  for (let i = 0; i < bytes.length; i += 1) raw += String.fromCharCode(bytes[i] ?? 0)
  return btoa(raw)
}
function ps($: EngineInterface, script: string, env: Record<string, string> = {}, init: { stdin?: string; timeoutMs?: number } = {}) {
  const full = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ${script}`
  let utf16 = ''
  for (let i = 0; i < full.length; i += 1) utf16 += String.fromCharCode(full.charCodeAt(i) & 255, full.charCodeAt(i) >> 8)
  return $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', btoa(utf16)], { env, ...init })
}

// ---- Files and folders ----
// $.fs.write makes missing folders itself; mkdir -p only runs where it exists.
export async function mkdirs($: EngineInterface, dir: string) {
  if (!(await isWin($))) await $.process.run(['mkdir', '-p', dir])
}
// Appends text to a file without reading it: $.fs has no append. The folder must exist.
// Rejects on a failed command, so the caller can fall back to read and write.
export async function appendText($: EngineInterface, path: string, text: string) {
  const r = (await isWin($))
    ? await ps($, '[IO.File]::AppendAllText($env:MODS_PATH, [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())))', { MODS_PATH: path }, { stdin: b64(text), timeoutMs: 10_000 })
    : await $.process.run(['sh', '-c', 'cat >> "$1"', 'sh', path], { stdin: text, timeoutMs: 10_000 })
  if (r.exitCode !== 0) throw new Error(`append failed: ${r.stderr}`)
}
export async function removeFile($: EngineInterface, path: string) {
  if (await isWin($)) await ps($, 'Remove-Item -LiteralPath $env:MODS_PATH -Force -ErrorAction SilentlyContinue', { MODS_PATH: path })
  else await $.process.run(['rm', '-f', path])
}

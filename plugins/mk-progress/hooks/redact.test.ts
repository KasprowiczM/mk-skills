import { expect, test } from 'claude-code/testing'
import { programOf, redact, REDACTED } from './redact'

const hidden = (s: string) => expect(redact(s), s).not.toMatch(/hunter2|abc123def456|s3cr3t/)

test('redact hides KEY=value assignments, quoted values too', async () => {
  expect(redact('API_KEY=sk-live-abc123def456 npm run build')).toBe(`API_KEY=${REDACTED} npm run build`)
  expect(redact('export DB_PASSWORD="hunter2 with space" && node x.js')).toBe(`export DB_PASSWORD=${REDACTED} && node x.js`)
  expect(redact("NODE_ENV='production' vite")).toBe(`NODE_ENV=${REDACTED} vite`)
  expect(redact('password=hunter2')).toBe(`password=${REDACTED}`)
  expect(redact('{"client_secret": "s3cr3t"}')).not.toContain('s3cr3t')
})

test('redact hides Bearer tokens, Authorization headers and secret flags', async () => {
  expect(redact('curl -H "Authorization: Bearer abc123def456ghi789" https://api.test/v1')).not.toContain('abc123def456')
  expect(redact('curl -H "Authorization: Basic dXNlcjpodW50ZXIy" https://api.test')).not.toContain('dXNlcjpodW50ZXIy')
  expect(redact('use Bearer abc123def456ghi789 here')).toBe(`use Bearer ${REDACTED} here`)
  expect(redact('tool --token abc123def456 --verbose')).toBe(`tool --token ${REDACTED} --verbose`)
  expect(redact('tool --password=hunter2')).toBe(`tool --password=${REDACTED}`)
  expect(redact("tool --secret 'my s3cr3t' run")).toBe(`tool --secret ${REDACTED} run`)
  expect(redact('login -p hunter2 --api-key abc123def456')).toContain(`--api-key ${REDACTED}`)
  for (const s of ['curl -u me:hunter2 --header "X-Auth-Token: abc123def456"', 'mysql --password hunter2']) hidden(s)
})

test('redact hides URL userinfo and query strings but keeps host and path', async () => {
  expect(redact('git clone https://me:hunter2@github.com/acme/repo.git')).toBe(`git clone https://${REDACTED}@github.com/acme/repo.git`)
  expect(redact('open https://example.com/a/b?token=abc123def456&x=1 now')).toBe(`open https://example.com/a/b?${REDACTED} now`)
  expect(redact('see https://example.com/docs for more')).toBe('see https://example.com/docs for more')
})

test('redact hides hex and base64 strings of 24 characters or more', async () => {
  expect(redact('sha 0123456789abcdef0123456789abcdef done')).toBe(`sha ${REDACTED} done`)
  expect(redact('key QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0NTY3 end')).toBe(`key ${REDACTED} end`)
  expect(redact('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig')).not.toContain('eyJhbGciOiJIUzI1NiIs')
  // 23 characters stay.
  expect(redact('0123456789abcdef0123456')).toBe('0123456789abcdef0123456')
})

test('redact leaves plain text, paths, UUID-free slugs and long words alone', async () => {
  for (const s of [
    'Read the research notes',
    '/home/dev/code/mk-progress/plugins/mk-progress/hooks/register.tsx',
    'pre-outline-document-final-version',
    'internationalizationLocalizationHelpers',
    'ls -la /tmp',
    'Count the files: 3 of 4',
    'a=b',
  ]) {
    expect(redact(s), s).toBe(s)
  }
  expect(redact('')).toBe('')
})

test('redact does not double up on its own output', async () => {
  const once = redact('API_KEY=abc123def456 curl https://u:p@h.test/x?y=1 --token zzz')
  expect(redact(once)).toBe(once)
})

test('programOf names the program and nothing else', async () => {
  expect(programOf('curl -s https://example.com?x=1')).toBe('curl')
  expect(programOf('FOO=bar BAZ="a b" /usr/local/bin/node script.js')).toBe('node')
  expect(programOf('  git   status')).toBe('git')
  expect(programOf('(cd /tmp && ls)')).toBe('cd')
  expect(programOf('')).toBe('')
  expect(programOf('API_KEY=abc')).toBe('')
})

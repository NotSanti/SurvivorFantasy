import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'test-results', 'playwright-report'])
const SKIP_FILES = new Set(['.env.local', '.env'])

const PATTERNS = [
  { name: 'service_role_assignment', re: /SERVICE_ROLE[^=\n]{0,20}=\s*['"]?[A-Za-z0-9._-]{20,}/ },
  { name: 'pem_private_key', re: /BEGIN (?:RSA |EC )?PRIVATE KEY/ },
  { name: 'cron_secret_assignment', re: /CRON_SECRET\s*=\s*['"][^'"]{8,}/ },
  { name: 'legacy_jwt', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
]

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || SKIP_FILES.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, files)
      continue
    }
    if (/\.(ts|tsx|js|mjs|json|md|html|css|map)$/.test(entry.name) || entry.name === '.env.example') {
      files.push(full)
    }
  }
  return files
}

const files = []
for (const start of ['src', 'supabase', 'scripts', 'dist', '.env.example', 'vercel.json']) {
  const full = path.join(ROOT, start)
  try {
    const info = await stat(full)
    if (info.isDirectory()) await walk(full, files)
    else files.push(full)
  } catch {
    // optional path, e.g. dist before build
  }
}

const hits = []
for (const file of files) {
  const text = await readFile(file, 'utf8')
  const relative = path.relative(ROOT, file)
  const inDist = relative.split(path.sep)[0] === 'dist'
  for (const pattern of PATTERNS) {
    if (inDist && pattern.name === 'legacy_jwt') continue
    if (pattern.re.test(text)) {
      hits.push(`${relative}: ${pattern.name}`)
    }
  }
}

if (hits.length) {
  console.error('Secret scan failed:')
  for (const hit of hits) console.error(`  ${hit}`)
  process.exit(1)
}

console.log(`Secret scan passed (${files.length} files).`)

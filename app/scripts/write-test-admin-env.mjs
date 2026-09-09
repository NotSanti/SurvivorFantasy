import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../.env.local', import.meta.url)
const email = 'kindling.admin.test@example.com'
const password = `KindlingAdmin-${randomBytes(12).toString('base64url')}`
let text = readFileSync(path, 'utf8')
text = text
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('KINDLING_TEST_ADMIN_'))
  .join('\n')
text += `\nKINDLING_TEST_ADMIN_EMAIL=${email}\nKINDLING_TEST_ADMIN_PASSWORD=${password}\n`
writeFileSync(path, text)
process.stdout.write(`${email}\n`)

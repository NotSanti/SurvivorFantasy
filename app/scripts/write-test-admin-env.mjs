import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../.env.local', import.meta.url)
const email = 'sfl.admin.test@example.com'
let text = readFileSync(path, 'utf8')
text = text
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('SFL_TEST_ADMIN_') && !line.startsWith('KINDLING_TEST_ADMIN_'))
  .join('\n')
text += `\nSFL_TEST_ADMIN_EMAIL=${email}\n`
writeFileSync(path, text)
process.stdout.write(`${email}\n`)

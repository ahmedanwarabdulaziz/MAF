// P03 migration runner — adds migration files 004 and 005
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PAT = 'sbp_4406864bee3040efa841d91360982885401638a1'
const REF = 'mudmlntyyozezevdccll'

async function runSQL(label, sql) {
  process.stdout.write(`▶ ${label} ... `)
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.json()
  if (!res.ok) {
    const msg = JSON.stringify(body)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('⚠ Already exists (OK)')
    } else {
      console.log('✗')
      console.error('  ', msg.slice(0, 300))
    }
  } else {
    console.log('✓')
  }
}

const files = [
  'migrations/004_companies_projects_cost_centers.sql',
  'migrations/005_parties.sql',
]

for (const f of files) {
  await runSQL(f, readFileSync(join(__dirname, f), 'utf8'))
}

// Verify
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
  body: JSON.stringify({ query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name` }),
})
const tables = await res.json()
console.log('\nAll public tables:')
tables.forEach(t => console.log(' -', t.table_name))

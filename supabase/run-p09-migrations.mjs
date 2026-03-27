// P09 Migration Runner — runs migrations 012
// node supabase/run-p09-migrations.mjs

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_REF = 'mudmlntyyozezevdccll'
const PAT         = 'sbp_4406864bee3040efa841d91360982885401638a1'

async function runSQL(label, sql) {
  console.log(`\n▶ ${label}`)
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PAT}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const body = await res.json()
  if (!res.ok) {
    const msg = JSON.stringify(body)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('  ⚠ Already exists (OK)')
    } else {
      console.error('  ✗', msg.slice(0, 400))
      process.exitCode = 1
    }
  } else {
    console.log('  ✓ Done')
  }
}

async function main() {
  console.log('=== P09 Migration Runner: Subcontractor Agreements ===\n')

  // Verify connectivity
  const test = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}`, {
    headers: { Authorization: `Bearer ${PAT}` }
  })
  if (!test.ok) {
    console.error('Cannot reach Supabase Management API:', test.status, await test.text())
    process.exit(1)
  }
  const proj = await test.json()
  console.log(`✓ Connected to project: ${proj.name || PROJECT_REF}`)

  const files = [
    'migrations/012_subcontractor_agreements.sql',
  ]

  for (const file of files) {
    await runSQL(file, readFileSync(join(__dirname, file), 'utf8'))
  }

  console.log('\n✅ P09 migrations complete.')
}

main().catch(console.error)

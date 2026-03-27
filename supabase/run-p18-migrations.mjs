import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_REF  = 'mudmlntyyozezevdccll'
const PAT          = 'sbp_4406864bee3040efa841d91360982885401638a1'

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
      console.error('  ✗', msg.slice(0, 500))
    }
  } else {
    console.log('  ✓ Done')
  }
}

async function main() {
  console.log('=== P18 Migration Runner ===\n')

  const file = 'migrations/017_treasury_and_payments.sql'
  await runSQL(file, readFileSync(join(__dirname, file), 'utf8'))

  console.log('\n✅ P18 Migration executed.')
}

main().catch(console.error)

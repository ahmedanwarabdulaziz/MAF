// PERF-06 + PERF-09: Apply 059_performance_indexes.sql via Supabase Management API
// node supabase/run-059-indexes.mjs

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_REF = 'mudmlntyyozezevdccll'
const PAT         = 'sbp_9795bab98d840b03111855773ebfb50e97f3a789'

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
      console.log('  ⚠  Index already exists (OK — idempotent)')
    } else {
      console.error('  ✗ ERROR:', msg.slice(0, 400))
      throw new Error(msg)
    }
  } else {
    console.log('  ✓ Done')
  }
}

async function main() {
  console.log('=== PERF-06 + PERF-09: Performance Indexes Migration ===\n')

  // Verify connectivity
  const test = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}`, {
    headers: { Authorization: `Bearer ${PAT}` }
  })
  if (!test.ok) {
    console.error('✗ Cannot reach Supabase Management API:', test.status, await test.text())
    process.exit(1)
  }
  const proj = await test.json()
  console.log(`✓ Connected to project: ${proj.name || PROJECT_REF}`)

  // Run each index creation separately for clear reporting
  const indexes = [
    {
      name: '1. purchase_requests — project + status + date',
      sql: `CREATE INDEX IF NOT EXISTS idx_purchase_requests_project_status_date
              ON public.purchase_requests(project_id, status, created_at DESC);`
    },
    {
      name: '2. supplier_invoices — project + status + date',
      sql: `CREATE INDEX IF NOT EXISTS idx_supplier_invoices_project_status_date
              ON public.supplier_invoices(project_id, status, created_at DESC);`
    },
    {
      name: '3. invoice_receipt_confirmations — supplier_invoice_id',
      sql: `CREATE INDEX IF NOT EXISTS idx_invoice_receipt_confirmations_invoice
              ON public.invoice_receipt_confirmations(supplier_invoice_id);`
    },
    {
      name: '4. user_permission_group_assignments — user + active + group',
      sql: `CREATE INDEX IF NOT EXISTS idx_upga_user_active
              ON public.user_permission_group_assignments(user_id, is_active, permission_group_id);`
    },
    {
      name: '5. permission_group_permissions — group + module + action (WHERE is_allowed)',
      sql: `CREATE INDEX IF NOT EXISTS idx_pgp_group_module_action
              ON public.permission_group_permissions(permission_group_id, module_key, action_key)
              WHERE is_allowed = true;`
    },
    {
      name: '6. financial_transactions — account + date (treasury ordered list)',
      sql: `CREATE INDEX IF NOT EXISTS idx_fin_tx_account_date
              ON public.financial_transactions(financial_account_id, created_at DESC);`
    },
    {
      name: '7. user_access_scopes — user + active + scope_type (RLS HOT PATH)',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_access_scopes_user_active
              ON public.user_access_scopes(user_id, is_active, scope_type);`
    },
  ]

  let successCount = 0
  let skipCount = 0
  let failCount = 0

  for (const { name, sql } of indexes) {
    try {
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
          console.log(`\n▶ ${name}`)
          console.log('  ⚠  Already exists (OK)')
          skipCount++
        } else {
          console.log(`\n▶ ${name}`)
          console.error('  ✗ ERROR:', msg.slice(0, 300))
          failCount++
        }
      } else {
        console.log(`\n▶ ${name}`)
        console.log('  ✓ Created')
        successCount++
      }
    } catch (err) {
      console.log(`\n▶ ${name}`)
      console.error('  ✗ Network error:', err.message)
      failCount++
    }
  }

  console.log('\n' + '═'.repeat(55))
  console.log(`  ✅ Created : ${successCount}`)
  console.log(`  ⚠  Skipped : ${skipCount} (already existed)`)
  if (failCount > 0) console.log(`  ✗  Failed  : ${failCount}`)
  console.log('═'.repeat(55))

  if (failCount === 0) {
    console.log('\n🎉 All 7 performance indexes are now active!')
    console.log('   Expected query speedups:')
    console.log('   • RLS sub-select (user_access_scopes): ~10×')
    console.log('   • Permission lookups:                  ~5×')
    console.log('   • Purchase list page:                  ~3×')
    console.log('   • Treasury transactions:               ~2×')
  } else {
    console.log('\n⚠  Some indexes failed — check errors above.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message)
  process.exit(1)
})

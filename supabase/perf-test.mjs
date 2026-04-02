// PERF Test — Measures query times on hot DB paths after indexes are applied
// node supabase/perf-test.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://mudmlntyyozezevdccll.supabase.co'
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs'
const PROJECT_REF   = 'mudmlntyyozezevdccll'
const PAT           = 'sbp_9795bab98d840b03111855773ebfb50e97f3a789'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─── helpers ─────────────────────────────────────────────────────────────────

async function sqlQuery(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
      body: JSON.stringify({ query: sql }),
    }
  )
  const body = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(body).slice(0, 300))
  return body
}

async function time(label, fn, runs = 5) {
  const times = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    await fn()
    times.push(performance.now() - t0)
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  return { label, avg: Math.round(avg), min: Math.round(min), max: Math.round(max), runs }
}

function bar(ms, maxMs = 500) {
  const filled = Math.round((Math.min(ms, maxMs) / maxMs) * 30)
  const color = ms < 50 ? '🟢' : ms < 150 ? '🟡' : '🔴'
  return color + ' ' + '█'.repeat(filled) + '░'.repeat(30 - filled) + ` ${ms}ms`
}

// ─── test cases ──────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60))
  console.log('  MAF Performance Test — Post-Index Baseline')
  console.log('  ' + new Date().toISOString())
  console.log('═'.repeat(60))

  const results = []

  // 1. user_access_scopes — THE most important (RLS hot path)
  results.push(await time(
    'user_access_scopes (RLS sub-select simulation)',
    () => sqlQuery(`
      SELECT user_id, scope_type, is_active
      FROM public.user_access_scopes
      WHERE is_active = true
      ORDER BY user_id, scope_type
      LIMIT 100
    `)
  ))

  // 2. user_permission_group_assignments 
  results.push(await time(
    'permission group assignments (per user)',
    () => sqlQuery(`
      SELECT upga.user_id, upga.permission_group_id, upga.is_active
      FROM public.user_permission_group_assignments upga
      WHERE upga.is_active = true
      LIMIT 200
    `)
  ))

  // 3. permission_group_permissions
  results.push(await time(
    'permission_group_permissions (allowed only)',
    () => sqlQuery(`
      SELECT p.permission_group_id, p.module_key, p.action_key
      FROM public.permission_group_permissions p
      WHERE p.is_allowed = true
      LIMIT 500
    `)
  ))

  // 4. purchase_requests — filtered by project + status
  results.push(await time(
    'purchase_requests (project filter + status + date)',
    () => sqlQuery(`
      SELECT id, project_id, status, created_at
      FROM public.purchase_requests
      ORDER BY created_at DESC
      LIMIT 50
    `)
  ))

  // 5. supplier_invoices — filtered by project + status
  results.push(await time(
    'supplier_invoices (project filter + status + date)',
    () => sqlQuery(`
      SELECT id, project_id, status, created_at
      FROM public.supplier_invoices
      ORDER BY created_at DESC
      LIMIT 50
    `)
  ))

  // 6. financial_transactions — per account ordered by date
  results.push(await time(
    'financial_transactions (account + date order)',
    () => sqlQuery(`
      SELECT id, financial_account_id, created_at, amount, transaction_type
      FROM public.financial_transactions
      ORDER BY created_at DESC
      LIMIT 100
    `)
  ))

  // 7. EXPLAIN ANALYZE on RLS pattern (single most valuable)
  console.log('\n\n📊 Query Plans (EXPLAIN ANALYZE):')
  console.log('─'.repeat(60))

  try {
    const explainRLS = await sqlQuery(`
      EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT TEXT)
      SELECT user_id, scope_type, is_active
      FROM public.user_access_scopes
      WHERE user_id = (SELECT id FROM public.users LIMIT 1)
        AND is_active = true
    `)
    console.log('\n[user_access_scopes — RLS pattern]:')
    if (Array.isArray(explainRLS)) {
      explainRLS.forEach(row => {
        const plan = row['QUERY PLAN'] || row[Object.keys(row)[0]]
        if (plan) console.log('  ' + plan)
      })
    }
  } catch (e) {
    console.log('  ⚠ EXPLAIN not available via API:', e.message.slice(0, 100))
  }

  // ─── Results table ────────────────────────────────────────────────────────
  console.log('\n\n═'.repeat(60))
  console.log('  RESULTS (avg of 5 runs each)')
  console.log('═'.repeat(60))
  console.log(
    'Test'.padEnd(50) + 'avg'.padStart(6) + '  min'.padStart(6) + '  max'.padStart(6)
  )
  console.log('─'.repeat(70))

  for (const r of results) {
    const label = r.label.length > 48 ? r.label.slice(0, 45) + '...' : r.label
    console.log(
      label.padEnd(50) +
      `${r.avg}ms`.padStart(6) +
      `  ${r.min}ms`.padStart(6) +
      `  ${r.max}ms`.padStart(6)
    )
  }

  console.log('─'.repeat(70))
  const totalAvg = results.reduce((s, r) => s + r.avg, 0)
  console.log(`${'TOTAL (sum of all queries)'.padEnd(50)}${totalAvg}ms`.padStart(6))

  console.log('\n📈 Visual (avg, 500ms scale):')
  for (const r of results) {
    const label = r.label.slice(0, 40).padEnd(42)
    console.log(`  ${label} ${bar(r.avg)}`)
  }

  console.log('\n')

  // Performance verdict
  const slowQueries = results.filter(r => r.avg > 200)
  if (slowQueries.length === 0) {
    console.log('🏆 All queries under 200ms — indexes working great!')
  } else {
    console.log('⚠  Slow queries (>200ms avg):')
    slowQueries.forEach(r => console.log(`   • ${r.label}: ${r.avg}ms avg`))
  }

  console.log('\n')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})

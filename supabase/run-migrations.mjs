// P02 Migration Runner — uses Supabase Management API for SQL execution
// node supabase/run-migrations.mjs

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_REF  = 'mudmlntyyozezevdccll'
const PAT          = 'sbp_4406864bee3040efa841d91360982885401638a1'
const SUPABASE_URL = 'https://mudmlntyyozezevdccll.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

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
    // Treat "already exists" as warnings
    const msg = JSON.stringify(body)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('  ⚠ Already exists (OK)')
    } else {
      console.error('  ✗', msg.slice(0, 200))
    }
  } else {
    console.log('  ✓ Done')
  }
}

async function main() {
  console.log('=== P02 Migration Runner ===\n')

  // Test API connectivity
  const test = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}`, {
    headers: { Authorization: `Bearer ${PAT}` }
  })
  if (!test.ok) {
    console.error('Cannot reach Supabase Management API:', test.status, await test.text())
    return
  }
  const proj = await test.json()
  console.log(`✓ Connected to project: ${proj.name || PROJECT_REF}`)

  const files = [
    'migrations/001_users_and_access.sql',
    'migrations/002_seed_roles_and_groups.sql',
    'migrations/003_seed_permissions_matrix.sql',
  ]
  for (const file of files) {
    await runSQL(file, readFileSync(join(__dirname, file), 'utf8'))
  }

  console.log('\n\n=== Creating Super Admin ===')

  // Create auth user
  console.log('\n▶ Creating auth user a@a.com')
  const { data, error } = await admin.auth.admin.createUser({
    email: 'a@a.com',
    password: '5550555',
    email_confirm: true,
    user_metadata: { display_name: 'مدير النظام' },
  })
  if (error) {
    if (error.message?.toLowerCase().includes('already')) console.log('  ℹ Already exists')
    else console.log('  ✗', error.message)
  } else {
    console.log('  ✓ Created:', data.user?.id)
  }

  await new Promise(r => setTimeout(r, 2000))

  const { data: { users } } = await admin.auth.admin.listUsers()
  const u = users.find(x => x.email === 'a@a.com')
  if (!u) { console.error('User not found!'); return }

  // Elevate to super admin via direct SQL
  await runSQL('Set is_super_admin=true', `
    INSERT INTO public.users (id, display_name, email, is_super_admin, is_active)
    VALUES ('${u.id}', 'مدير النظام', 'a@a.com', true, true)
    ON CONFLICT (id) DO UPDATE SET is_super_admin = true, display_name = 'مدير النظام';

    INSERT INTO public.user_access_scopes (user_id, scope_type)
    VALUES ('${u.id}', 'main_company'), ('${u.id}', 'all_projects')
    ON CONFLICT DO NOTHING;
  `)

  // Verify
  await runSQL('Verify', `SELECT id, display_name, email, is_super_admin FROM public.users WHERE email = 'a@a.com'`)

  console.log('\n✅ All done! Login: http://localhost:3000/login  →  a@a.com / 5550555')
}

main().catch(console.error)

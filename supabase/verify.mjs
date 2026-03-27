// Quick verification — check super admin status
import { createClient } from '@supabase/supabase-js'

const PAT = 'sbp_4406864bee3040efa841d91360982885401638a1'
const REF = 'mudmlntyyozezevdccll'
const SUPABASE_URL = 'https://mudmlntyyozezevdccll.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function verify() {
  // Check users table
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
    body: JSON.stringify({ query: `SELECT id, display_name, email, is_super_admin, is_active FROM public.users WHERE email = 'a@a.com'` })
  })
  const data = await res.json()
  console.log('Users table result:')
  console.log(JSON.stringify(data, null, 2))

  // Check scopes
  const res2 = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
    body: JSON.stringify({ query: `SELECT u.email, s.scope_type FROM public.user_access_scopes s JOIN public.users u ON u.id = s.user_id WHERE u.email = 'a@a.com'` })
  })
  const data2 = await res2.json()
  console.log('\nAccess scopes:')
  console.log(JSON.stringify(data2, null, 2))

  // Count tables
  const res3 = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
    body: JSON.stringify({ query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name` })
  })
  const data3 = await res3.json()
  console.log('\nPublic tables created:')
  console.log(JSON.stringify(data3, null, 2))
  
  // Count permission groups
  const res4 = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
    body: JSON.stringify({ query: `SELECT COUNT(*) as groups FROM public.permission_groups; ` })
  })
  const data4 = await res4.json()
  console.log('\nPermission groups count:')
  console.log(JSON.stringify(data4, null, 2))
}

verify().catch(console.error)

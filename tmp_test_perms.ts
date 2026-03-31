import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve('.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim()
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim()
}
const supabase = createClient(url, key)

async function run() {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, display_name, is_super_admin,
      user_access_scopes:user_permission_group_assignments(
        scope_type, project_id,
        permission_group:permission_groups(permissions)
      )
    `)
    .eq('is_active', true)
    .limit(2)
  console.log('Error:', error)
  console.log('Data:', JSON.stringify(data, null, 2))
}
run()

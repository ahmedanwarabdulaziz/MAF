import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = fs.readFileSync('.env.local', 'utf8')
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) {
    process.env[key.trim()] = values.join('=').trim()
  }
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, display_name, email, is_active, is_super_admin,
      user_permission_group_assignments!user_permission_group_assignments_user_id_fkey (
        permission_group_id,
        is_active,
        permission_groups ( arabic_name )
      ),
      user_role_assignments!user_role_assignments_user_id_fkey (
        is_active,
        roles ( arabic_name )
      )
    `)
    .limit(1)

  if (error) {
    console.error('Query Error Details:\n', JSON.stringify(error, null, 2))
    
    // Fallback: try to see if just !user_id works
    const { error: error2 } = await supabase
      .from('users')
      .select(`id, user_permission_group_assignments!user_id(id)`).limit(1)
    if (error2) console.error('Fallback Error:\n', JSON.stringify(error2, null, 2))
    else console.log('Fallback works!')
  } else {
    console.log('Query Success:', JSON.stringify(data, null, 2))
  }
}

main()

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf8')
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) {
    process.env[key.trim()] = values.join('=').trim()
  }
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing supabase credentials")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const { data: userAuth, error: authError } = await supabase.auth.admin.listUsers()
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'a@a.com')
    .single()

  if (error) {
    console.error('Error fetching user from public.users:', error.message)
    // Maybe user exists in auth.users but not in public.users?
    const authUser = userAuth?.users.find(u => u.email === 'a@a.com')
    if (authUser) {
      console.log('User exists in auth.users:', authUser.id)
      console.log('Inserting into public.users...')
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: 'a@a.com',
          is_super_admin: true,
          display_name: 'Super Admin',
          is_active: true
        })
      if (insertError) {
         console.error('Error inserting user:', insertError.message)
      } else {
         console.log('Successfully inserted user into public.users as super_admin')
      }
    } else {
      console.log('User a@a.com not found in auth.users either.')
    }
    return
  }

  console.log('User found in public.users:', user.email, 'is_super_admin:', user.is_super_admin)

  if (!user.is_super_admin) {
    console.log('Updating is_super_admin to true...')
    const { error: updateError } = await supabase
      .from('users')
      .update({ is_super_admin: true })
      .eq('email', 'a@a.com')

    if (updateError) {
      console.error('Error updating user:', updateError.message)
    } else {
      console.log('Successfully updated is_super_admin to true')
    }
  } else {
    console.log('User is already super admin.')
  }
}

main()

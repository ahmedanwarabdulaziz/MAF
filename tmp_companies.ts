import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Read values from .env.local manually
const envPath = path.resolve('.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
let url = ''
let key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim()
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim()
}

const supabase = createClient(url, key)

async function run() {
  const { data: company, error } = await supabase.from('companies').select('*').eq('short_code', 'MAIN').single()
  console.log('MAIN company:', company, error)

  const { data: companies } = await supabase.from('companies').select('id, short_code, arabic_name')
  console.log('All companies:', companies)
}
run()

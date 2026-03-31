const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) process.env[key] = val.join('=').trim().replace(/['"]/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ahmed@maf.com', // wait, I don't know the password... what if I use admin?
  });
}

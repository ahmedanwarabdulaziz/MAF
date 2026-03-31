require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUser() {
  const { data: user } = await supabase.from('users').select('*').eq('email', 'amro@a.com').single();
  console.log('User:', user);
  if (!user) return;
  
  const { data: assignments } = await supabase.from('user_permission_group_assignments')
    .select('*, permission_groups(*)')
    .eq('user_id', user.id);
  console.log('Assignments:', JSON.stringify(assignments, null, 2));

  const { data: scopes } = await supabase.from('user_access_scopes')
    .select('*, projects(project_code, arabic_name)')
    .eq('user_id', user.id);
  console.log('Scopes:', JSON.stringify(scopes, null, 2));
}
checkUser();

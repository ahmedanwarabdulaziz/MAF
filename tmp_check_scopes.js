const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://mudmlntyyozezevdccll.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs',
  { auth: { persistSession: false } }
);

async function checkScopes() {
  const { data: users } = await supabase.from('users').select('id, email, is_super_admin');
  
  for (const u of users) {
    if (u.is_super_admin) continue;

    const { data: scopes } = await supabase.from('user_access_scopes')
      .select('scope_type, company_id, project_id, is_active')
      .eq('user_id', u.id)
      .eq('is_active', true);
      
    if (scopes && scopes.length > 0) {
      console.log(`\nUser: ${u.email} has ${scopes.length} active SCOPES.`);
      scopes.forEach(s => {
        console.log(`  - Scope: ${s.scope_type} | Proj: ${s.project_id}`);
      });
    }
  }
}
checkScopes();

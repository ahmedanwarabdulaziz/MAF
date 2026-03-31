const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://mudmlntyyozezevdccll.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs',
  { auth: { persistSession: false } }
);

async function check() {
  const { data: users } = await supabase.from('users').select('id, email, is_super_admin');
  console.log(`Found ${users.length} users in system`);

  for (const u of users) {
    if (u.is_super_admin) continue;

    const { data: asg } = await supabase.from('user_permission_group_assignments')
      .select('permission_group_id, is_active, permission_groups(name_ar, group_key)')
      .eq('user_id', u.id);

    console.log(`\nUser: ${u.email}`);
    console.log(`Assignments count: ${asg?.length || 0}`);
    
    if (!asg || !asg.length) {
      console.log('  No groups assigned.');
      continue;
    }

    asg.forEach(a => {
      console.log(`  - Group: ${a.permission_groups?.name_ar} (Active: ${a.is_active}) [${a.permission_groups?.group_key}]`);
    });

    const activeGroups = asg.filter(a => a.is_active).map(a => a.permission_group_id);
    if (!activeGroups.length) {
      console.log('  No ACTIVE groups assigned.');
      continue;
    }

    const { data: perms } = await supabase.from('permission_group_permissions')
      .select('module_key, action_key')
      .in('permission_group_id', activeGroups)
      .eq('is_allowed', true);
    
    const approvePerms = perms.filter(p => p.action_key === 'approve' || p.action_key === 'edit');
    console.log('  Approve/Edit Permissions:', approvePerms.map(p => `${p.module_key}.${p.action_key}`).join(', '));
    const hasProc = perms.some(p => p.module_key === 'supplier_procurement' && p.action_key === 'approve');
    const hasWH = perms.some(p => p.module_key === 'project_warehouse' && p.action_key === 'approve');
    console.log(`  can_pm_approve (supplier_procurement.approve): ${hasProc}`);
    console.log(`  can_wh_approve (project_warehouse.approve): ${hasWH}`);
  }
}
check();

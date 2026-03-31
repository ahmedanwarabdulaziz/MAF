const fs = require('fs');
const file = 'src/app/(system)/company/settings/data-reset/actions.ts';
let content = fs.readFileSync(file, 'utf8');

// Update assertSuperAdmin
content = content.replace(
  /async function assertSuperAdmin\(\) \{[\s\S]*?return supabase\n\}/,
  \`async function assertSuperAdmin() {\n  const userClient = createClient()\n  const { data: { user } } = await userClient.auth.getUser()\n  if (!user) throw new Error('غير مصرح')\n  const { data: profile } = await userClient.from('users').select('is_super_admin').eq('id', user.id).single()\n  if (!profile?.is_super_admin) throw new Error('هذه العملية محظورة — للمديرين العامين فقط')\n  \n  const { createAdminClient } = require('@/lib/supabase-admin')\n  return createAdminClient()\n}\`
);

// Add .throwOnError() to all supabase queries
const lines = content.split('\\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('await supabase.from(') && (lines[i].includes('.delete()') || lines[i].includes('.update('))) {
    if (!lines[i].includes('.throwOnError()')) {
        // Just append to the end of the line (before any semicolon if there was one, though standard format is no semicolon)
        lines[i] = lines[i].replace(/$/m, '.throwOnError()');
    }
  }
}

content = lines.join('\\n');
fs.writeFileSync(file, content);
console.log("Done");

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// parse .env.local manually
const envConfig = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
envConfig.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    console.log('Seeding expense_groups and items...');
    
    // RLS fix
    // Wait, since we are service_role, we don't need RLS, but the client does. 
    // If the user didn't run 026, let's just insert one manually to test.
    const { data: companies } = await supabase.from('companies').select('id').limit(1);
    if (!companies || companies.length === 0) {
      console.log('No companies found.');
      return;
    }
    const companyId = companies[0].id;
    
    let { data: group } = await supabase.from('expense_groups').select('*').eq('group_code', 'EXP-001').single();
    if (!group) {
        console.log('Inserting group...');
        const { data: ng, error: ge } = await supabase.from('expense_groups').insert({
            company_id: companyId,
            group_code: 'EXP-001',
            arabic_name: 'مصروفات تشغيل وموقع',
            english_name: 'Site Operating Expenses'
        }).select().single();
        if(ge) console.error(ge);
        group = ng;
    }

    if (group) {
        let { data: items } = await supabase.from('expense_items').select('*').eq('expense_group_id', group.id);
        if(!items || items.length === 0) {
            console.log('Inserting items...');
            await supabase.from('expense_items').insert([
                { expense_group_id: group.id, item_code: 'ITM-001', arabic_name: 'نقل ومواصلات' },
                { expense_group_id: group.id, item_code: 'ITM-002', arabic_name: 'مصاريف تحميل وتنزيل' }
            ]);
        }
    }
    
    // Fix RLS using direct SQL (requires postgres access but we can try RPC if it exists, otherwise tell user to run 026 again)
    // Actually, if we just check how many groups exist:
    const { data: all_g } = await supabase.from('expense_groups').select('*');
    console.log(`There are ${all_g?.length || 0} groups in DB.`);
    
  } catch (e) {
      console.error(e);
  }
})();

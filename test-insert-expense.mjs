import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
        const { data: company } = await supabase.from('companies').select('id').limit(1).single();
        const { data: project } = await supabase.from('projects').select('id').limit(1).single();
        const { data: group } = await supabase.from('expense_groups').select('id').limit(1).single();
        const { data: item } = await supabase.from('expense_items').select('id').limit(1).single();
        const { data: acc } = await supabase.from('financial_accounts').select('id').limit(1).single();

        console.log('Inserting mock expense...');
        const payload = {
            company_id: company.id,
            project_id: project.id,
            financial_account_id: acc.id,
            expense_group_id: group.id,
            expense_item_id: item.id,
            quantity: 1,
            unit_price: 15.5,
            total_amount: 15.5,
            expense_date: new Date().toISOString().split('T')[0],
            notes: 'Test script',
            status: 'draft'
        };

        const { data, error } = await supabase.from('petty_expenses').insert([payload]).select().single();
        if (error) {
            console.error('Supabase Error:', error);
        } else {
            console.log('Success!', data.id);
        }
    } catch(e) {
        console.error(e);
    }
})();

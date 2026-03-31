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
        const { data, error } = await supabase
        .from('petty_expenses')
        .select(`
            *,
            expense_group:expense_groups(arabic_name),
            expense_item:expense_items(arabic_name),
            creator:users!petty_expenses_created_by_fkey(display_name, email),
            pm_approver:users!petty_expenses_pm_approved_by_fkey(display_name),
            gm_approver:users!petty_expenses_gm_approved_by_fkey(display_name),
            cashbox:financial_accounts!petty_expenses_financial_account_id_fkey(arabic_name)
        `)
        .limit(1)
        .single();
        console.log('Error mapping?', error);
    } catch(e) {
        console.error(e);
    }
})();

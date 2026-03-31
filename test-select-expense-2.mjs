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
            id,
            total_amount,
            expense_group:expense_groups(arabic_name),
            expense_item:expense_items(arabic_name),
            cashbox:financial_accounts(arabic_name)
        `)
        .limit(1)
        .single();
        console.log('Error cashbox:', error);
    } catch(e) {
        console.error(e);
    }
})();

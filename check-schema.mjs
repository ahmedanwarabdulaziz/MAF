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
    // Just peek at the first row to determine schema
    const { data, error } = await supabase.from('petty_expenses').select('financial_account_id').limit(1);
    console.log('Error checking petty_expenses schema:', error);
})();

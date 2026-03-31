import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// read manual .env.local parsing to avoid dotenv issues
const envConfig = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
envConfig.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if(!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    try {
        const sql = fs.readFileSync('supabase/migrations/026_refactor_petty_expenses_to_treasury.sql', 'utf8');
        console.log('Running 026...');
        const { error } = await supabase.rpc('exec_sql', { query: sql });
        if (error) throw error;
        console.log('✅ Migration 026 applied.');
    } catch(err) {
        console.error('Migration failed:', err.message || err);
    }
})();

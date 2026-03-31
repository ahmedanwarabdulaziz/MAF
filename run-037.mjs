import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envConfig = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
envConfig.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    try {
        const sql = fs.readFileSync('supabase/migrations/037_fix_procurement_rls_for_all.sql', 'utf8');
        console.log('Running 037...');
        const { error } = await supabase.rpc('exec_sql', { query: sql });
        if (error) throw error;
        console.log('✅ Migration 037 applied.');
    } catch(err) {
        console.error('Migration failed:', err.message || err);
    }
})();

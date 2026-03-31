import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
(async () => {
    console.log("Fetching users...");
    const { data, error } = await supabase.from('users').select('id, display_name, is_super_admin, user_access_scopes(scope_type, project_id)').eq('is_active', true).order('display_name');
    console.log('Error:', error);
    console.log('Data count:', data ? data.length : 0);
    console.log('Sample Data:', JSON.stringify(data || [], null, 2));
})();

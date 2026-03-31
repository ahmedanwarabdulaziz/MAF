import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
(async () => {
    const { data: g } = await supabase.from('expense_groups').select('*');
    console.log('Groups count:', g?.length || 0);
    const { data: i } = await supabase.from('expense_items').select('*');
    console.log('Items count:', i?.length || 0);
})();

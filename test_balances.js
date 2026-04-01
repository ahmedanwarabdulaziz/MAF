const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('party_advance_balances').select('*, party:parties!party_id(arabic_name)');
  console.log("parties!party_id:", data, error);

  const { data: d2, error: e2 } = await supabase.from('party_advance_balances').select('*, party:party_id(arabic_name)');
  console.log("party_id:", d2, e2);
}

check();

// Dedup scope rows + add unique constraint
import { createClient } from '@supabase/supabase-js'

const PAT = 'sbp_4406864bee3040efa841d91360982885401638a1'
const REF = 'mudmlntyyozezevdccll'

const sql = `
DELETE FROM public.user_access_scopes a
USING public.user_access_scopes b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.scope_type = b.scope_type;
`

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
  body: JSON.stringify({ query: sql })
})
const data = await res.json()
console.log('Dedup result:', JSON.stringify(data, null, 2))

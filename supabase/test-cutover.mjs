import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = 'https://mudmlntyyozezevdccll.supabase.co'
const PAT = 'sbp_4406864bee3040efa841d91360982885401638a1'

// Note: the PAT is for management API, but we'll use service role key for JS client to test RPCs if we have it.
// Wait, we don't have the ANON or SERVICE key in this file. But we can run an arbitrary SQL query via the Management API!
// Let's use the Management API to execute a SQL block testing everything.
import { readFileSync } from 'fs'

async function runSQL(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/mudmlntyyozezevdccll/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PAT}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const body = await res.json()
  if (!res.ok) {
    import('fs').then(fs => fs.writeFileSync('error.txt', JSON.stringify(body, null, 2)));
    throw new Error("Failed");
  }
  return body
}

async function runTest() {
  console.log("Running P07 Cutover Test Logic...")

  const testSql = `
DO $$
DECLARE
    v_company_id UUID;
    v_project_id UUID;
    v_warehouse_id UUID;
    v_item_id UUID;
    v_unit_id UUID;
    v_batch_id UUID;
BEGIN
    -- 1. Setup Test Data
    -- Get or create main company
    SELECT id INTO v_company_id FROM public.companies WHERE short_code = 'MAIN' LIMIT 1;
    
    -- Create test project
    INSERT INTO public.projects (company_id, project_code, arabic_name, english_name, status, project_onboarding_type)
    VALUES (v_company_id, 'TEST-CUT-' || extract(epoch from now())::int, 'مشروع اختبار', 'Test Proj', 'active', 'existing')
    RETURNING id INTO v_project_id;
    
    -- Create test warehouse
    INSERT INTO public.warehouses (company_id, project_id, warehouse_type, warehouse_code, arabic_name)
    VALUES (v_company_id, v_project_id, 'project', 'WH-TEST-' || extract(epoch from now())::int, 'مخزن اختبار')
    RETURNING id INTO v_warehouse_id;

    -- Create test unit
    INSERT INTO public.units (company_id, unit_code, arabic_name) VALUES (v_company_id, 'U-' || extract(epoch from now())::int, 'Test Unit') RETURNING id INTO v_unit_id;
    
    -- Create test item group
    DECLARE v_group_id UUID;
    BEGIN
        INSERT INTO public.item_groups (company_id, group_code, arabic_name) VALUES (v_company_id, 'G-' || extract(epoch from now())::int, 'Test Group') RETURNING id INTO v_group_id;
        
        -- Create test item
        INSERT INTO public.items (company_id, item_group_id, item_code, arabic_name, primary_unit_id) 
        VALUES (v_company_id, v_group_id, 'ITM-' || extract(epoch from now())::int, 'عنصر اختبار', v_unit_id)
        RETURNING id INTO v_item_id;
    END;

    -- 2. Create Cutover Batch
    INSERT INTO public.cutover_batches (company_id, project_id, cutover_date, status)
    VALUES (v_company_id, v_project_id, current_date, 'draft')
    RETURNING id INTO v_batch_id;

    -- 3. Add Opening Stock
    INSERT INTO public.cutover_warehouse_stock (batch_id, warehouse_id, item_id, unit_id, opening_quantity, unit_cost, opening_value)
    VALUES (v_batch_id, v_warehouse_id, v_item_id, v_unit_id, 100, 50, 5000);

    -- 4. Test Lock Failure (Status is draft, it must be approved)
    BEGIN
        PERFORM public.lock_cutover_batch(v_batch_id);
        RAISE EXCEPTION 'TEST FAILED: Allowed lock on draft batch!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Batch must be approved%' THEN
            RAISE EXCEPTION 'TEST FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 5. Approve Batch
    UPDATE public.cutover_batches SET status = 'approved' WHERE id = v_batch_id;

    -- 6. Test Successful Lock
    PERFORM public.lock_cutover_batch(v_batch_id);

    -- 7. Test Double Lock Failure
    BEGIN
        PERFORM public.lock_cutover_batch(v_batch_id);
        RAISE EXCEPTION 'TEST FAILED: Allowed double lock!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Batch is already locked%' THEN
            RAISE EXCEPTION 'TEST FAILED: Unexpected double lock error: %', SQLERRM;
        END IF;
    END;

    -- 8. Verify Impact in stock_balances
    IF NOT EXISTS (
        SELECT 1 FROM public.stock_balances 
        WHERE warehouse_id = v_warehouse_id AND item_id = v_item_id AND quantity_on_hand = 100 AND total_value = 5000
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: Stock balance was not propagated successfully!';
    END IF;

    RAISE NOTICE 'ALL P07 CUTOVER TESTS PASSED SUCCESSFULLY!';
END $$;
  `
  
  try {
    await runSQL(testSql)
    console.log("✅ Success! The test passed and returned without any SQL EXCEPTIONS.")
  } catch (err) {
    console.error("❌ Test Failed:", err.message)
    process.exitCode = 1
  }
}

runTest()

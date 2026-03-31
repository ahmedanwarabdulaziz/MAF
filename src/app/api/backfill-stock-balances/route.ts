import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// DIAGNOSTIC + BACKFILL route
// GET /api/backfill-stock-balances

export async function GET() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const diag: any = {}

  // 1. Find posted invoices
  const { data: invoices, error: invErr } = await admin
    .from('supplier_invoices')
    .select('id, invoice_no, status, project_id, company_id, created_by, supplier_party_id')
    .in('status', ['posted', 'pending_receipt'])
    .order('created_at', { ascending: false })
    .limit(10)
  diag.invoices = invoices
  diag.invoicesError = invErr?.message

  // 2. Confirmations
  const { data: confs, error: confErr } = await admin
    .from('invoice_receipt_confirmations')
    .select('*')
    .limit(10)
  diag.confirmations = confs
  diag.confirmationsError = confErr?.message

  // 3. Goods receipts
  const { data: grs, error: grErr } = await admin
    .from('goods_receipts')
    .select('*')
    .limit(10)
  diag.goods_receipts = grs
  diag.goods_receipts_error = grErr?.message

  // 4. Stock balances
  const { data: sb, error: sbErr } = await admin
    .from('stock_balances')
    .select('*')
    .limit(10)
  diag.stock_balances = sb
  diag.stock_balances_error = sbErr?.message

  // 5. Stock ledger
  const { data: sl, error: slErr } = await admin
    .from('stock_ledger')
    .select('*')
    .limit(10)
  diag.stock_ledger = sl
  diag.stock_ledger_error = slErr?.message

  // 6. Warehouses for the project
  const { data: wh } = await admin
    .from('warehouses')
    .select('id, arabic_name, project_id, warehouse_type')
    .limit(20)
  diag.warehouses = wh

  // 7. Now attempt backfill for any posted invoices that have confirmations but no stock_balances
  const backfillResults: any[] = []

  if (invoices) {
    for (const inv of invoices) {
      if (inv.status !== 'posted') continue

      const { data: conf } = await admin
        .from('invoice_receipt_confirmations')
        .select('warehouse_id, warehouse_manager_status, pm_status')
        .eq('supplier_invoice_id', inv.id)
        .single()

      if (!conf?.warehouse_id) {
        backfillResults.push({ invoice_no: inv.invoice_no, skip: 'no confirmation or warehouse' })
        continue
      }

      // Get invoice lines
      const { data: lines } = await admin
        .from('supplier_invoice_lines')
        .select('id, item_id, invoiced_quantity, unit_price, item:item_id(primary_unit_id)')
        .eq('invoice_id', inv.id)

      if (!lines?.length) {
        backfillResults.push({ invoice_no: inv.invoice_no, skip: 'no lines' })
        continue
      }

      // Check if GRN exists
      let grnId: string | null = null
      let grnDocNo = 'GRN-BACKFILL-' + inv.invoice_no
      const { data: existingGrn } = await admin
        .from('goods_receipts')
        .select('id, document_no')
        .eq('supplier_invoice_ref', inv.id)
        .limit(1)

      if (existingGrn?.length) {
        grnId = existingGrn[0].id
        grnDocNo = existingGrn[0].document_no
      } else {
        // Create goods receipt
        const { data: newGrn, error: grnErr } = await admin.from('goods_receipts').insert({
          company_id: inv.company_id,
          project_id: inv.project_id,
          warehouse_id: conf.warehouse_id,
          supplier_party_id: inv.supplier_party_id,
          document_no: grnDocNo,
          receipt_date: new Date().toISOString().split('T')[0],
          supplier_invoice_ref: inv.id,
          status: 'confirmed',
          created_by: inv.created_by,
          confirmed_by: inv.created_by,
          confirmed_at: new Date().toISOString()
        }).select().single()

        if (grnErr) {
          backfillResults.push({ invoice_no: inv.invoice_no, error: 'GRN insert: ' + grnErr.message })
          continue
        }
        grnId = newGrn?.id
      }

      let processedLines = 0
      for (const line of lines) {
        const item = Array.isArray(line.item) ? line.item[0] : line.item
        const unitId = (item as any)?.primary_unit_id || line.item_id
        const qty = Number(line.invoiced_quantity) || 0
        const price = Number(line.unit_price) || 0
        const val = qty * price

        if (qty <= 0) continue

        // Check existing stock_balance
        const { data: existing } = await admin
          .from('stock_balances')
          .select('quantity_on_hand, total_value')
          .eq('warehouse_id', conf.warehouse_id)
          .eq('item_id', line.item_id)
          .maybeSingle()

        const prevQty = Number(existing?.quantity_on_hand || 0)
        const prevVal = Number(existing?.total_value || 0)
        const newQty = prevQty + qty
        const newVal = prevVal + val

        // Check if stock_ledger already has this
        const { data: existingLedger } = await admin
          .from('stock_ledger')
          .select('id')
          .eq('document_id', grnId!)
          .eq('item_id', line.item_id)
          .limit(1)

        if (existingLedger?.length) continue // already processed

        // Insert stock_ledger
        const { error: slInsertErr } = await admin.from('stock_ledger').insert({
          warehouse_id: conf.warehouse_id,
          item_id: line.item_id,
          unit_id: unitId,
          project_id: inv.project_id,
          movement_type: 'in',
          document_type: 'goods_receipt',
          document_id: grnId!,
          document_line_id: line.id,
          document_no: grnDocNo,
          qty_in: qty,
          qty_out: 0,
          unit_cost: price,
          total_value: val,
          running_qty: newQty,
          running_value: newVal,
          movement_date: new Date().toISOString().split('T')[0],
          notes: `[تصحيح] استلام بضاعة — فاتورة مورد ${inv.invoice_no}`,
          created_by: inv.created_by,
        })

        if (slInsertErr) {
          backfillResults.push({ invoice_no: inv.invoice_no, item_id: line.item_id, error: 'stock_ledger: ' + slInsertErr.message })
          continue
        }

        // Upsert stock_balances
        const { error: sbUpsertErr } = await admin.from('stock_balances').upsert({
          warehouse_id: conf.warehouse_id,
          item_id: line.item_id,
          quantity_on_hand: newQty,
          total_value: newVal,
          weighted_avg_cost: newQty > 0 ? newVal / newQty : 0,
          last_movement_at: new Date().toISOString(),
        }, { onConflict: 'warehouse_id,item_id' })

        if (sbUpsertErr) {
          backfillResults.push({ invoice_no: inv.invoice_no, item_id: line.item_id, error: 'stock_balances: ' + sbUpsertErr.message })
          continue
        }

        processedLines++
      }

      backfillResults.push({ invoice_no: inv.invoice_no, warehouse_id: conf.warehouse_id, lines_fixed: processedLines })
    }
  }

  diag.backfill_results = backfillResults

  return NextResponse.json(diag)
}

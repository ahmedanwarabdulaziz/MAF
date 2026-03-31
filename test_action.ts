import { getPaymentVoucherDetails } from './src/actions/payments'

async function run() {
  try {
    const res = await getPaymentVoucherDetails('4faed95c-9c3c-411a-821d-93be9fbd5be5')
    console.log("SUCCESS:", res?.id)
  } catch (err: any) {
    console.error("ERROR:", err)
  }
}
run()

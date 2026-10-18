import { NextResponse } from 'next/server';
import { paymentProvider as provider } from '@/lib/payments';
import { admin } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 100_000) return new NextResponse(null, { status: 413 });

  let evt;
  try { evt = provider.verifyWebhook(raw); }                // 1) التحقق من التوقيع/السر
  catch { return new NextResponse(null, { status: 401 }); }

  if (evt.type !== 'payment_paid' || !evt.paymentId) return NextResponse.json({ ok: true, ignored: true });

  try {
    // 2) لا نثق بجسم الـ Webhook: نجلب الدفعة من Moyasar مباشرة
    const pay = await provider.fetchPayment(evt.paymentId);
    if (pay.status !== 'paid' || !pay.orderId || !UUID.test(pay.orderId)) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    // 3) معاملة ذرية: مطابقة المبلغ + Idempotency + تخصيص المخزون
    const { data, error } = await admin().rpc('process_paid_payment', {
      p_order_id: pay.orderId, p_payment_id: pay.id, p_amount: pay.amountHalalas,
      p_currency: pay.currency, p_event_id: evt.eventId, p_event_type: evt.type,
    });
    if (error) throw error;
    console.info('webhook', data);                          // نتيجة فقط، بلا بيانات حساسة
    return NextResponse.json({ ok: true, result: data });
  } catch {
    return new NextResponse(null, { status: 500 });         // 5xx ليعيد Moyasar المحاولة
  }
}

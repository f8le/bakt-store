import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CheckoutBody } from '@/lib/schemas';
import { handle } from '@/lib/api';
import { HttpError, requireUser } from '@/lib/auth';
import { admin } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const idem = req.headers.get('idempotency-key') ?? '';
  if (!z.string().uuid().safeParse(idem).success) throw new HttpError(400, 'طلب غير صالح');
  const body = CheckoutBody.parse(await req.json());

  // السعر يُقرأ داخل الدالة من قاعدة البيانات، ولا يُقبل من العميل أبدًا
  const { data: order, error } = await admin().rpc('create_order', {
    p_user_id: user.id, p_product_id: body.productId, p_qty: body.quantity, p_idem: idem,
  });
  if (error) {
    if (error.message.includes('out_of_stock')) throw new HttpError(409, 'المنتج غير متوفر حاليًا');
    if (error.message.includes('product_unavailable')) throw new HttpError(404, 'المنتج غير موجود');
    throw error;
  }
  if (order.payment_status !== 'pending') throw new HttpError(409, 'هذا الطلب تمت معالجته مسبقًا');

  // بيانات تهيئة نموذج Moyasar (المفتاح هنا publishable فقط)
  return NextResponse.json({
    orderId: order.id,
    amount: order.total_halalas,
    currency: order.currency,
    description: order.product_name,
    publishableKey: env().MOYASAR_PUBLISHABLE_KEY,
    callbackUrl: `${env().NEXT_PUBLIC_SITE_URL}/orders/${order.id}`,
    metadata: { order_id: order.id },
  }, { headers: { 'Cache-Control': 'no-store' } });
});

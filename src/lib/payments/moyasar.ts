import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../env';
import type { PaymentProvider } from './types';

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const moyasar: PaymentProvider = {
  name: 'moyasar',

  verifyWebhook(raw) {
    const body = JSON.parse(raw);
    // Moyasar ترسل secret_token داخل الـ payload ويجب مطابقته للقيمة المضبوطة في لوحتها
    if (typeof body?.secret_token !== 'string' || !safeEqual(body.secret_token, env().MOYASAR_WEBHOOK_SECRET)) {
      throw new Error('invalid_signature');
    }
    if (typeof body.id !== 'string') throw new Error('invalid_event');
    return { eventId: body.id, type: String(body.type), paymentId: body.data?.id ?? null };
  },

  async fetchPayment(paymentId) {
    const res = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: 'Basic ' + btoa(env().MOYASAR_SECRET_KEY + ':') },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('provider_fetch_failed');
    const p = await res.json();
    const known = ['paid', 'failed', 'refunded'];
    return {
      id: p.id,
      status: known.includes(p.status) ? p.status : p.status === 'initiated' ? 'pending' : 'other',
      amountHalalas: p.amount,                 // Moyasar تعمل بأصغر وحدة (هللة)
      currency: String(p.currency).toUpperCase(),
      orderId: p.metadata?.order_id ?? null,
    };
  },
};

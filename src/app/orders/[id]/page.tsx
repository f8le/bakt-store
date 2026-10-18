import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { FULFIL_LABELS, PAY_LABELS, UUID_RE, formatSAR } from '@/lib/format';
import { SITE } from '@/lib/site';
import AutoRefresh from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'تفاصيل الطلب', robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { sb } = await requirePageUser(`/orders/${id}`);
  const { data: o } = await sb.from('orders').select('id,product_name,quantity,total_halalas,payment_status,fulfillment_status,created_at').eq('id', id).maybeSingle();
  if (!o) notFound();
  // الحالة الموثوقة تأتي من قاعدة البيانات (يحدّثها الـ Webhook فقط) وليس من معاملات الرابط

  const waiting = o.payment_status === 'pending' || (o.payment_status === 'paid' && o.fulfillment_status === 'pending');
  return (
    <div className="mx-auto max-w-lg space-y-4">
      {waiting && <AutoRefresh />}
      <div className="card space-y-2 p-5">
        <h1 className="text-xl font-bold">الطلب</h1>
        <div>{o.product_name} × {o.quantity}</div>
        <div className="font-bold">{formatSAR(o.total_halalas)}</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-neutral-100 px-3 py-1">الدفع: {PAY_LABELS[o.payment_status]}</span>
          <span className="rounded-full bg-neutral-100 px-3 py-1">التسليم: {FULFIL_LABELS[o.fulfillment_status]}</span>
        </div>
      </div>

      {o.payment_status === 'pending' && (
        <div className="card space-y-3 p-5">
          <p>بانتظار تأكيد الدفع من البنك… إن أتممت الدفع فستتحدّث الصفحة تلقائيًا.</p>
          <Link href={`/pay/${o.id}`} className="btn-ghost">لم أُكمل الدفع، العودة لصفحة الدفع</Link>
        </div>
      )}
      {o.payment_status === 'paid' && o.fulfillment_status === 'fulfilled' && (
        <div className="card space-y-3 border-green-300 bg-green-50 p-5">
          <p className="font-semibold text-green-800">تم الدفع وتسليم طلبك 🎉</p>
          <Link href="/account/products" className="btn">عرض منتجي</Link>
        </div>
      )}
      {o.payment_status === 'paid' && o.fulfillment_status === 'failed' && (
        <div className="card space-y-2 border-amber-300 bg-amber-50 p-5 text-amber-900">
          <p className="font-semibold">تم الدفع لكن تعذّر التسليم تلقائيًا.</p>
          <p className="text-sm">لا تقلق، حقك محفوظ. تواصل معنا وأرسل رقم الطلب وسنعالجه أو نسترد المبلغ: {SITE.email} — ديسكورد: {SITE.discord}</p>
          <p className="select-all text-xs" dir="ltr">{o.id}</p>
        </div>
      )}
      {(o.payment_status === 'failed' || o.payment_status === 'refunded') && (
        <div className="card p-5">{o.payment_status === 'failed' ? 'فشلت عملية الدفع.' : 'تم استرداد المبلغ لهذا الطلب.'}</div>
      )}
    </div>
  );
}

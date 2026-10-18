import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { UUID_RE, formatSAR } from '@/lib/format';
import { SITE } from '@/lib/site';
import PayForm from '@/components/PayForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'إتمام الدفع', robots: { index: false } };

export default async function Pay({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) notFound();
  const { sb } = await requirePageUser(`/pay/${orderId}`);
  // RLS: لا يرى إلا طلباته. والمبلغ يُقرأ من قاعدة البيانات وليس من الرابط
  const { data: o } = await sb.from('orders').select('id,product_name,quantity,total_halalas,payment_status').eq('id', orderId).maybeSingle();
  if (!o) notFound();
  if (o.payment_status !== 'pending') redirect(`/orders/${o.id}`);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card p-4">
        <div className="text-sm text-neutral-500">ملخص الطلب</div>
        <div className="mt-1 font-semibold">{o.product_name} × {o.quantity}</div>
        <div className="mt-2 flex justify-between border-t pt-2"><span>الإجمالي</span><span className="font-bold">{formatSAR(o.total_halalas)}</span></div>
      </div>
      <div className="card p-4">
        <PayForm orderId={o.id} amount={o.total_halalas} description={`${SITE.nameAr} - ${o.product_name}`.slice(0, 200)}
          publishableKey={process.env.MOYASAR_PUBLISHABLE_KEY!} callbackUrl={`${SITE.url}/orders/${o.id}`} />
      </div>
      <p className="text-center text-xs text-neutral-500">تتم معالجة الدفع لدى بوابة الدفع مباشرة، ولا تمر بيانات بطاقتك عبر خوادمنا.</p>
    </div>
  );
}

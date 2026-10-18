import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FULFIL_LABELS, PAY_LABELS, UUID_RE, formatSAR } from '@/lib/format';
import { getOrderAdmin, requireAdminPage } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';
export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/orders/${id}`);
  if (!UUID_RE.test(id)) notFound();
  const d = await getOrderAdmin(id);
  if (!d) notFound();
  const { order: o } = d;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">طلب <span dir="ltr" className="text-lg">{o.id.slice(0, 8)}</span></h1><Link href="/admin/orders" className="text-sm text-brand">كل الطلبات</Link></div>
      <section className="card grid gap-2 p-4 text-sm sm:grid-cols-2">
        <div>العميل: <span dir="ltr">{d.email}</span></div><div>المنتج: {o.product_name} × {o.quantity}</div>
        <div>المبلغ: <b>{formatSAR(o.total_halalas)}</b></div><div>التاريخ: {new Date(o.created_at).toLocaleString('ar-SA-u-nu-latn')}</div>
        <div>الدفع: <b>{PAY_LABELS[o.payment_status]}</b></div><div>التسليم: <b>{FULFIL_LABELS[o.fulfillment_status]}</b></div>
        <div className="sm:col-span-2" dir="ltr">ID: {o.id}</div>
        {o.payment_reference && <div className="sm:col-span-2" dir="ltr">Payment ref: {o.payment_reference}</div>}
      </section>
      {o.payment_status === 'paid' && o.fulfillment_status === 'failed' && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">دفع العميل وتعذّر التسليم. أضف مخزونًا للمنتج ثم تواصل مع العميل، أو أعد له المبلغ من لوحة Moyasar. (لا تُغيَّر حالات الطلب يدويًا من هنا عمدًا)</p>)}
      <section className="card p-4 text-sm"><h2 className="mb-2 font-bold">المدفوعات ({d.payments.length})</h2>
        {d.payments.map((p) => <div key={p.provider_payment_id} className="flex justify-between border-t py-2" dir="ltr"><span>{p.provider}: {p.provider_payment_id}</span><span>{formatSAR(p.amount_halalas)} • {p.status}</span></div>)}
        {d.payments.length === 0 && <p className="text-neutral-500">لا مدفوعات.</p>}</section>
      <section className="card p-4 text-sm"><h2 className="mb-2 font-bold">التسليم ({d.deliveries.length})</h2>
        {d.deliveries.map((x) => <div key={x.inventory_item_id} className="border-t py-2" dir="ltr">item {x.inventory_item_id.slice(0, 8)} • {new Date(x.delivered_at).toLocaleString('en-GB')}</div>)}
        {d.deliveries.length === 0 && <p className="text-neutral-500">لا تسليم.</p>}</section>
      <section className="card p-4 text-sm"><h2 className="mb-2 font-bold">السجل</h2>
        {d.logs.map((l, i) => <div key={i} className="flex justify-between border-t py-2" dir="ltr"><span>{l.action}</span><span className="text-neutral-400">{new Date(l.created_at).toLocaleString('en-GB')}</span></div>)}
        {d.logs.length === 0 && <p className="text-neutral-500">لا أحداث.</p>}</section>
    </div>
  );
}

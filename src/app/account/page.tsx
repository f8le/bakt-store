import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { FULFIL_LABELS, PAY_LABELS, formatSAR } from '@/lib/format';
import AccountSettings from '@/components/AccountSettings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'حسابي', robots: { index: false } };

export default async function Account() {
  const { user, sb } = await requirePageUser('/account');
  const [{ data: profile }, { data: orders }] = await Promise.all([
    sb.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(),
    sb.from('orders').select('id,product_name,quantity,total_halalas,payment_status,fulfillment_status,created_at').order('created_at', { ascending: false }).limit(50),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">حسابي</h1><p className="text-sm text-neutral-500" dir="ltr">{user.email}</p></div>
        <Link href="/account/products" className="btn">منتجاتي</Link>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">طلباتي</h2>
        {!orders?.length ? <p className="card p-8 text-center text-neutral-500">لا توجد طلبات بعد.</p> : (
          <div className="space-y-2">
            {orders.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-2 p-4 hover:shadow-md">
                <div><div className="font-semibold">{o.product_name} × {o.quantity}</div>
                  <div className="text-xs text-neutral-500">{new Date(o.created_at).toLocaleDateString('ar-SA-u-nu-latn')}</div></div>
                <div className="text-sm"><span className="font-bold">{formatSAR(o.total_halalas)}</span>
                  <span className="ms-3 text-neutral-500">{PAY_LABELS[o.payment_status]} • {FULFIL_LABELS[o.fulfillment_status]}</span></div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <AccountSettings userId={user.id} fullName={profile?.full_name ?? ''} phone={profile?.phone ?? ''} />
    </div>
  );
}

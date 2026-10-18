import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import SecretReveal from '@/components/SecretReveal';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'منتجاتي', robots: { index: false } };

type Item = { order_id: string; product_name: string; secret: string; instructions: string | null; delivered_at: string };

export default async function MyProducts() {
  const { sb } = await requirePageUser('/account/products');
  const { data } = await sb.rpc('my_deliveries'); // مقيّدة بـ auth.uid() وطلب مدفوع
  const items = (data ?? []) as Item[];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">منتجاتي</h1><Link href="/account" className="text-sm text-brand">حسابي</Link></div>
      {items.length === 0 ? <p className="card p-10 text-center text-neutral-500">لم تشترِ أي منتج بعد.</p> : items.map((it, i) => (
        <div key={`${it.order_id}-${i}`} className="card space-y-3 p-4">
          <div className="font-bold">{it.product_name}</div>
          <SecretReveal value={it.secret} />
          {it.instructions && <p className="whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{it.instructions}</p>}
          <Link href={`/orders/${it.order_id}`} className="text-xs text-neutral-500 hover:text-brand">تفاصيل الطلب</Link>
        </div>
      ))}
    </div>
  );
}

import Link from 'next/link';
import { formatSAR } from '@/lib/format';
import { getStats, logAdminAccess, requireAdminPage } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const me = await requireAdminPage('/admin');
  await logAdminAccess(me.id);
  const s = await getStats();
  const cards: [string, string | number][] = [
    ['إجمالي المبيعات', formatSAR(s.sales_halalas)], ['الطلبات', s.orders_total], ['مدفوعة', s.orders_paid],
    ['طلبات جديدة (24 ساعة)', s.orders_new_24h], ['بانتظار الدفع', s.orders_pending], ['العملاء', s.customers],
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>
      {s.fulfillment_failed > 0 && (
        <Link href="/admin/orders?pay=paid&ful=failed" className="block rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
          ⚠️ {s.fulfillment_failed} طلب مدفوع تعذّر تسليمه (نفاد مخزون غالبًا). أضف مخزونًا ثم تواصل مع العميل أو أعد له المبلغ.
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(([t, v]) => <div key={t} className="card p-4"><div className="text-sm text-neutral-500">{t}</div><div className="mt-1 text-2xl font-bold">{v}</div></div>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4"><h2 className="mb-2 font-bold">الأكثر مبيعًا</h2>
          {s.top_products.length === 0 ? <p className="text-sm text-neutral-500">لا مبيعات بعد.</p> : (
            <ul className="divide-y text-sm">{s.top_products.map((p) => <li key={p.product_name} className="flex justify-between py-2"><span>{p.product_name}</span><span>{p.qty} • {formatSAR(p.revenue)}</span></li>)}</ul>)}
        </section>
        <section className="card p-4"><h2 className="mb-2 font-bold">مخزون منخفض (≤ 5)</h2>
          {s.low_stock.length === 0 ? <p className="text-sm text-neutral-500">لا شيء.</p> : (
            <ul className="divide-y text-sm">{s.low_stock.map((p) => <li key={p.id} className="flex justify-between py-2"><Link className="text-brand" href={`/admin/inventory/${p.id}`}>{p.name}</Link><span className={p.available === 0 ? 'font-bold text-red-600' : ''}>{p.available}</span></li>)}</ul>)}
        </section>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { FULFIL_LABELS, PAY_LABELS, formatSAR } from '@/lib/format';
import { PAGE_SIZE, listOrdersAdmin, requireAdminPage } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';
type SP = { q?: string; pay?: string; ful?: string; page?: string };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdminPage('/admin/orders');
  const sp = await searchParams;
  const pay = sp.pay && sp.pay in PAY_LABELS ? sp.pay : '';          // قيم مسموحة فقط
  const ful = sp.ful && sp.ful in FULFIL_LABELS ? sp.ful : '';
  const q = (sp.q ?? '').trim().slice(0, 80);
  const page = Math.min(Math.max(parseInt(sp.page ?? '1', 10) || 1, 1), 1000);
  const rows = await listOrdersAdmin({ q, pay, ful, page });
  const total = rows[0] ? Number(rows[0].total_count) : 0;
  const qs = (p: number) => `?${new URLSearchParams({ q, pay, ful, page: String(p) })}`;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الطلبات</h1>
      <form className="card grid gap-2 p-3 sm:grid-cols-4">
        <input name="q" defaultValue={q} placeholder="رقم الطلب / بريد / منتج" className="input sm:col-span-2" maxLength={80} />
        <select name="pay" defaultValue={pay} className="input"><option value="">كل حالات الدفع</option>{Object.entries(PAY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="ful" defaultValue={ful} className="input"><option value="">كل حالات التسليم</option>{Object.entries(FULFIL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn sm:col-span-4">تصفية</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500"><tr><th className="p-3 text-start">الطلب</th><th className="text-start">العميل</th><th className="text-start">المنتج</th><th className="text-start">المبلغ</th><th className="text-start">الدفع</th><th className="text-start">التسليم</th></tr></thead>
          <tbody className="divide-y">
            {rows.map((o) => (
              <tr key={o.id} className={o.payment_status === 'paid' && o.fulfillment_status === 'failed' ? 'bg-red-50' : ''}>
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="text-brand" dir="ltr">{o.id.slice(0, 8)}</Link><div className="text-xs text-neutral-400">{new Date(o.created_at).toLocaleString('ar-SA-u-nu-latn')}</div></td>
                <td dir="ltr" className="text-start">{o.email ?? '—'}</td><td>{o.product_name} × {o.quantity}</td><td>{formatSAR(o.total_halalas)}</td>
                <td>{PAY_LABELS[o.payment_status]}</td><td>{FULFIL_LABELS[o.fulfillment_status]}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-neutral-500">لا نتائج.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-500">{total} طلب</span>
        <div className="flex gap-2">{page > 1 && <Link href={qs(page - 1)} className="btn-ghost">السابق</Link>}{page * PAGE_SIZE < total && <Link href={qs(page + 1)} className="btn-ghost">التالي</Link>}</div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { formatSAR } from '@/lib/format';
import { PAGE_SIZE, listCustomersAdmin, requireAdminPage } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';
export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdminPage('/admin/customers');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const page = Math.min(Math.max(parseInt(sp.page ?? '1', 10) || 1, 1), 1000);
  const rows = await listCustomersAdmin(q, page);
  const total = rows[0] ? Number(rows[0].total_count) : 0;
  const qs = (p: number) => `?${new URLSearchParams({ q, page: String(p) })}`;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">العملاء</h1>
      <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="بريد أو اسم" maxLength={80} className="input" /><button className="btn">بحث</button></form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500"><tr><th className="p-3 text-start">العميل</th><th className="text-start">الطلبات المدفوعة</th><th className="text-start">إجمالي الإنفاق</th><th className="text-start">الدور</th><th className="text-start">تسجيل</th></tr></thead>
          <tbody className="divide-y">
            {rows.map((c) => (
              <tr key={c.id}><td className="p-3"><div dir="ltr" className="text-start">{c.email}</div><div className="text-xs text-neutral-500">{c.full_name}</div></td>
                <td>{Number(c.orders_count)}</td><td>{formatSAR(Number(c.total_spent))}</td><td>{c.role === 'admin' ? 'مدير' : 'عميل'}</td><td>{new Date(c.created_at).toLocaleDateString('ar-SA-u-nu-latn')}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-neutral-500">لا نتائج.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm"><span className="text-neutral-500">{total} عميل</span>
        <div className="flex gap-2">{page > 1 && <Link href={qs(page - 1)} className="btn-ghost">السابق</Link>}{page * PAGE_SIZE < total && <Link href={qs(page + 1)} className="btn-ghost">التالي</Link>}</div></div>
    </div>
  );
}

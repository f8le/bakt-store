import Link from 'next/link';
import { getInventorySummary, requireAdminPage } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';
export default async function InventoryIndex() {
  await requireAdminPage('/admin/inventory');
  const rows = await getInventorySummary();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">المخزون</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500"><tr><th className="p-3 text-start">المنتج</th><th className="text-start">المتاح</th><th className="text-start">المباع</th><th /></tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.product_id}>
                <td className="p-3 font-medium">{r.name}{!r.is_active && <span className="ms-2 text-xs text-neutral-400">(موقوف)</span>}</td>
                <td className={Number(r.available) === 0 ? 'font-bold text-red-600' : ''}>{Number(r.available)}</td><td>{Number(r.sold)}</td>
                <td className="p-3"><Link href={`/admin/inventory/${r.product_id}`} className="text-brand">إدارة</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-neutral-500">أضف منتجًا أولًا.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

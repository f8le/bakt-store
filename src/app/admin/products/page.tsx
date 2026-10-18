import Link from 'next/link';
import { formatSAR, TYPE_LABELS } from '@/lib/format';
import { listCategoriesAdmin, listProductsAdmin, requireAdminPage } from '@/lib/admin-data';
import { CategoryAdd, DeleteButton } from '@/components/AdminButtons';

export const dynamic = 'force-dynamic';

export default async function AdminProducts() {
  await requireAdminPage('/admin/products');
  const [products, cats] = await Promise.all([listProductsAdmin(), listCategoriesAdmin()]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">المنتجات</h1><Link href="/admin/products/new" className="btn">+ منتج جديد</Link></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500"><tr><th className="p-3 text-start">المنتج</th><th className="text-start">النوع</th><th className="text-start">السعر</th><th className="text-start">المتاح</th><th className="text-start">الحالة</th><th /></tr></thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="p-3 font-medium">{p.name}</td><td>{TYPE_LABELS[p.product_type]}</td><td>{formatSAR(p.price_halalas)}</td>
                <td className={p.available === 0 ? 'font-bold text-red-600' : ''}><Link href={`/admin/inventory/${p.id}`} className="underline">{p.available}</Link></td>
                <td>{p.is_active ? <span className="text-green-700">نشط</span> : <span className="text-neutral-400">موقوف</span>}</td>
                <td className="flex gap-3 whitespace-nowrap p-3"><Link href={`/admin/products/${p.id}`} className="text-brand">تعديل</Link>
                  <DeleteButton url={`/api/admin/products/${p.id}`} confirmText={`حذف «${p.name}»؟ سيختفي من المتجر وتبقى سجلات طلباته.`} /></td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-neutral-500">لا منتجات. أضف أول منتج.</td></tr>}
          </tbody>
        </table>
      </div>
      <section className="card space-y-3 p-4">
        <h2 className="font-bold">التصنيفات</h2>
        <div className="flex flex-wrap gap-2">{cats.map((c) => <span key={c.id} className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-sm">{c.name}<DeleteButton url={`/api/admin/categories/${c.id}`} confirmText={`حذف التصنيف «${c.name}»؟`} label="×" /></span>)}</div>
        <CategoryAdd />
      </section>
    </div>
  );
}

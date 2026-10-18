import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UUID_RE } from '@/lib/format';
import { getInventoryForProduct, requireAdminPage } from '@/lib/admin-data';
import { DeleteButton, InventoryAdd } from '@/components/AdminButtons';

export const dynamic = 'force-dynamic';
export default async function ProductInventory({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  await requireAdminPage(`/admin/inventory/${productId}`);
  if (!UUID_RE.test(productId)) notFound();
  const { product, available, sold } = await getInventoryForProduct(productId);
  if (!product) notFound();
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">مخزون: {product.name}</h1><p className="text-sm text-neutral-500">المتاح {available.length} • المباع (آخر 100) {sold.length}. تُعرض آخر 3 خانات فقط من كل عنصر لحمايتها.</p></div>
      <InventoryAdd productId={product.id} />
      <section className="card p-4"><h2 className="mb-2 font-bold">المتاح</h2>
        {available.length === 0 ? <p className="text-sm text-neutral-500">لا عناصر متاحة.</p> : (
          <ul className="divide-y text-sm">{available.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2"><code dir="ltr">{i.preview}</code>
              <DeleteButton url={`/api/admin/inventory/${i.id}`} confirmText="حذف هذا العنصر من المخزون؟" /></li>))}</ul>)}
      </section>
      <section className="card p-4"><h2 className="mb-2 font-bold">المباع (ولأي طلب)</h2>
        {sold.length === 0 ? <p className="text-sm text-neutral-500">لا مبيعات.</p> : (
          <ul className="divide-y text-sm">{sold.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2"><code dir="ltr">{i.preview}</code>
              <Link href={`/admin/orders/${i.order_id}`} className="text-brand">طلب {String(i.order_id).slice(0, 8)}</Link></li>))}</ul>)}
      </section>
    </div>
  );
}

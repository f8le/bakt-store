import { notFound } from 'next/navigation';
import { UUID_RE } from '@/lib/format';
import { getProductAdmin, listCategoriesAdmin, requireAdminPage } from '@/lib/admin-data';
import ProductForm from '@/components/ProductForm';

export const dynamic = 'force-dynamic';
export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/products/${id}`);
  if (!UUID_RE.test(id)) notFound();
  const [p, cats] = await Promise.all([getProductAdmin(id), listCategoriesAdmin()]);
  if (!p) notFound();
  return <div className="space-y-4"><h1 className="text-2xl font-bold">تعديل: {p.name}</h1><ProductForm product={p} categories={cats} /></div>;
}

import { listCategoriesAdmin, requireAdminPage } from '@/lib/admin-data';
import ProductForm from '@/components/ProductForm';

export const dynamic = 'force-dynamic';
export default async function NewProduct() {
  await requireAdminPage('/admin/products/new');
  return <div className="space-y-4"><h1 className="text-2xl font-bold">منتج جديد</h1><ProductForm categories={await listCategoriesAdmin()} /></div>;
}

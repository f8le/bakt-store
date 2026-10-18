import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'لوحة الإدارة', robots: { index: false, follow: false } };
const nav = [['/admin', 'الرئيسية'], ['/admin/products', 'المنتجات'], ['/admin/inventory', 'المخزون'], ['/admin/orders', 'الطلبات'], ['/admin/customers', 'العملاء'], ['/admin/audit', 'السجل']];

// الـ layout للعرض فقط. كل صفحة وكل دالة بيانات تتحقق من الصلاحية بنفسها
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <nav className="-mx-4 flex gap-2 overflow-x-auto border-b bg-white px-4 py-2 text-sm">
        {nav.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-neutral-100">{label}</Link>)}
      </nav>
      {children}
    </div>
  );
}

import Link from 'next/link';
import { SITE } from '@/lib/site';
import { listProducts } from '@/lib/storefront';
import ProductCard from '@/components/ProductCard';

export const dynamic = 'force-dynamic'; // المخزون يجب أن يكون دقيقًا

export default async function Home() {
  const products = await listProducts({ limit: 12 });
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-l from-brand to-brand-dark p-8 text-white md:p-12">
        <h1 className="text-3xl font-bold md:text-4xl">{SITE.nameAr} <span className="text-white/60">| {SITE.nameEn}</span></h1>
        <p className="mt-3 max-w-xl text-white/85">{SITE.tagline}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/products" className="rounded-xl bg-white px-5 py-3 font-semibold text-brand">تصفّح المنتجات</Link>
          <Link href="/faq" className="rounded-xl border border-white/40 px-5 py-3 font-semibold">كيف أشتري؟</Link>
        </div>
      </section>
      <section className="grid gap-3 text-sm sm:grid-cols-3">
        {[['تسليم تلقائي', 'يصلك منتجك في حسابك فور تأكيد الدفع'], ['دفع آمن', 'عبر بوابة دفع مرخّصة، ولا نخزّن بيانات بطاقتك'], ['دعم مباشر', 'عبر البريد أو ديسكورد']].map(([t, d]) => (
          <div key={t} className="card p-4"><div className="font-bold">{t}</div><div className="mt-1 text-neutral-500">{d}</div></div>
        ))}
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">المنتجات</h2><Link href="/products" className="text-sm text-brand">عرض الكل</Link></div>
        {products.length === 0
          ? <p className="card p-10 text-center text-neutral-500">لا توجد منتجات حاليًا، عُد قريبًا.</p>
          : <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
      </section>
    </div>
  );
}

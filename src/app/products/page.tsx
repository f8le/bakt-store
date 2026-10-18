import type { Metadata } from 'next';
import Link from 'next/link';
import { listCategories, listProducts } from '@/lib/storefront';
import ProductCard from '@/components/ProductCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'المنتجات', alternates: { canonical: '/products' } };

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const { q, c } = await searchParams;
  const categories = await listCategories();
  const cat = categories.find((x) => x.slug === c);
  const products = await listProducts({ q: q?.trim() || undefined, categoryId: cat?.id });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">المنتجات</h1>
      <form className="flex gap-2" action="/products">
        {cat && <input type="hidden" name="c" value={cat.slug} />}
        <input name="q" defaultValue={q ?? ''} maxLength={50} placeholder="ابحث عن منتج…" className="input" />
        <button className="btn">بحث</button>
      </form>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/products" className={`rounded-full border px-3 py-1 ${!cat ? 'border-brand bg-brand text-white' : 'bg-white'}`}>الكل</Link>
          {categories.map((x) => (
            <Link key={x.id} href={`/products?c=${x.slug}`} className={`rounded-full border px-3 py-1 ${cat?.id === x.id ? 'border-brand bg-brand text-white' : 'bg-white'}`}>{x.name}</Link>
          ))}
        </div>
      )}
      {products.length === 0
        ? <p className="card p-10 text-center text-neutral-500">لا توجد نتائج.</p>
        : <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
    </div>
  );
}

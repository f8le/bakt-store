import Link from 'next/link';
import { formatSAR, TYPE_LABELS } from '@/lib/format';
import type { Product } from '@/lib/storefront';

export default function ProductCard({ p }: { p: Product }) {
  const discount = p.compare_at_halalas && p.compare_at_halalas > p.price_halalas
    ? Math.round((1 - p.price_halalas / p.compare_at_halalas) * 100) : 0;
  return (
    <Link href={`/products/${p.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-square bg-gradient-to-br from-brand/10 to-brand/30">
        {p.image_url
          ? <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center text-5xl font-bold text-brand/40">{p.name.slice(0, 1)}</div>}
        {discount > 0 && <span className="absolute start-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">-{discount}%</span>}
        {!p.in_stock && <div className="absolute inset-0 flex items-center justify-center bg-white/70 font-bold text-neutral-600">غير متوفر</div>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="line-clamp-2 font-semibold group-hover:text-brand">{p.name}</div>
        <div className="text-xs text-neutral-500">{[TYPE_LABELS[p.product_type], p.duration].filter(Boolean).join(' • ')}</div>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="font-bold">{formatSAR(p.price_halalas)}</span>
          {discount > 0 && <s className="text-xs text-neutral-400">{formatSAR(p.compare_at_halalas!)}</s>}
        </div>
      </div>
    </Link>
  );
}

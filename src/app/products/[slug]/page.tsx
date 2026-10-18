import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE } from '@/lib/site';
import { featureList, getProduct } from '@/lib/storefront';
import { formatSAR, TYPE_LABELS } from '@/lib/format';
import BuyButton from '@/components/BuyButton';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return { title: 'المنتج غير موجود', robots: { index: false } };
  const desc = (p.description ?? SITE.tagline).slice(0, 160);
  return {
    title: p.name, description: desc, alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.name, description: desc, type: 'website', images: p.image_url ? [p.image_url] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const features = featureList(p.features);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description ?? undefined,
    image: p.image_url ?? undefined, brand: { '@type': 'Brand', name: SITE.nameAr },
    offers: { '@type': 'Offer', priceCurrency: 'SAR', price: (p.price_halalas / 100).toFixed(2), url: `${SITE.url}/products/${p.slug}`,
      availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* escape لمنع كسر وسم script من بيانات المنتج */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <div className="card aspect-square overflow-hidden bg-gradient-to-br from-brand/10 to-brand/30">
        {p.image_url
          ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center text-8xl font-bold text-brand/40">{p.name.slice(0, 1)}</div>}
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{p.name}</h1>
        <div className="text-sm text-neutral-500">{[TYPE_LABELS[p.product_type], p.duration].filter(Boolean).join(' • ')}</div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold">{formatSAR(p.price_halalas)}</span>
          {p.compare_at_halalas && p.compare_at_halalas > p.price_halalas && <s className="text-neutral-400">{formatSAR(p.compare_at_halalas)}</s>}
        </div>
        {p.description && <p className="whitespace-pre-wrap leading-7 text-neutral-700">{p.description}</p>}
        {features.length > 0 && <ul className="list-inside list-disc space-y-1 text-neutral-700">{features.map((f) => <li key={f}>{f}</li>)}</ul>}
        <BuyButton productId={p.id} slug={p.slug} inStock={p.in_stock} />
        <p className="text-xs text-neutral-500">يُسلَّم المنتج تلقائيًا في حسابك بعد تأكيد الدفع. راجع <a href="/refund" className="text-brand underline">سياسة الاسترجاع</a> قبل الشراء.</p>
      </div>
    </div>
  );
}

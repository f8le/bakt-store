import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { INFO } from '@/lib/pages';
import { listProducts } from '@/lib/storefront';

export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await listProducts({ limit: 1000 });
  return [
    { url: SITE.url, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE.url}/products`, changeFrequency: 'daily', priority: 0.9 },
    ...products.map((p) => ({ url: `${SITE.url}/products/${p.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...Object.keys(INFO).map((k) => ({ url: `${SITE.url}/${k}`, changeFrequency: 'monthly' as const, priority: 0.3 })),
  ];
}

import 'server-only';
import { createClient } from '@supabase/supabase-js';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

export type Product = {
  id: string; slug: string; name: string; description: string | null; image_url: string | null;
  price_halalas: number; compare_at_halalas: number | null; duration: string | null; product_type: string;
  features: unknown; category_id: string | null; in_stock: boolean;
};
export type Category = { id: string; slug: string; name: string };

const COLS = 'id,slug,name,description,image_url,price_halalas,compare_at_halalas,duration,product_type,features,category_id,in_stock';

export async function listCategories(): Promise<Category[]> {
  const { data } = await sb().from('categories').select('id,slug,name').order('sort_order');
  return (data ?? []) as Category[];
}

export async function listProducts(opts: { q?: string; categoryId?: string; limit?: number } = {}): Promise<Product[]> {
  let q = sb().from('storefront_products').select(COLS).order('name').limit(opts.limit ?? 60);
  if (opts.q) q = q.ilike('name', `%${opts.q.slice(0, 50).replace(/[\\%_]/g, '\\$&')}%`);
  if (opts.categoryId) q = q.eq('category_id', opts.categoryId);
  const { data } = await q;
  return (data ?? []) as Product[];
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (!/^[a-z0-9-]{1,100}$/i.test(slug)) return null;
  const { data } = await sb().from('storefront_products').select(COLS).eq('slug', slug).maybeSingle();
  return (data as Product | null) ?? null;
}

export const featureList = (f: unknown): string[] => (Array.isArray(f) ? f.filter((x): x is string => typeof x === 'string').slice(0, 12) : []);

import { z } from 'zod';

export const CheckoutBody = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(5).default(1),
}).strict();                                           // يرفض أي حقل زائد (Mass Assignment) مثل price

// ================= الإدارة =================
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug').max(100);
const httpsUrl = z.string().max(500).url().refine((u) => u.startsWith('https://'), 'https only');

export const ProductInput = z.object({
  name: z.string().trim().min(1).max(120),
  slug,
  description: z.string().trim().max(5000).nullable().optional(),
  image_url: httpsUrl.nullable().optional(),
  price_halalas: z.number().int().min(0).max(10_000_000),          // حتى 100,000 ر.س
  compare_at_halalas: z.number().int().min(0).max(10_000_000).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  duration: z.string().trim().max(60).nullable().optional(),
  product_type: z.enum(['code', 'account', 'subscription', 'key']),
  features: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
  delivery_instructions: z.string().trim().max(3000).nullable().optional(),
  is_active: z.boolean().default(true),
}).strict();
export const ProductPatch = ProductInput.partial().strict();

export const InventoryAdd = z.object({
  productId: z.string().uuid(),
  items: z.array(z.string().trim().min(1).max(2000)).min(1).max(500),
}).strict();

export const CategoryInput = z.object({ name: z.string().trim().min(1).max(60), slug }).strict();

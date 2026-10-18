import 'server-only';
import { admin } from './supabase/admin';
import { audit } from './audit';
import { HttpError } from './http-error';
import type { z } from 'zod';
import type { ProductInput, ProductPatch, CategoryInput } from './schemas';

type Me = { id: string };
const conflict = (e: { code?: string } | null, msg: string) => { if (e?.code === '23505') throw new HttpError(409, msg); };

export async function createProduct(me: Me, input: z.infer<typeof ProductInput>) {
  const { data, error } = await admin().from('products').insert(input).select('id').single();
  conflict(error, 'المعرّف (slug) مستخدم لمنتج آخر');
  if (error) throw error;
  await audit(me.id, 'product.create', 'product', data.id, { name: input.name, price_halalas: input.price_halalas });
  return data.id as string;
}

export async function updateProduct(me: Me, id: string, patch: z.infer<typeof ProductPatch>) {
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'لا توجد تعديلات');
  const db = admin();
  const { data: old } = await db.from('products').select('price_halalas,is_active,deleted_at').eq('id', id).maybeSingle();
  if (!old || old.deleted_at) throw new HttpError(404, 'المنتج غير موجود');
  const { error } = await db.from('products').update(patch).eq('id', id);
  conflict(error, 'المعرّف (slug) مستخدم لمنتج آخر');
  if (error) throw error;
  if (patch.price_halalas !== undefined && patch.price_halalas !== old.price_halalas)
    await audit(me.id, 'product.price_change', 'product', id, { from: old.price_halalas, to: patch.price_halalas });
  if (patch.is_active !== undefined && patch.is_active !== old.is_active)
    await audit(me.id, 'product.status_change', 'product', id, { is_active: patch.is_active });
  const others = Object.keys(patch).filter((k) => !['price_halalas', 'is_active'].includes(k));
  if (others.length) await audit(me.id, 'product.update', 'product', id, { fields: others });   // أسماء الحقول فقط
}

export async function deleteProduct(me: Me, id: string) {
  // Soft delete: يبقى السجل التاريخي للطلبات
  const { data, error } = await admin().from('products').update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id).is('deleted_at', null).select('id');
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, 'المنتج غير موجود');
  await audit(me.id, 'product.delete', 'product', id);
}

export async function addInventory(me: Me, productId: string, rawItems: string[]) {
  const items = [...new Set(rawItems)];
  const db = admin();
  const { data: p } = await db.from('products').select('id').eq('id', productId).is('deleted_at', null).maybeSingle();
  if (!p) throw new HttpError(404, 'المنتج غير موجود');
  const { error } = await db.from('inventory_items').insert(items.map((secret) => ({ product_id: productId, secret, created_by: me.id })));
  conflict(error, 'بعض العناصر مكررة ولم يُضف شيء');
  if (error) throw error;
  await audit(me.id, 'inventory.add', 'product', productId, { count: items.length });   // العدد فقط، بلا أسرار
  return items.length;
}

export async function deleteInventoryItem(me: Me, id: string) {
  // لا يُحذف إلا المتاح. المُباع مرتبط بتسليم ولا يُمس
  const { data, error } = await admin().from('inventory_items').delete().eq('id', id).eq('status', 'available').select('product_id');
  if (error) throw error;
  if (!data?.length) throw new HttpError(409, 'لا يمكن حذف هذا العنصر (مُباع أو غير موجود)');
  await audit(me.id, 'inventory.delete', 'product', data[0].product_id, { count: 1 });
}

export async function createCategory(me: Me, input: z.infer<typeof CategoryInput>) {
  const { data, error } = await admin().from('categories').insert(input).select('id').single();
  conflict(error, 'المعرّف (slug) مستخدم');
  if (error) throw error;
  await audit(me.id, 'category.create', 'category', data.id, { name: input.name });
}

export async function deleteCategory(me: Me, id: string) {
  const { data, error } = await admin().from('categories').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id).is('deleted_at', null).select('id');
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, 'التصنيف غير موجود');
  await audit(me.id, 'category.delete', 'category', id);
}

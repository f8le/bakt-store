import 'server-only';
import { notFound } from 'next/navigation';
import { admin } from './supabase/admin';
import { requireAdmin, requirePageUser } from './auth';
import { audit } from './audit';
import { mask } from './mask';

export const PAGE_SIZE = 50;

/** لصفحات الإدارة: غير المسجّل → دخول، والعميل العادي → 404 (لا نكشف وجود اللوحة) */
export async function requireAdminPage(path: string) {
  const { user } = await requirePageUser(path);
  const { data } = await admin().from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (data?.role !== 'admin') notFound();
  return user;
}

/** تسجيل دخول الأدمن للوحة (مرة كل ساعة كحد أقصى لتجنب الضجيج) */
export async function logAdminAccess(userId: string) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { data } = await admin().from('audit_logs').select('id').eq('actor_id', userId).eq('action', 'admin.access').gte('created_at', since).limit(1);
  if (!data?.length) await audit(userId, 'admin.access', 'admin', userId);
}

export async function getStats() {
  await requireAdmin();
  const { data } = await admin().rpc('admin_stats');
  return data as {
    sales_halalas: number; orders_total: number; orders_paid: number; orders_pending: number; orders_new_24h: number;
    fulfillment_failed: number; customers: number;
    top_products: { product_name: string; qty: number; revenue: number }[];
    low_stock: { id: string; name: string; available: number }[];
  };
}

export async function getInventorySummary() {
  await requireAdmin();
  const { data } = await admin().rpc('admin_inventory_summary');
  return (data ?? []) as { product_id: string; name: string; is_active: boolean; available: number; sold: number }[];
}

export async function listProductsAdmin() {
  await requireAdmin();
  const [{ data: products }, stock] = await Promise.all([
    admin().from('products').select('id,slug,name,price_halalas,is_active,product_type,created_at').is('deleted_at', null).order('created_at', { ascending: false }),
    getInventorySummary(),
  ]);
  const avail = new Map(stock.map((s) => [s.product_id, Number(s.available)]));
  return (products ?? []).map((p) => ({ ...p, available: avail.get(p.id) ?? 0 }));
}

export async function getProductAdmin(id: string) {
  await requireAdmin();
  const { data } = await admin().from('products').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  return data;
}

export async function listCategoriesAdmin() {
  await requireAdmin();
  const { data } = await admin().from('categories').select('id,slug,name').is('deleted_at', null).order('sort_order');
  return data ?? [];
}

export async function getInventoryForProduct(productId: string) {
  await requireAdmin();
  const db = admin();
  const [{ data: product }, { data: available }, { data: sold }] = await Promise.all([
    db.from('products').select('id,name').eq('id', productId).is('deleted_at', null).maybeSingle(),
    db.from('inventory_items').select('id,secret,created_at').eq('product_id', productId).eq('status', 'available').order('created_at').limit(200),
    db.from('inventory_items').select('id,secret,order_id,sold_at').eq('product_id', productId).eq('status', 'sold').order('sold_at', { ascending: false }).limit(100),
  ]);
  return {
    product,
    available: (available ?? []).map((i) => ({ id: i.id, preview: mask(i.secret), created_at: i.created_at })),
    sold: (sold ?? []).map((i) => ({ id: i.id, preview: mask(i.secret), order_id: i.order_id, sold_at: i.sold_at })),
  };
}

export async function listOrdersAdmin(f: { q?: string; pay?: string; ful?: string; page: number }) {
  await requireAdmin();
  const { data } = await admin().rpc('admin_orders', {
    p_search: f.q || null, p_pay: f.pay || null, p_fulfil: f.ful || null, p_limit: PAGE_SIZE, p_offset: (f.page - 1) * PAGE_SIZE,
  });
  return (data ?? []) as { id: string; email: string; product_name: string; quantity: number; total_halalas: number; payment_status: string; fulfillment_status: string; created_at: string; total_count: number }[];
}

export async function getOrderAdmin(id: string) {
  await requireAdmin();
  const db = admin();
  const { data: order } = await db.from('orders').select('*').eq('id', id).maybeSingle();
  if (!order) return null;
  const [{ data: payments }, { data: deliveries }, { data: logs }, { data: u }] = await Promise.all([
    db.from('payments').select('provider,provider_payment_id,amount_halalas,status,created_at').eq('order_id', id).order('created_at'),
    db.from('deliveries').select('inventory_item_id,delivered_at').eq('order_id', id),
    db.from('audit_logs').select('action,meta,created_at').eq('entity_id', id).order('created_at'),
    db.auth.admin.getUserById(order.user_id),
  ]);
  return { order, email: u?.user?.email ?? '—', payments: payments ?? [], deliveries: deliveries ?? [], logs: logs ?? [] };
}

export async function listCustomersAdmin(q: string, page: number) {
  await requireAdmin();
  const { data } = await admin().rpc('admin_customers', { p_search: q || null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  return (data ?? []) as { id: string; email: string; full_name: string | null; role: string; created_at: string; orders_count: number; total_spent: number; total_count: number }[];
}

export async function listAudit() {
  await requireAdmin();
  const { data } = await admin().from('audit_logs').select('id,actor_id,action,entity,entity_id,meta,created_at').order('id', { ascending: false }).limit(150);
  return data ?? [];
}

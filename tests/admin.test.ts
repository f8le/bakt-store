import { test, beforeEach, before } from 'node:test';
import assert from 'node:assert/strict';

Object.assign(process.env, {
  NEXT_PUBLIC_SITE_URL: 'https://shop.example.com', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(30), SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(30),
  MOYASAR_SECRET_KEY: 'sk_test_123456789', MOYASAR_PUBLISHABLE_KEY: 'pk_test_123456789', MOYASAR_WEBHOOK_SECRET: 'whsec_test_0123456789abcdef',
});
const PID = '0b6e2a52-3f0e-4d5e-9d57-8a3f3a5f1c11';
const ME = { id: 'cccccccc-0000-0000-0000-000000000003' };

// ---- محاكاة PostgREST ----
type Call = { method: string; url: string; body: any; accept: string };
let calls: Call[] = []; let routes: ((c: Call) => Response | undefined)[] = [];
const rows = (c: Call, arr: unknown[]) => c.accept.includes('vnd.pgrst.object')
  ? (arr.length ? Response.json(arr[0]) : Response.json({ code: 'PGRST116', message: 'no rows' }, { status: 406 })) : Response.json(arr);
const pgError = (code: string, status = 409) => Response.json({ code, message: 'db error: secret internals', details: 'x' }, { status });
globalThis.fetch = (async (url: any, init: any) => {
  const h = new Headers(init?.headers);
  const c: Call = { method: init?.method ?? 'GET', url: decodeURIComponent(String(url)), body: init?.body ? JSON.parse(init.body) : undefined, accept: h.get('accept') ?? '' };
  calls.push(c);
  for (const r of routes) { const res = r(c); if (res) return res; }
  return new Response(null, { status: 201 });
}) as any;
beforeEach(() => { calls = []; routes = []; });
const to = (c: Call, path: string, method?: string) => c.url.includes(`/rest/v1/${path}`) && (!method || c.method === method);
const auditCalls = () => calls.filter((c) => to(c, 'audit_logs', 'POST'));

let A: typeof import('../src/lib/admin-actions'), S: typeof import('../src/lib/schemas'), mask: (s: string) => string, HttpError: any;
before(async () => { A = await import('../src/lib/admin-actions'); S = await import('../src/lib/schemas'); ({ mask } = await import('../src/lib/mask')); ({ HttpError } = await import('../src/lib/http-error')); });

const valid = { name: 'نتفلكس', slug: 'netflix-1m', price_halalas: 5000, product_type: 'subscription' as const };

// ================= مخططات الإدخال =================
test('ProductInput: المدخل الصحيح مع قيم افتراضية', () => {
  const r = S.ProductInput.parse(valid); assert.equal(r.is_active, true); assert.deepEqual(r.features, []);
});
test('ProductInput: يرفض الحقول الزائدة (Mass Assignment)', () => {
  for (const k of ['id', 'deleted_at', 'created_at', 'role', 'user_id', 'price', 'secret']) assert.throws(() => S.ProductInput.parse({ ...valid, [k]: 'x' }), k);
});
test('ProductInput: يرفض أسعارًا غير صالحة', () => {
  for (const v of [-1, 1.5, '50', null, 10_000_001, NaN, Infinity]) assert.throws(() => S.ProductInput.parse({ ...valid, price_halalas: v }), String(v));
});
test('ProductInput: يرفض slug غير صالح', () => {
  for (const v of ['', 'A B', 'سلاگ', '../x', 'a--b', '-a', 'a-', "a'b", 'a'.repeat(101)]) assert.throws(() => S.ProductInput.parse({ ...valid, slug: v }), v);
});
test('ProductInput: صور https فقط (لا javascript/data/http)', () => {
  for (const v of ['http://a.com/x.png', 'javascript:alert(1)', 'data:text/html,<script>', 'ftp://a.com/x', '//a.com/x', 'not a url']) assert.throws(() => S.ProductInput.parse({ ...valid, image_url: v }), v);
  assert.ok(S.ProductInput.parse({ ...valid, image_url: 'https://cdn.example.com/a.png' }));
});
test('ProductInput: نوع غير معروف / مميزات كثيرة / تصنيف غير UUID', () => {
  assert.throws(() => S.ProductInput.parse({ ...valid, product_type: 'gift' }));
  assert.throws(() => S.ProductInput.parse({ ...valid, features: Array(13).fill('x') }));
  assert.throws(() => S.ProductInput.parse({ ...valid, category_id: "1' OR 1=1" }));
});
test('ProductPatch: تعديل جزئي لا يُدخل قيمًا افتراضية (لا يُعيد تفعيل منتج موقوف)', () => {
  assert.deepEqual(S.ProductPatch.parse({ name: 'جديد' }), { name: 'جديد' });
  assert.deepEqual(S.ProductPatch.parse({}), {});
  assert.throws(() => S.ProductPatch.parse({ deleted_at: null }));
  assert.throws(() => S.ProductPatch.parse({ id: PID }));
});
test('InventoryAdd / CategoryInput', () => {
  assert.throws(() => S.InventoryAdd.parse({ productId: PID, items: [] }));
  assert.throws(() => S.InventoryAdd.parse({ productId: PID, items: Array(501).fill('x') }));
  assert.throws(() => S.InventoryAdd.parse({ productId: PID, items: ['   '] }));
  assert.throws(() => S.InventoryAdd.parse({ productId: 'x', items: ['a'] }));
  assert.throws(() => S.InventoryAdd.parse({ productId: PID, items: ['a'], status: 'sold' }));
  assert.throws(() => S.CategoryInput.parse({ name: 'x', slug: 'Bad Slug' }));
});

// ================= العمليات: ما يُكتب في قاعدة البيانات =================
test('createProduct: يكتب المدخلات المُتحقَّق منها فقط ويسجّل Audit', async () => {
  routes.push((c) => to(c, 'products', 'POST') ? rows(c, [{ id: PID }]) : undefined);
  const input = S.ProductInput.parse(valid);
  assert.equal(await A.createProduct(ME, input), PID);
  const w = calls.find((c) => to(c, 'products', 'POST'))!;
  assert.deepEqual(w.body, input);
  const a = auditCalls()[0].body; assert.equal(a.action, 'product.create'); assert.equal(a.actor_id, ME.id); assert.equal(a.meta.price_halalas, 5000);
});
test('createProduct: slug مكرر → 409 برسالة عربية بلا تفاصيل قاعدة البيانات', async () => {
  routes.push((c) => to(c, 'products', 'POST') ? pgError('23505') : undefined);
  await assert.rejects(() => A.createProduct(ME, S.ProductInput.parse(valid)), (e: any) => e instanceof HttpError && e.status === 409 && !/db error|internals/.test(e.message));
  assert.equal(auditCalls().length, 0);
});
test('updateProduct: تغيير السعر → Audit بالسعر القديم والجديد، ويُرسل الحقل المعدّل فقط', async () => {
  routes.push((c) => to(c, 'products', 'GET') ? rows(c, [{ price_halalas: 5000, is_active: true, deleted_at: null }]) : undefined);
  await A.updateProduct(ME, PID, S.ProductPatch.parse({ price_halalas: 6000 }));
  const patch = calls.find((c) => to(c, 'products', 'PATCH'))!;
  assert.deepEqual(patch.body, { price_halalas: 6000 }); assert.match(patch.url, new RegExp(`id=eq.${PID}`));
  const a = auditCalls().map((c) => c.body); assert.equal(a.length, 1);
  assert.deepEqual([a[0].action, a[0].meta], ['product.price_change', { from: 5000, to: 6000 }]);
});
test('updateProduct: نفس السعر لا يسجّل price_change، وإيقاف المنتج يسجّل status_change', async () => {
  routes.push((c) => to(c, 'products', 'GET') ? rows(c, [{ price_halalas: 5000, is_active: true, deleted_at: null }]) : undefined);
  await A.updateProduct(ME, PID, S.ProductPatch.parse({ price_halalas: 5000, is_active: false, name: 'اسم' }));
  assert.deepEqual(auditCalls().map((c) => c.body.action).sort(), ['product.status_change', 'product.update']);
  assert.deepEqual(auditCalls().find((c) => c.body.action === 'product.update')!.body.meta, { fields: ['name'] }); // أسماء الحقول فقط
});
test('updateProduct: منتج محذوف/غير موجود → 404 ولا كتابة', async () => {
  routes.push((c) => to(c, 'products', 'GET') ? rows(c, [{ price_halalas: 1, is_active: true, deleted_at: '2025-01-01' }]) : undefined);
  await assert.rejects(() => A.updateProduct(ME, PID, { name: 'x' }), (e: any) => e.status === 404);
  assert.ok(!calls.some((c) => c.method === 'PATCH'));
});
test('updateProduct: تعديل فارغ → 400 بلا أي اتصال', async () => {
  await assert.rejects(() => A.updateProduct(ME, PID, {}), (e: any) => e.status === 400); assert.equal(calls.length, 0);
});
test('deleteProduct: Soft delete (لا DELETE فعلي) + Audit', async () => {
  routes.push((c) => to(c, 'products', 'PATCH') ? Response.json([{ id: PID }]) : undefined);
  await A.deleteProduct(ME, PID);
  assert.ok(!calls.some((c) => c.method === 'DELETE'));
  const p = calls.find((c) => to(c, 'products', 'PATCH'))!; assert.ok(p.body.deleted_at); assert.equal(p.body.is_active, false); assert.match(p.url, /deleted_at=is\.null/);
  assert.equal(auditCalls()[0].body.action, 'product.delete');
});
test('deleteProduct: غير موجود → 404 بلا Audit', async () => {
  routes.push((c) => to(c, 'products', 'PATCH') ? Response.json([]) : undefined);
  await assert.rejects(() => A.deleteProduct(ME, PID), (e: any) => e.status === 404); assert.equal(auditCalls().length, 0);
});
test('addInventory: يحذف المكرر داخل الطلب، والـ Audit يحوي العدد فقط لا الأسرار', async () => {
  routes.push((c) => to(c, 'products', 'GET') ? rows(c, [{ id: PID }]) : undefined);
  const n = await A.addInventory(ME, PID, ['SECRET-XYZ-1', 'SECRET-XYZ-1', 'SECRET-XYZ-2']);
  assert.equal(n, 2);
  const ins = calls.find((c) => to(c, 'inventory_items', 'POST'))!;
  assert.equal(ins.body.length, 2); assert.ok(ins.body.every((r: any) => r.product_id === PID && r.created_by === ME.id));
  assert.deepEqual(auditCalls()[0].body.meta, { count: 2 });
  assert.ok(!JSON.stringify(auditCalls().map((c) => c.body)).includes('SECRET'));
});
test('addInventory: منتج غير موجود → 404 بلا إدراج', async () => {
  routes.push((c) => to(c, 'products', 'GET') ? rows(c, []) : undefined);
  await assert.rejects(() => A.addInventory(ME, PID, ['a']), (e: any) => e.status === 404);
  assert.ok(!calls.some((c) => to(c, 'inventory_items', 'POST')));
});
test('addInventory: عنصر مكرر في القاعدة → 409', async () => {
  routes.push((c) => to(c, 'products', 'GET') ? rows(c, [{ id: PID }]) : to(c, 'inventory_items', 'POST') ? pgError('23505') : undefined);
  await assert.rejects(() => A.addInventory(ME, PID, ['a']), (e: any) => e.status === 409); assert.equal(auditCalls().length, 0);
});
test('deleteInventoryItem: يحذف المتاح فقط (status=eq.available) وAudit بالعدد', async () => {
  routes.push((c) => c.method === 'DELETE' ? Response.json([{ product_id: PID }]) : undefined);
  await A.deleteInventoryItem(ME, PID);
  const d = calls.find((c) => c.method === 'DELETE')!; assert.match(d.url, /status=eq\.available/); assert.match(d.url, new RegExp(`id=eq.${PID}`));
  assert.deepEqual(auditCalls()[0].body.meta, { count: 1 });
});
test('deleteInventoryItem: عنصر مُباع → 409', async () => {
  routes.push((c) => c.method === 'DELETE' ? Response.json([]) : undefined);
  await assert.rejects(() => A.deleteInventoryItem(ME, PID), (e: any) => e.status === 409); assert.equal(auditCalls().length, 0);
});
test('deleteCategory / createCategory', async () => {
  routes.push((c) => to(c, 'categories', 'POST') ? rows(c, [{ id: PID }]) : to(c, 'categories', 'PATCH') ? Response.json([]) : undefined);
  await A.createCategory(ME, S.CategoryInput.parse({ name: 'ترفيه', slug: 'fun' }));
  assert.equal(auditCalls()[0].body.action, 'category.create');
  await assert.rejects(() => A.deleteCategory(ME, PID), (e: any) => e.status === 404);
});

// ================= إخفاء الأسرار =================
test('mask: لا تعرض إلا آخر 3 خانات ولا تكشف العناصر القصيرة', () => {
  assert.equal(mask('NETFLIX-ABCD-1234'), '••••234'); assert.equal(mask('abcd'), '••••'); assert.equal(mask('ab'), '••••');
  const s = 'SUPER-SECRET-CODE-9876'; assert.ok(!mask(s).includes('SUPER'));
});

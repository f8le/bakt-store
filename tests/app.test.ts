import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const SECRET = 'whsec_test_0123456789abcdef';
const SITE = 'https://shop.example.com';
Object.assign(process.env, {
  NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(30), SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(30),
  MOYASAR_SECRET_KEY: 'sk_test_123456789', MOYASAR_PUBLISHABLE_KEY: 'pk_test_123456789', MOYASAR_WEBHOOK_SECRET: SECRET,
});
const ORDER = '0b6e2a52-3f0e-4d5e-9d57-8a3f3a5f1c11';

// محاكاة الشبكة: Moyasar و Supabase RPC
let calls: { url: string; body?: any }[] = [];
let moyasar: { status: number; json: any } = { status: 200, json: {} };
let rpc: { status: number; json: any } = { status: 200, json: 'ok' };
globalThis.fetch = (async (url: any, init: any) => {
  const u = String(url); let body; try { body = init?.body ? JSON.parse(init.body) : undefined; } catch {}
  calls.push({ url: u, body });
  if (u.includes('api.moyasar.com')) return Response.json(moyasar.json, { status: moyasar.status });
  if (u.includes('/rest/v1/rpc/')) return Response.json(rpc.json, { status: rpc.status });
  return Response.json({}, { status: 404 });
}) as any;
beforeEach(() => { calls = []; moyasar = { status: 200, json: paid() }; rpc = { status: 200, json: 'ok' }; });
const paid = (o: any = {}) => ({ id: 'pay_1', status: 'paid', amount: 5000, currency: 'SAR', metadata: { order_id: ORDER }, ...o });

let POST: (r: Request) => Promise<Response>, verifyWebhook: any, CheckoutBody: any, middleware: any, NextRequest: any;
before(async () => {
  ({ POST } = await import('../src/app/api/webhooks/moyasar/route'));
  ({ moyasar: { verifyWebhook } } = await import('../src/lib/payments/moyasar') as any);
  ({ CheckoutBody } = await import('../src/lib/schemas'));
  ({ middleware } = await import('../src/middleware'));
  ({ NextRequest } = await import('next/server'));
});
const hook = (o: any = {}, raw?: string) => POST(new Request('https://x/api/webhooks/moyasar', { method: 'POST', body: raw ?? JSON.stringify(
  { id: 'evt_1', type: 'payment_paid', secret_token: SECRET, data: { id: 'pay_1', amount: 1, currency: 'SAR', status: 'paid' }, ...o }) }));
const rpcCalls = () => calls.filter((c) => c.url.includes('/rpc/process_paid_payment'));

// ---------- التحقق من الـ Webhook ----------
test('سر خاطئ → 401 بلا أي اتصال خارجي', async () => {
  const r = await hook({ secret_token: 'wrong' + SECRET }); assert.equal(r.status, 401); assert.equal(calls.length, 0);
});
test('سر بنفس الطول لكن مختلف → 401', async () => {
  const r = await hook({ secret_token: 'X' + SECRET.slice(1) }); assert.equal(r.status, 401); assert.equal(calls.length, 0);
});
test('بلا secret_token → 401', async () => {
  const r = await hook({ secret_token: undefined }); assert.equal(r.status, 401); assert.equal(calls.length, 0);
});
test('secret_token ليس نصًا (رقم/كائن) → 401', async () => {
  for (const v of [123, {}, [], null, true]) { const r = await hook({ secret_token: v }); assert.equal(r.status, 401); }
  assert.equal(calls.length, 0);
});
test('جسم ليس JSON → 401', async () => { assert.equal((await hook({}, 'not json')).status, 401); });
test('بلا event id → 401', async () => { assert.equal((await hook({ id: undefined })).status, 401); });
test('جسم ضخم → 413', async () => { assert.equal((await hook({}, 'x'.repeat(100_001))).status, 413); assert.equal(calls.length, 0); });

// ---------- عدم الثقة ببيانات الـ Webhook ----------
test('المبلغ يؤخذ من Moyasar API لا من جسم الـ Webhook', async () => {
  const r = await hook(); assert.equal(r.status, 200);
  const c = rpcCalls(); assert.equal(c.length, 1);
  assert.equal(c[0].body.p_amount, 5000);           // الجسم قال 1
  assert.equal(c[0].body.p_order_id, ORDER); assert.equal(c[0].body.p_payment_id, 'pay_1');
});
test('Webhook يدّعي paid لكن Moyasar تقول failed → لا تسليم', async () => {
  moyasar.json = paid({ status: 'failed' }); const r = await hook(); assert.equal(r.status, 200); assert.equal(rpcCalls().length, 0);
});
test('Moyasar تقول initiated → لا تسليم', async () => {
  moyasar.json = paid({ status: 'initiated' }); await hook(); assert.equal(rpcCalls().length, 0);
});
test('order_id غير UUID → يُتجاهل', async () => {
  moyasar.json = paid({ metadata: { order_id: "1' OR '1'='1" } }); await hook(); assert.equal(rpcCalls().length, 0);
});
test('بلا order_id → يُتجاهل', async () => { moyasar.json = paid({ metadata: {} }); await hook(); assert.equal(rpcCalls().length, 0); });
test('نوع حدث غير payment_paid → يُتجاهل بلا اتصال', async () => {
  const r = await hook({ type: 'payment_failed' }); assert.equal(r.status, 200); assert.equal(calls.length, 0);
});
test('تعذّر الاتصال بـ Moyasar → 500 ليعيد المحاولة', async () => {
  moyasar = { status: 500, json: {} }; assert.equal((await hook()).status, 500); assert.equal(rpcCalls().length, 0);
});
test('فشل قاعدة البيانات → 500 ليعيد المحاولة', async () => {
  rpc = { status: 500, json: { message: 'db down' } }; assert.equal((await hook()).status, 500);
});
test('رد الـ Webhook لا يسرّب أسرارًا', async () => {
  const t = await (await hook()).text(); for (const s of [SECRET, 'sk_test', 'service']) assert.ok(!t.includes(s));
});

// ---------- مخطط الـ Checkout ----------
const U = '0b6e2a52-3f0e-4d5e-9d57-8a3f3a5f1c11';
test('Checkout: يقبل المدخل الصحيح', () => { assert.deepEqual(CheckoutBody.parse({ productId: U }), { productId: U, quantity: 1 }); });
test('Checkout: يرفض حقل price (التلاعب بالسعر)', () => { assert.throws(() => CheckoutBody.parse({ productId: U, price: 1 })); });
test('Checkout: يرفض total/userId/payment_status (Mass Assignment)', () => {
  for (const k of ['total', 'total_halalas', 'userId', 'user_id', 'payment_status', 'role']) assert.throws(() => CheckoutBody.parse({ productId: U, [k]: 'x' }), k);
});
test('Checkout: يرفض كمية 0 / 6 / كسرية / نص / سالبة', () => {
  for (const q of [0, 6, 1.5, '2', -1, null]) assert.throws(() => CheckoutBody.parse({ productId: U, quantity: q }), String(q));
});
test('Checkout: يرفض productId غير UUID (SQLi/مسار)', () => {
  for (const v of ["1' OR 1=1--", '../etc/passwd', '', 123, null, undefined]) assert.throws(() => CheckoutBody.parse({ productId: v }));
});

// ---------- CSRF (Origin) ----------
const mw = (path: string, method: string, origin?: string) =>
  middleware(new NextRequest(SITE + path, { method, headers: origin ? { origin } : {} }));
test('CSRF: POST بدون Origin → 403', async () => { assert.equal((await mw('/api/checkout', 'POST')).status, 403); });
test('CSRF: POST من موقع آخر → 403', async () => { assert.equal((await mw('/api/checkout', 'POST', 'https://evil.com')).status, 403); });
test('CSRF: Origin يشبه موقعنا → 403', async () => {
  for (const o of [SITE + '.evil.com', 'http://shop.example.com', 'https://shop.example.com:8443']) assert.equal((await mw('/api/checkout', 'POST', o)).status, 403, o);
});
test('CSRF: Admin API من موقع آخر → 403', async () => { assert.equal((await mw('/api/admin/inventory', 'POST', 'https://evil.com')).status, 403); });
test('CSRF: PUT/PATCH/DELETE بلا Origin → 403', async () => { for (const m of ['PUT', 'PATCH', 'DELETE']) assert.equal((await mw('/api/checkout', m)).status, 403, m); });
test('CSRF: Origin الصحيح يمر', async () => { assert.notEqual((await mw('/api/checkout', 'POST', SITE)).status, 403); });
test('CSRF: GET لا يتأثر', async () => { assert.notEqual((await mw('/api/me/deliveries', 'GET')).status, 403); });
test('الـ Webhook مستثنى من فحص Origin (محمي بالسر)', async () => { assert.notEqual((await mw('/api/webhooks/moyasar', 'POST')).status, 403); });
test('ترويسات الأمان موجودة', async () => {
  const r = await mw('/', 'GET'); assert.equal(r.headers.get('x-frame-options'), 'DENY'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

// ---------- Open Redirect ----------
test('safeNext: يقبل المسارات الداخلية فقط', async () => {
  const { safeNext } = await import('../src/lib/safe-next');
  assert.equal(safeNext('/account'), '/account');
  assert.equal(safeNext('/products/abc?x=1'), '/products/abc?x=1');
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'http://evil.com', 'javascript:alert(1)', 'evil.com', '', null, undefined, '/a\r\nSet-Cookie: x=1', '/\\/evil.com'])
    assert.equal(safeNext(bad as any), '/account', String(bad));
});
test('UUID_RE يرفض المدخلات الخبيثة', async () => {
  const { UUID_RE } = await import('../src/lib/format');
  assert.ok(UUID_RE.test('0b6e2a52-3f0e-4d5e-9d57-8a3f3a5f1c11'));
  for (const bad of ["1' OR 1=1", '../../x', '', '0b6e2a52-3f0e-4d5e-9d57-8a3f3a5f1c11 ', '0b6e2a52-3f0e-4d5e-9d57-8a3f3a5f1c11\n']) assert.ok(!UUID_RE.test(bad), bad);
});

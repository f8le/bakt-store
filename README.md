# متجر المنتجات الرقمية (Next.js + Supabase + Moyasar على Cloudflare)

> **الحالة:** نواة الأمان والطلبات والدفع والتسليم جاهزة وخضعت لـ 94 اختبارًا آليًا (انظر قسم الاختبارات). **لم تُختبر** بعد: Supabase/PostgREST الحقيقية، Moyasar الحقيقية، النشر على Cloudflare، وواجهة المستخدم. راجع القسم 11 قبل أي إطلاق.

## الاختبارات (70 اختبار قاعدة بيانات + 55 اختبار تطبيق، جميعها ناجحة محليًا)
**قاعدة البيانات (64)** على Postgres 16 حقيقي مع محاكاة لأدوار Supabase: `supabase/tests/security.sh`
(IDOR، التلاعب بالسعر والحالات، التسليم بدون دفع، تصعيد الصلاحيات، حماية المخزون، إعادة الـ Webhook، مبلغ/عملة خاطئة، إعادة استخدام عنصر مسلَّم، عدم قابلية الـ Audit للتعديل، RLS على كل الجداول، و3 اختبارات تزامن بعمليات متوازية حقيقية: 10 ضغطات دفع، 10 دفعات على مخزون 5، نفس الـ Webhook 10 مرات).
**التطبيق (55)**: `npm run test:app` (توقيع Webhook خاطئ/مفقود/بنوع خاطئ، جسم مزوَّر المبلغ، دفعة failed، order_id خبيث، فشل Moyasar/DB يرجع 500 للإعادة، رفض `price` وأي حقل زائد، فحص Origin ضد CSRF، ترويسات الأمان، ومخططات الإدارة، وما يُكتب بالضبط في قاعدة البيانات عند كل عملية إدارية، مع Mutation testing: أدخلت 6 أخطاء أمنية عمدًا فاكتشفها الاختبار جميعًا).
التشغيل: `bash supabase/tests/security.sh` كمستخدم postgres على قاعدة `t` فيها `supabase_shim.sql` ثم `001_init.sql`. محاكاة Supabase تقريبية، فأعد تشغيل الاختبارات نفسها على مشروع Supabase تجريبي.
**عيوب كشفتها الاختبارات وأُصلحت:** (1) تعيين أول Admin من SQL Editor كان سيُرفض بسبب Trigger حماية الدور، (2) ضغطات متوازية بنفس مفتاح Idempotency كانت تُرجع خطأ 500 رغم سلامة البيانات، (3) أخطاء أنواع TypeScript كانت ستُفشل `typecheck`.

## الواجهة (مبنية ومُختبرة بالبناء والتشغيل الفعلي)
الهوية: **بكت | BAKT** — الدعم: 0xhurubi@gmail.com — ديسكورد: f8le (`src/lib/site.ts`).
الصفحات: الرئيسية، المنتجات (بحث وتصنيفات)، صفحة المنتج (SEO + Structured Data)، دخول/إنشاء حساب، الدفع `/pay/[id]`، الطلب `/orders/[id]`، حسابي، منتجاتي، الدعم/الأسئلة/الشروط/الخصوصية/الاسترجاع، sitemap وrobots.
تدفق الشراء: صفحة المنتج → `POST /api/checkout` → `/pay/[id]` (المبلغ من DB) → نموذج Moyasar → `/orders/[id]` يتحدّث تلقائيًا حتى يؤكد الـ Webhook الدفع.
**لوحة الإدارة `/admin`** (مبنية ومُختبرة): الإحصاءات (المبيعات، الطلبات، الأكثر مبيعًا، المخزون المنخفض، تنبيه الطلبات المدفوعة غير المسلّمة)، المنتجات (إضافة/تعديل/إيقاف/حذف ناعم/أسعار/روابط الصور/تصنيفات)، المخزون (إضافة/حذف المتاح/المتاح والمباع ولأي طلب، مع إخفاء الأسرار إلا آخر 3 خانات)، الطلبات (بحث وفلترة وتفاصيل)، العملاء (عدد الطلبات والإنفاق)، وسجل الأحداث.
الحماية: كل صفحة وكل دالة بيانات تتحقق من الأدمن Server-side بنفسها (لا اعتماد على الـ layout)، والعميل العادي يرى 404، والـ API يرفض بـ 401/403، وكل تعديل حساس يُسجَّل في Audit (بلا أسرار). حالات الطلبات لا تُعدَّل يدويًا عمدًا.
**ما لم يُبنَ بعد:** رفع الصور (حاليًا رابط https)، زر استرداد، حجز المخزون، مهمة المصالحة، CSP، تغيير صلاحيات المستخدمين من الواجهة (يتم بـ SQL).
**الصفحات القانونية مسودات** (`src/lib/pages.ts`): سياسة الاسترجاع كتبتها بافتراض «لا استرجاع بعد التسليم إلا لكود لا يعمل خلال 24 ساعة». عدّلها بقرارك وراجعها قانونيًا وأضف بيانات منشأتك.

## إعداد Supabase Auth (قبل أول تجربة)
Authentication → URL Configuration: Site URL = دومينك، وRedirect URLs تضم `https://دومينك/auth/callback`. فعّل Confirm email، وحدّ كلمة المرور الأدنى 8، وفعّل CAPTCHA (Cloudflare Turnstile) لتقليل التخمين الآلي.
أول Admin: بعد إنشاء حسابك شغّل في SQL Editor: `update profiles set role='admin' where id = (select id from auth.users where email='بريدك');`

## 1) المتغيرات (`.env.example`)
عامة: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
أسرار (Cloudflare Secrets): `SUPABASE_SERVICE_ROLE_KEY`, `MOYASAR_SECRET_KEY`, `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET`.

## 2) مخطط القاعدة (`supabase/migrations/001_init.sql`)
`profiles` (role) · `categories` · `products` (Soft delete، السعر بالهللة) · `inventory_items` (الأسرار) · `orders` (Snapshot للاسم والسعر + Idempotency) · `payments` (فريد بـ provider+payment_id) · `webhook_events` (فريد بـ provider+event_id) · `deliveries` (فريد بـ inventory_item_id) · `audit_logs` (Append-only).

## 3) سياسات RLS
تم سحب كل الصلاحيات من `anon/authenticated` ثم منح الضروري فقط:
- `profiles`: يقرأ ملفه فقط، ويعدّل `full_name/phone` فقط (عمود `role` محمي بـ Grant وTrigger).
- `orders`/`payments`: قراءة طلباته فقط، ولا INSERT/UPDATE/DELETE إطلاقًا.
- `products/inventory_items/deliveries/webhook_events`: لا Policy ولا Grant للعملاء. العامة تقرأ `storefront_products` (بلا أسرار وبلا عدد المخزون).
- Admin: قراءة عبر `is_admin()`؛ والكتابة عبر Server Routes بـ service_role بعد `requireAdmin()`.

## 4) المصادقة
Supabase Auth (بريد/كلمة مرور). الجلسة في كوكي عبر `@supabase/ssr`، ويُجدَّد في الـ middleware. كل API يستدعي `auth.getUser()` (تحقق فعلي من JWT). الدور يُقرأ من `profiles.role` وليس `user_metadata`. أول Admin يُعيَّن يدويًا: `update profiles set role='admin' where id='...'` من SQL Editor.

## 5) الدفع
`POST /api/checkout` ← يتحقق من المستخدم وZod (`.strict()` يرفض `price`) ← `create_order` يقرأ السعر من DB ← يعيد بيانات نموذج Moyasar (مفتاح publishable فقط) ← العميل يدفع لدى Moyasar. لا تُخزَّن بيانات بطاقات. `callback_url` للعرض فقط ولا يؤكد الدفع.
طبقة `PaymentProvider` مستقلة (`src/lib/payments`)؛ بوابة جديدة = ملف واحد يطبّق الواجهة.

## 6) Webhook (`/api/webhooks/moyasar`)
1. حد حجم الجسم + مطابقة `secret_token` بمقارنة ثابتة الزمن.
2. **إعادة جلب الدفعة من Moyasar API** بالمفتاح السري (لا نثق بجسم الطلب).
3. `process_paid_payment` في معاملة واحدة: تسجيل الحدث (Unique) ← قفل الطلب ← مطابقة المبلغ والعملة ← تسجيل الدفعة (Unique) ← `paid` ← التسليم.
4. إعادة الإرسال = `duplicate_event` بلا أثر. فشل داخلي = 500 ليعيد Moyasar المحاولة.
ملاحظة Replay: التوقيع سر ثابت، فالحماية الفعلية من الإعادة هي Idempotency + إعادة الجلب + قيود Unique.

## 7) التسليم
`fulfill_order` يستخدم `FOR UPDATE SKIP LOCKED` فلا يتسلّم عنصران نفس الطلبين المتزامنين، و`deliveries.inventory_item_id UNIQUE` طبقة ثانية. العميل يقرأ منتجاته عبر `GET /api/me/deliveries` ← `my_deliveries()` المقيّدة بـ `auth.uid()` وطلب مدفوع فقط.

## 8) صلاحيات Admin
`requireAdmin()` داخل كل Route (تحقق Server-side من قاعدة البيانات) + Zod + Audit. إخفاء الواجهة ليس حماية.

## 9) Security Checklist
- [x] السعر من DB فقط · [x] لا Service Key في Frontend · [x] Zod strict · [x] CSRF Origin check
- [x] Idempotency (Order/Event/Payment/Delivery) · [x] RLS + سحب Grants · [x] Audit append-only
- [x] رسائل خطأ عامة بالعربية · [ ] Rate limiting (Cloudflare WAF، القسم 10) · [ ] CSP · [ ] اختبارات التسعة (القسم 11)

## 10) النشر على Cloudflare (الدليل التفصيلي في `DEPLOY.md`)
**جُرّب فعليًا:** البناء بـ OpenNext، وتشغيل الحزمة داخل workerd المحلي (صفحات، حماية، Webhook)، وحجمها ≈1.3MB مضغوطة. **لم يُجرَّب:** النشر الفعلي على حسابك.
1. أنشئ مشروع Supabase، ونفّذ `001_init.sql` ثم `002_admin.sql` من SQL Editor، وفعّل Email confirmation.
2. `npm install`، ثم `npm run typecheck`.
3. `npx wrangler secret put` لكل سر في القسم 1، وضع المتغيرات العامة في `wrangler.jsonc > vars`.
4. `npm run deploy`، ثم اربط الدومين وفعّل HTTPS الإجباري وHSTS من Cloudflare.
5. Moyasar: أنشئ Webhook على `https://دومينك/api/webhooks/moyasar` بحدث `payment_paid` مع `secret_token` = `MOYASAR_WEBHOOK_SECRET`. جرّب بمفاتيح الاختبار أولًا.
6. Cloudflare WAF → Rate limiting: `/api/checkout` و`/auth/*` (مثلًا 10 طلبات/دقيقة/IP)، وفعّل Bot Fight Mode.
7. فعّل Supabase PITR/Backups.

## اختبار يدوي لا غنى عنه قبل الإطلاق (لا يمكن أتمتته بدون جلسة Supabase حقيقية)
1. سجّل حسابًا **عاديًا** (غير أدمن) وافتح `/admin` ← يجب أن ترى «الصفحة غير موجودة».
2. بنفس الحساب، من Console المتصفح نفّذ: `fetch('/api/admin/products',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.status)` ← يجب **403**.
3. تحقق أن المتصفح/الواجهة لا تعرض أي كود مخزون كامل في لوحة الإدارة (آخر 3 خانات فقط).
4. غيّر سعر منتج ثم افتح `/admin/audit` ← يجب أن يظهر `product.price_change` بالسعر القديم والجديد.

## 11) مخاطر متبقية ومراجعة بشرية مطلوبة
- الاختبارات الآلية تغطي قاعدة البيانات ومنطق الـ Webhook والـ CSRF والتحقق من المدخلات، لكنها **لا** تغطي: مسارات `/api/checkout` و`/api/me/deliveries` و`/api/admin/*` end-to-end بجلسة Supabase حقيقية، وXSS (لا واجهة كافية بعد)، وتعطّل Moyasar أو بطؤها في الإنتاج. أجرِ اختبار تكامل بمفاتيح Moyasar التجريبية قبل الإطلاق.
- شكل الـ Webhook (`id`, `type`, `secret_token`, `data`) تأكدت من مطابقته لتوثيق Moyasar. ما زال بحاجة لتجربة فعلية: وصول `metadata.order_id` من نموذج الدفع.
- Moyasar تعيد إرسال الـ Webhook 5 مرات فقط (خلال ~3.5 ساعة) ثم تُسقطه. لو تعطل السيرفر أطول من ذلك تبقى دفعة ناجحة معلّقة عندنا. **يلزم لاحقًا:** مهمة مصالحة دورية تجلب الدفعات من Moyasar API وتعالج غير المعالَجة.
- **المخزون غير محجوز عند إنشاء الطلب**: لو نفد بين الطلب والدفع يصبح `fulfillment_status=failed` ويحتاج استردادًا يدويًا (نفس الأمر للدفع الزائد `extra_payment`). الحل لاحقًا: حجز مؤقت بانتهاء صلاحية.
- أسرار المخزون مخزنة كنص في Postgres (مشفّر على مستوى القرص فقط). للحساسية الأعلى استخدم Supabase Vault أو تشفير على مستوى التطبيق.
- الاسترداد (`refunded`) وwebhook الاسترداد غير منفّذين.
- لا يوجد CSP ولا Rate limiting داخل الكود (يعتمد على Cloudflare WAF).
- الـ Audit للأحداث الأمنية (تسجيل دخول Admin، تغيير الصلاحيات، تغيير السعر) مطبّق جزئيًا: التسليم والدفع والمخزون فقط.
- توافق OpenNext مع middleware وNext 15 يتطلب تجربة فعلية على Cloudflare.
- يُنصح بمراجعة أمنية بشرية أو اختبار اختراق قبل استقبال مدفوعات حقيقية.

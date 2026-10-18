# دليل النشر على Cloudflare (بكت | BAKT)

> **ملاحظة صريحة:** النشر يتطلب Git وGitHub، والأسهل بكثير من **كمبيوتر** (Mac/Windows). من الجوال وحده ممكن لكنه مرهق جدًا.
> ابدأ دائمًا بمفاتيح **الاختبار** (Moyasar test) ومشروع Supabase التجريبي. لا تنتقل للإنتاج قبل اجتياز القسم 7.

## 0) المتطلبات
حساب GitHub (مستودع **خاص Private**)، حساب Cloudflare، Supabase جاهز (001 و002 مطبّقان)، Moyasar (وضع الاختبار).
خطة Cloudflare: **Workers Paid (≈5$ شهريًا) موصى بها للإنتاج**، لأن تطبيقات Next.js قد تتجاوز حد وقت المعالج في الخطة المجانية (يظهر كخطأ 1102). تحقق من الحدود الحالية في توثيق Cloudflare.

## 1) رفع الكود إلى GitHub
1. فك ضغط `store.zip` على الكمبيوتر.
2. أنشئ مستودعًا **Private** على GitHub، ثم من داخل مجلد `store`:
   ```
   git init && git add . && git commit -m "init" && git branch -M main
   git remote add origin https://github.com/اسمك/اسم-المستودع.git && git push -u origin main
   ```
3. تأكد في GitHub أنه **لا يوجد** ملف `.env` أو `.dev.vars` (الـ `.gitignore` يمنعهما).

## 2) إنشاء الـ Worker (Workers Builds)
Cloudflare → Workers & Pages → Create → **Import a repository** → اختر المستودع.
- اسم الـ Worker: **`bakt-store`** (يجب أن يطابق `wrangler.jsonc`).
- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/` (إن كان المشروع في جذر المستودع).

## 3) المتغيرات (مهم جدًا: مكانان)
**أ) Build variables** (Worker → Settings → Build → Variables and secrets). تُثبَّت وقت البناء:
`NEXT_PUBLIC_SITE_URL` · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**ب) Runtime** (Worker → Settings → Variables and Secrets). **كل السبعة**:
نصية: `NEXT_PUBLIC_SITE_URL` · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY`
**Secret** (مشفّرة): `SUPABASE_SERVICE_ROLE_KEY` · `MOYASAR_SECRET_KEY` · `MOYASAR_PUBLISHABLE_KEY` · `MOYASAR_WEBHOOK_SECRET`

- `MOYASAR_WEBHOOK_SECRET`: اصنع نصًا عشوائيًا طويلًا (32+ حرفًا). ستضعه نفسه في Moyasar (القسم 5).
- `NEXT_PUBLIC_SITE_URL` بدون `/` في النهاية (مثال: `https://bakt.sa`). إن اختلف عن العنوان الفعلي رُفضت كل طلبات الـ API بخطأ 403. وإن غيّرته فأعد البناء.
- أول مرة: انشر بأي قيمة، انسخ عنوان `*.workers.dev`، ضعه في المتغيرين ثم أعد النشر (Retry build).

## 4) الدومين (اختياري في أول تجربة)
Worker → Settings → Domains & Routes → Add → Custom domain (الدومين على Cloudflare DNS). فعّل HTTPS الإجباري (Always Use HTTPS) وHSTS من SSL/TLS → Edge Certificates. ثم حدّث `NEXT_PUBLIC_SITE_URL` وأعد البناء.

## 5) Supabase و Moyasar
**Supabase** → Authentication → URL Configuration: Site URL = عنوان موقعك، وأضف في Redirect URLs: `https://عنوانك/auth/callback`.
Authentication → Providers → Email: فعّل Confirm email، والحد الأدنى لكلمة المرور 8. فعّل **CAPTCHA (Turnstile)** (تسجيل الدخول يتم من المتصفح إلى Supabase مباشرة، فالحماية من التخمين تكون هناك لا في Cloudflare).
**Moyasar** (وضع الاختبار) → Settings → Webhooks → Add: URL = `https://عنوانك/api/webhooks/moyasar`، الحدث `payment_paid`، و`secret_token` = نفس `MOYASAR_WEBHOOK_SECRET`.

## 6) حماية Cloudflare
Security → WAF → Rate limiting rules (الخطة المجانية تتيح عددًا محدودًا من القواعد):
- `/api/checkout` : 10 طلبات/دقيقة لكل IP.
- `/api/admin/` : 30 طلبًا/دقيقة لكل IP.
- **لا** تقيّد `/api/webhooks/moyasar` بشدة (المصدر Moyasar وليس العملاء).
فعّل Bot Fight Mode.

## 7) اختبار الدورة الكاملة (إلزامي قبل الإنتاج)
1. أنشئ حسابًا، ثم اجعله أدمن بـ SQL (موجود في README).
2. من `/admin`: أضف تصنيفًا ومنتجًا (سعر صغير) وأضف له 3 عناصر مخزون.
3. بحساب **عميل ثانٍ** اشترِ المنتج ببطاقة اختبار من توثيق Moyasar (Test cards).
4. تحقق: الطلب `paid/fulfilled` خلال ثوانٍ، ويظهر الكود في «منتجاتي»، وينقص المخزون واحدًا، ويظهر السجل في `/admin/audit`.
5. من لوحة Moyasar أعد إرسال نفس الـ Webhook ← يجب ألا يتكرر التسليم.
6. جرّب دفعة فاشلة (بطاقة مرفوضة) ← الطلب يبقى `pending` ولا يُسلَّم شيء.
7. اختبارات الأدمن اليدوية (قسم «اختبار يدوي» في README): 404 للعميل، و403 للـ API.
8. أعد تشغيل `sql_editor_tests.sql` على قاعدتك وتأكد `ALL PASS`.

## 8) الانتقال للإنتاج
مفاتيح Moyasar **الحية** (pk_live/sk_live) وwebhook جديد بسر جديد، مشروع Supabase للإنتاج (منفصل عن التجريبي) مع تطبيق 001 و002، تحديث المتغيرات وإعادة البناء، مراجعة الصفحات القانونية قانونيًا، وتفعيل النسخ الاحتياطي (تحقق من خطة Supabase؛ النسخ التلقائي غالبًا في الخطط المدفوعة، وإلا فخذ نسخًا دورية بـ `pg_dump`).
**لا تضع أي مفتاح سري في GitHub أو في محادثة.** وإن تسرّب مفتاح فبدّله فورًا.

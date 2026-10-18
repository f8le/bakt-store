# اختبارات قاعدة البيانات
1. قاعدة فارغة اسمها `t`.
2. `psql -d t -f supabase_shim.sql` (يحاكي auth والأدوار. لا تشغّله على Supabase الحقيقية).
3. `psql -d t -f ../migrations/001_init.sql`
4. `bash security.sh` كمستخدم postgres (يتطلب `psql` في PATH).

## الطريقة الأسهل: من Supabase SQL Editor (بلا تثبيت أي برنامج)
1. طبّق `migrations/001_init.sql` أولًا.
2. الصق محتوى `sql_editor_tests.sql` كاملًا في SQL Editor ثم Run.
3. تظهر نتيجة: الصف الأول **الملخص** (`ALL PASS` أو `HAS FAILURES`) ثم الاختبارات الفاشلة إن وجدت.
4. نظّف: `drop schema sec_test cascade;`
لا تترك أي بيانات (تُلغى المعاملة)، لكنها لا تشمل اختبارات التزامن (`security.sh`).

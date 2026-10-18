-- تنظيف بيانات الاختبار من مشروع Supabase التجريبي (لا تشغّله على الإنتاج أبدًا)
truncate audit_logs, deliveries, payments, webhook_events, orders, inventory_items, products, categories cascade;
delete from auth.users where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000003');

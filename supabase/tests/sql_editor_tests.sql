-- =====================================================================
-- اختبارات أمنية تعمل من Supabase SQL Editor مباشرة (مشروع تجريبي فقط)
-- المتطلب: تم تطبيق 001_init.sql ثم 002_admin.sql.
-- لا تترك أي بيانات: كل شيء يُنفَّذ داخل معاملة تُلغى في النهاية.
-- لا تشمل اختبارات التزامن (تحتاج security.sh و psql).
-- بعد الانتهاء شغّل:  drop schema sec_test cascade;
-- =====================================================================
create schema if not exists sec_test;

-- ينفّذ أوامر بهوية دور معيّن ثم يلغي كل أثرها. الفاصل بين الأوامر ;;
-- يعيد: نتائج أوامر select مفصولة بـ | ، أو ERROR: ... عند أي خطأ.
create or replace function sec_test.run_as(p_role text, p_uid text, p_sqls text) returns text
language plpgsql as $f$
declare s text; v text; o text := ''; k record; claims text;
begin
  begin
    for k in select key, value from jsonb_each_text(current_setting('t.vars')::jsonb) loop
      p_sqls := replace(p_sqls, '{' || k.key || '}', k.value);
    end loop;
    claims := case when coalesce(p_uid, '') = '' then jsonb_build_object('role', p_role)::text
                   else jsonb_build_object('sub', p_uid, 'role', p_role)::text end;
    perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
    perform set_config('request.jwt.claim.role', p_role, true);
    perform set_config('request.jwt.claims', claims, true);
    if p_role <> 'postgres' then execute 'set local role ' || quote_ident(p_role); end if;
    foreach s in array string_to_array(p_sqls, ';;') loop
      s := btrim(s, E' \n\t');
      if s = '' then continue; end if;
      if left(s, 1) = '!' then execute 'set local role ' || quote_ident(substr(s, 2));
      elsif lower(left(s, 6)) = 'select' or lower(left(s, 4)) = 'with' then
        execute s into v; o := o || coalesce(v, 'NULL') || '|';
      else execute s; end if;
    end loop;
    raise exception '__rollback__';
  exception when others then
    if sqlerrm = '__rollback__' then return rtrim(o, '|'); end if;
    return 'ERROR: ' || sqlerrm;
  end;
end $f$;

create or replace function sec_test.eq(p_name text, p_role text, p_uid text, p_sqls text, p_expected text) returns jsonb
language plpgsql as $f$
declare r text := sec_test.run_as(p_role, p_uid, p_sqls);
begin
  return jsonb_build_array(jsonb_build_object('test', p_name,
    'status', case when r = p_expected then 'PASS' else 'FAIL' end,
    'detail', case when r = p_expected then '' else 'متوقع: ' || p_expected || ' | فعلي: ' || r end));
end $f$;

create or replace function sec_test.deny(p_name text, p_role text, p_uid text, p_sqls text, p_pattern text) returns jsonb
language plpgsql as $f$
declare r text := sec_test.run_as(p_role, p_uid, p_sqls); ok boolean;
begin
  ok := r like 'ERROR:%' and r ~* p_pattern;
  return jsonb_build_array(jsonb_build_object('test', p_name,
    'status', case when ok then 'PASS' else 'FAIL' end,
    'detail', case when ok then '' else 'كان يجب أن يُرفض بـ ' || p_pattern || ' | فعلي: ' || r end));
end $f$;

create or replace function sec_test.run() returns table(n int, test text, status text, detail text)
language plpgsql as $f$
declare
  res jsonb := '[]'; oa uuid; op uuid;
  a text := 'aaaaaaaa-0000-0000-0000-000000000001'; b text := 'bbbbbbbb-0000-0000-0000-000000000002'; adm text := 'cccccccc-0000-0000-0000-000000000003';
  p1 text := '11111111-1111-1111-1111-111111111111'; p2 text := '22222222-2222-2222-2222-222222222222';
  p3 text := '33333333-3333-3333-3333-333333333333'; p4 text := '44444444-4444-4444-4444-444444444444';
  np int; nf int;
begin
  begin
    -- ===== تجهيز (يُلغى بالكامل في النهاية) =====
    insert into auth.users(id) values (a::uuid), (b::uuid), (adm::uuid);
    update profiles set role = 'admin' where id = adm::uuid;
    insert into products(id, slug, name, price_halalas, product_type, is_active, deleted_at, delivery_instructions) values
      (p1::uuid,'p1','منتج 1',5000,'code',true,null,'تعليمات سرية'), (p2::uuid,'p2','منتج 2',100,'code',false,null,null),
      (p3::uuid,'p3','منتج 3',100,'code',true,now(),null), (p4::uuid,'p4','منتج 4',100,'code',true,null,null);
    insert into inventory_items(product_id, secret) select p1::uuid, 'SECRET-P1-' || g from generate_series(1,3) g;
    insert into inventory_items(product_id, secret) values (p2::uuid,'S2'), (p3::uuid,'S3');
    select id into oa from create_order(a::uuid, p1::uuid, 1, 'seed-1');
    select id into op from create_order(a::uuid, p1::uuid, 1, 'seed-2');
    perform process_paid_payment(op, 'pay_seed2', 5000, 'SAR', 'evt_seed2', 'payment_paid');
    perform set_config('t.vars', jsonb_build_object('A',a,'B',b,'ADM',adm,'P1',p1,'P2',p2,'P3',p3,'P4',p4,'OA',oa,'OP',op)::text, true);

    -- ===== 1) IDOR =====
    res := res || sec_test.eq('B لا يقرأ طلب A بالـ ID','authenticated',b,$q$select count(*) from orders where id='{OA}'$q$,'0');
    res := res || sec_test.eq('B لا يرى أي طلبات','authenticated',b,$q$select count(*) from orders$q$,'0');
    res := res || sec_test.eq('A يرى طلباته فقط','authenticated',a,$q$select count(*) from orders$q$,'2');
    res := res || sec_test.eq('B لا يرى منتجات A المشتراة','authenticated',b,$q$select count(*) from my_deliveries()$q$,'0');
    res := res || sec_test.eq('A يرى منتجه المشترى','authenticated',a,$q$select count(*) from my_deliveries()$q$,'1');
    res := res || sec_test.eq('A لا يحصل على تسليم لطلب غير مدفوع','authenticated',a,$q$select count(*) from my_deliveries() where order_id='{OA}'$q$,'0');
    res := res || sec_test.eq('B لا يرى مدفوعات A','authenticated',b,$q$select count(*) from payments$q$,'0');
    res := res || sec_test.eq('A يرى مدفوعاته','authenticated',a,$q$select count(*) from payments$q$,'1');
    res := res || sec_test.deny('anon لا يستدعي my_deliveries','anon','',$q$select * from my_deliveries()$q$,'permission denied');
    res := res || sec_test.deny('anon لا يقرأ orders','anon','',$q$select * from orders$q$,'permission denied');

    -- ===== 2) التلاعب بالسعر والحالات =====
    res := res || sec_test.deny('A لا يُنشئ Order مباشرة','authenticated',a,$q$insert into orders(user_id,product_id,product_name,quantity,unit_price_halalas,total_halalas,idempotency_key) values ('{A}','{P1}','x',1,1,1,'hack')$q$,'permission denied');
    res := res || sec_test.deny('A لا يعدّل السعر','authenticated',a,$q$update orders set total_halalas=1 where id='{OA}'$q$,'permission denied');
    res := res || sec_test.deny('A لا يجعل الطلب paid','authenticated',a,$q$update orders set payment_status='paid' where id='{OA}'$q$,'permission denied');
    res := res || sec_test.deny('A لا يجعل التسليم fulfilled','authenticated',a,$q$update orders set fulfillment_status='fulfilled' where id='{OA}'$q$,'permission denied');
    res := res || sec_test.deny('A لا يحذف طلبه','authenticated',a,$q$delete from orders where id='{OA}'$q$,'permission denied');
    res := res || sec_test.deny('A لا يستدعي create_order','authenticated',a,$q$select create_order('{A}','{P1}',1,'x')$q$,'permission denied');
    res := res || sec_test.deny('A لا يستدعي process_paid_payment','authenticated',a,$q$select process_paid_payment('{OA}','p',5000,'SAR','e','payment_paid')$q$,'permission denied');
    res := res || sec_test.deny('A لا يستدعي fulfill_order','authenticated',a,$q$select fulfill_order('{OA}')$q$,'permission denied');
    res := res || sec_test.eq('السعر الحقيقي من DB (qty=2)','service_role','',$q$select total_halalas from create_order('{A}','{P1}',2,'k-price')$q$,'10000');
    res := res || sec_test.deny('منتج غير نشط لا يُشترى','service_role','',$q$select create_order('{A}','{P2}',1,'k2')$q$,'product_unavailable');
    res := res || sec_test.deny('منتج محذوف ناعمًا لا يُشترى','service_role','',$q$select create_order('{A}','{P3}',1,'k3')$q$,'product_unavailable');
    res := res || sec_test.deny('منتج بلا مخزون لا يُطلب','service_role','',$q$select create_order('{A}','{P4}',1,'k4')$q$,'out_of_stock');
    res := res || sec_test.deny('كمية أكبر من المخزون مرفوضة','service_role','',$q$select create_order('{A}','{P1}',5,'k5')$q$,'out_of_stock|check');
    res := res || sec_test.deny('كمية 0 مرفوضة','service_role','',$q$select create_order('{A}','{P1}',0,'k6')$q$,'check');
    res := res || sec_test.eq('نفس Idempotency-Key = نفس الطلب','service_role','',$q$select (select id from create_order('{A}','{P1}',1,'dup-k')) = (select id from create_order('{A}','{P1}',1,'dup-k'))$q$,'true');

    -- ===== 3) التسليم بدون دفع =====
    res := res || sec_test.deny('fulfill_order على طلب غير مدفوع','service_role','',$q$select fulfill_order('{OA}')$q$,'not_paid');
    res := res || sec_test.eq('طلب معلّق لا يملك deliveries','service_role','',$q$select count(*) from deliveries where order_id='{OA}'$q$,'0');

    -- ===== 4) Admin / تصعيد الصلاحيات =====
    res := res || sec_test.deny('A لا يرفع نفسه Admin (Grant)','authenticated',a,$q$update profiles set role='admin' where id='{A}'$q$,'permission denied');
    res := res || sec_test.deny('Trigger يمنع تغيير role حتى لو فُتح Grant بالخطأ','postgres',a,$q$grant update(role) on profiles to authenticated ;; !authenticated ;; update profiles set role='admin' where id='{A}'$q$,'role change not allowed');
    res := res || sec_test.eq('A لا يعدّل ملف B','authenticated',a,$q$with u as (update profiles set full_name='x' where id='{B}' returning 1) select count(*) from u$q$,'0');
    res := res || sec_test.eq('A يعدّل اسمه','authenticated',a,$q$with u as (update profiles set full_name='أحمد' where id='{A}' returning 1) select count(*) from u$q$,'1');
    res := res || sec_test.eq('العميل لا يقرأ audit_logs','authenticated',a,$q$select count(*) from audit_logs$q$,'0');
    res := res || sec_test.eq('Admin يقرأ audit_logs','authenticated',adm,$q$select count(*)>0 from audit_logs$q$,'true');
    res := res || sec_test.eq('Admin يرى كل الطلبات','authenticated',adm,$q$select count(*) from orders$q$,'2');
    res := res || sec_test.eq('A لا يرى ملف Admin','authenticated',a,$q$select count(*) from profiles where id='{ADM}'$q$,'0');
    res := res || sec_test.deny('العميل (حتى Admin) لا يكتب منتجات مباشرة','authenticated',adm,$q$insert into products(slug,name,price_halalas,product_type) values ('h','h',1,'code')$q$,'permission denied');

    -- ===== 5) المخزون والأسرار =====
    res := res || sec_test.deny('A لا يقرأ inventory_items','authenticated',a,$q$select secret from inventory_items$q$,'permission denied');
    res := res || sec_test.deny('anon لا يقرأ inventory_items','anon','',$q$select secret from inventory_items$q$,'permission denied');
    res := res || sec_test.deny('A لا يقرأ تعليمات التسليم من products','authenticated',a,$q$select delivery_instructions from products$q$,'permission denied');
    res := res || sec_test.deny('A لا يقرأ deliveries','authenticated',a,$q$select * from deliveries$q$,'permission denied');
    res := res || sec_test.deny('A لا يقرأ webhook_events','authenticated',a,$q$select * from webhook_events$q$,'permission denied');
    res := res || sec_test.deny('A لا يعدّل inventory_items','authenticated',a,$q$update inventory_items set status='available'$q$,'permission denied');
    res := res || sec_test.eq('الواجهة العامة لا تحوي أعمدة سرية','postgres','',$q$select count(*) from information_schema.columns where table_name='storefront_products' and column_name in ('secret','delivery_instructions')$q$,'0');
    res := res || sec_test.eq('المتجر يعرض النشط غير المحذوف فقط','anon','',$q$select string_agg(slug,',' order by slug) from storefront_products$q$,'p1,p4');
    res := res || sec_test.eq('منتج بلا مخزون in_stock=false','anon','',$q$select in_stock from storefront_products where slug='p4'$q$,'false');

    -- ===== 6) Webhook =====
    res := res || sec_test.eq('إعادة نفس الحدث = duplicate_event','service_role','',$q$select process_paid_payment('{OP}','pay_seed2',5000,'SAR','evt_seed2','payment_paid')$q$,'duplicate_event');
    res := res || sec_test.eq('نفس الدفعة بحدث جديد = duplicate_payment','service_role','',$q$select process_paid_payment('{OP}','pay_seed2',5000,'SAR','evt_new','payment_paid')$q$,'duplicate_payment');
    res := res || sec_test.eq('التسليم لم يتكرر بعد الإعادة','service_role','',$q$select process_paid_payment('{OP}','pay_seed2',5000,'SAR','evt_seed2','payment_paid') ;; select count(*) from deliveries where order_id='{OP}'$q$,'duplicate_event|1');
    res := res || sec_test.eq('مبلغ خاطئ مرفوض','service_role','',$q$select process_paid_payment('{OA}','pay_x',100,'SAR','evt_a1','payment_paid')$q$,'amount_mismatch');
    res := res || sec_test.eq('عملة خاطئة مرفوضة','service_role','',$q$select process_paid_payment('{OA}','pay_x',5000,'USD','evt_a2','payment_paid')$q$,'amount_mismatch');
    res := res || sec_test.eq('المبلغ الخاطئ لا يغيّر الحالة','service_role','',$q$select process_paid_payment('{OA}','pay_x',100,'SAR','evt_a1','payment_paid') ;; select payment_status||'/'||fulfillment_status from orders where id='{OA}'$q$,'amount_mismatch|pending/pending');
    res := res || sec_test.eq('طلب غير موجود','service_role','',$q$select process_paid_payment('99999999-9999-9999-9999-999999999999','p',1,'SAR','evt_nf','payment_paid')$q$,'order_not_found');
    res := res || sec_test.eq('الدفع الصحيح يسلّم','service_role','',$q$select process_paid_payment('{OA}','pay_ok',5000,'SAR','evt_ok','payment_paid') ;; select payment_status||'/'||fulfillment_status from orders where id='{OA}'$q$,'ok|paid/fulfilled');
    res := res || sec_test.eq('دفعة ثانية لنفس الطلب لا تسلّم مرتين','service_role','',$q$select process_paid_payment('{OA}','pay_ok',5000,'SAR','evt_ok','payment_paid') ;; select process_paid_payment('{OA}','pay_dup',5000,'SAR','evt_dup','payment_paid') ;; select count(*) from deliveries where order_id='{OA}'$q$,'ok|already_paid|1');

    -- ===== 7) إعادة الاستخدام وسجل التدقيق =====
    res := res || sec_test.deny('نفس العنصر لا يُسلَّم لطلبين','postgres','',$q$insert into deliveries(order_id,inventory_item_id) select '{OA}', inventory_item_id from deliveries where order_id='{OP}'$q$,'unique|duplicate');
    res := res || sec_test.eq('fulfill_order المكرر لا يضيف تسليمًا','service_role','',$q$select process_paid_payment('{OA}','pay_ok2',5000,'SAR','evt_ok2','payment_paid') ;; do $x$ begin perform fulfill_order('{OA}'); perform fulfill_order('{OA}'); end $x$ ;; select count(*) from deliveries where order_id='{OA}'$q$,'ok|1');
    res := res || sec_test.deny('Audit Log غير قابل للتعديل','postgres','',$q$update audit_logs set action='x'$q$,'append-only');
    res := res || sec_test.deny('Audit Log غير قابل للحذف','postgres','',$q$delete from audit_logs$q$,'append-only');

    -- ===== 8) بنية الحماية =====
    res := res || sec_test.eq('RLS مفعّل على كل جداول public','postgres','',$q$select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity$q$,'0');
    res := res || sec_test.eq('كل دوال SECURITY DEFINER لها search_path ثابت','postgres','',$q$select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))$q$,'0');
    res := res || sec_test.eq('الطلبات تبقى بعد حذف المنتج ناعمًا ويختفي من المتجر','service_role','',$q$update products set deleted_at=now() where id='{P1}' ;; select count(*) from orders where product_id='{P1}' ;; select count(*) from storefront_products where slug='p1'$q$,'2|0');

    -- ===== 9) دوال الإدارة (service_role فقط) =====
    res := res || sec_test.deny('العميل لا يستدعي admin_stats','authenticated',a,$q$select admin_stats()$q$,'permission denied');
    res := res || sec_test.deny('Admin (كعميل) لا يستدعي admin_stats مباشرة','authenticated',adm,$q$select admin_stats()$q$,'permission denied');
    res := res || sec_test.deny('anon لا يستدعي admin_orders','anon','',$q$select * from admin_orders()$q$,'permission denied');
    res := res || sec_test.deny('العميل لا يستدعي admin_customers','authenticated',a,$q$select * from admin_customers()$q$,'permission denied');
    res := res || sec_test.deny('العميل لا يستدعي admin_inventory_summary','authenticated',a,$q$select * from admin_inventory_summary()$q$,'permission denied');
    res := res || sec_test.eq('admin_stats: المبيعات صحيحة','service_role','',$q$select admin_stats()->>'sales_halalas'$q$,'5000');
    res := res || sec_test.eq('admin_orders: البحث برقم الطلب','service_role','',$q$select count(*) from admin_orders('{OP}')$q$,'1');
    res := res || sec_test.eq('admin_orders: محرف % لا يُرجع كل الطلبات','service_role','',$q$select count(*) from admin_orders('%')$q$,'0');
    res := res || sec_test.eq('admin_orders: الفلترة بالحالة','service_role','',$q$select count(*) from admin_orders(null,'paid','fulfilled')$q$,'1');

    raise exception '__done__';   -- يلغي كل بيانات التجهيز والاختبار
  exception when others then
    if sqlerrm <> '__done__' then
      res := res || jsonb_build_array(jsonb_build_object('test','فشل التجهيز','status','FAIL','detail',sqlerrm));
    end if;
  end;

  select count(*) filter (where e->>'status'='PASS'), count(*) filter (where e->>'status'='FAIL') into np, nf from jsonb_array_elements(res) e;
  return query select 0, 'الملخص', case when nf = 0 then 'ALL PASS' else 'HAS FAILURES' end, format('نجح %s | فشل %s', np, nf);
  return query select i::int, r->>'test', r->>'status', r->>'detail' from jsonb_array_elements(res) with ordinality as t(r, i);
end $f$;

-- النتيجة (الصف الأول = الملخص، ثم الإخفاقات إن وجدت)
select * from sec_test.run() order by (n = 0) desc, (status = 'FAIL') desc, n;

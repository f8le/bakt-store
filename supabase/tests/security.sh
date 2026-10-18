#!/usr/bin/env bash
# اختبارات أمنية على Postgres/Supabase حقيقي.
# مشروع Supabase تجريبي فقط (يترك بيانات اختبار؛ نظّفها بـ cleanup.sql):
#   DATABASE_URL='postgresql://...' bash security.sh
# محليًا: قاعدة باسم t فيها supabase_shim.sql ثم 001_init.sql
[ -n "$DATABASE_URL" ] && case "$DATABASE_URL" in *6543*) echo "استخدم Session pooler (5432) وليس Transaction pooler (6543)"; exit 2;; esac
# الاتصال: DATABASE_URL (مشروع Supabase التجريبي) أو قاعدة محلية اسمها t
db() { psql -X -q -tA -v ON_ERROR_STOP=1 "${DATABASE_URL:-dbname=t}" "$@"; }
A=aaaaaaaa-0000-0000-0000-000000000001; B=bbbbbbbb-0000-0000-0000-000000000002; ADM=cccccccc-0000-0000-0000-000000000003
P1=11111111-1111-1111-1111-111111111111; P2=22222222-2222-2222-2222-222222222222   # P2 غير نشط
P3=33333333-3333-3333-3333-333333333333; P4=44444444-4444-4444-4444-444444444444   # P3 محذوف ناعمًا، P4 بلا مخزون
P5=55555555-5555-5555-5555-555555555555; P6=66666666-6666-6666-6666-666666666666
PASS=0; FAIL=0
pre() { local c="{\"role\":\"$1\"}"; [ -n "$2" ] && c="{\"sub\":\"$2\",\"role\":\"$1\"}"
  echo "begin; set local role $1; set local request.jwt.claim.sub='$2'; set local request.jwt.claim.role='$1'; set local request.jwt.claims='$c';"; }
ok() { # name role uid sql expected
  local out; out=$(db -c "$(pre $2 $3) $4 rollback;" 2>&1); out=$(echo "$out" | tr -d '\r' | sed '/^$/d')
  if [ "$out" == "$5" ]; then PASS=$((PASS+1)); echo "PASS  $1"; else FAIL=$((FAIL+1)); echo "FAIL  $1  (متوقع: '$5' | فعلي: '$out')"; fi; }
deny() { # name role uid sql pattern
  local out rc; out=$(db -c "$(pre $2 $3) $4 rollback;" 2>&1); rc=$?
  if [ $rc -ne 0 ] && echo "$out" | grep -qiE "$5"; then PASS=$((PASS+1)); echo "PASS  $1"; else FAIL=$((FAIL+1)); echo "FAIL  $1  (rc=$rc | $out)"; fi; }
su_ok() { local out; out=$(db -c "$2" 2>&1 | tr -d '\r' | sed '/^$/d'); if [ "$out" == "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1"; else FAIL=$((FAIL+1)); echo "FAIL  $1  (متوقع: '$3' | فعلي: '$out')"; fi; }
su_deny() { local out rc; out=$(db -c "$2" 2>&1); rc=$?; if [ $rc -ne 0 ] && echo "$out" | grep -qiE "$3"; then PASS=$((PASS+1)); echo "PASS  $1"; else FAIL=$((FAIL+1)); echo "FAIL  $1  (rc=$rc | $out)"; fi; }

echo "== تجهيز البيانات =="
db <<SQL || { echo "فشل التجهيز"; exit 1; }
insert into auth.users(id) values ('$A'),('$B'),('$ADM');
update profiles set role='admin' where id='$ADM';
insert into products(id,slug,name,price_halalas,product_type,is_active,deleted_at,delivery_instructions) values
 ('$P1','p1','منتج 1',5000,'code',true,null,'تعليمات سرية'),('$P2','p2','منتج 2',100,'code',false,null,null),
 ('$P3','p3','منتج 3',100,'code',true,now(),null),('$P4','p4','منتج 4',100,'code',true,null,null),
 ('$P5','p5','منتج 5',100,'code',true,null,null),('$P6','p6','منتج 6',100,'code',true,null,null);
insert into inventory_items(product_id,secret) select '$P1','SECRET-P1-'||g from generate_series(1,3) g;
insert into inventory_items(product_id,secret) select '$P2','S2' ; insert into inventory_items(product_id,secret) select '$P3','S3';
insert into inventory_items(product_id,secret) select '$P5','SECRET-P5-'||g from generate_series(1,5) g;
insert into inventory_items(product_id,secret) select '$P6','SECRET-P6-'||g from generate_series(1,3) g;
SQL
OA=$(db -c "select id from create_order('$A','$P1',1,'seed-1')")
OP=$(db -c "select id from create_order('$A','$P1',1,'seed-2')")
db -c "select process_paid_payment('$OP','pay_seed2',5000,'SAR','evt_seed2','payment_paid')" >/dev/null
echo "طلب معلّق=$OA | طلب مدفوع=$OP"

echo; echo "== 1) IDOR / الوصول لبيانات مستخدم آخر =="
ok "B لا يقرأ طلب A بالـ ID"            authenticated $B "select count(*) from orders where id='$OA';" 0
ok "B لا يرى أي طلبات"                  authenticated $B "select count(*) from orders;" 0
ok "A يرى طلباته فقط"                    authenticated $A "select count(*) from orders;" 2
ok "B لا يرى منتجات A المشتراة"          authenticated $B "select count(*) from my_deliveries();" 0
ok "A يرى منتجه المشترى"                 authenticated $A "select count(*) from my_deliveries();" 1
ok "A لا يحصل على تسليم لطلب غير مدفوع"  authenticated $A "select count(*) from my_deliveries() where order_id='$OA';" 0
ok "B لا يرى مدفوعات A"                  authenticated $B "select count(*) from payments;" 0
ok "A يرى مدفوعاته"                      authenticated $A "select count(*) from payments;" 1
deny "anon لا يستدعي my_deliveries"      anon "" "select * from my_deliveries();" "permission denied"
deny "anon لا يقرأ orders"               anon "" "select * from orders;" "permission denied"

echo; echo "== 2) التلاعب بالسعر والحالات =="
deny "A لا يُنشئ Order مباشرة"           authenticated $A "insert into orders(user_id,product_id,product_name,quantity,unit_price_halalas,total_halalas,idempotency_key) values ('$A','$P1','x',1,1,1,'hack');" "permission denied"
deny "A لا يعدّل السعر"                  authenticated $A "update orders set total_halalas=1 where id='$OA';" "permission denied"
deny "A لا يجعل الطلب paid"              authenticated $A "update orders set payment_status='paid' where id='$OA';" "permission denied"
deny "A لا يجعل التسليم fulfilled"       authenticated $A "update orders set fulfillment_status='fulfilled' where id='$OA';" "permission denied"
deny "A لا يحذف طلبه"                    authenticated $A "delete from orders where id='$OA';" "permission denied"
deny "A لا يستدعي create_order"          authenticated $A "select create_order('$A','$P1',1,'x');" "permission denied"
deny "A لا يستدعي process_paid_payment"  authenticated $A "select process_paid_payment('$OA','p',5000,'SAR','e','payment_paid');" "permission denied"
deny "A لا يستدعي fulfill_order"         authenticated $A "select fulfill_order('$OA');" "permission denied"
ok   "السعر الحقيقي من DB (qty=2)"        service_role "" "select total_halalas from create_order('$A','$P1',2,'k-price');" 10000
deny "منتج غير نشط لا يُشترى"            service_role "" "select create_order('$A','$P2',1,'k2');" "product_unavailable"
deny "منتج محذوف ناعمًا لا يُشترى"        service_role "" "select create_order('$A','$P3',1,'k3');" "product_unavailable"
deny "منتج بلا مخزون لا يُطلب"           service_role "" "select create_order('$A','$P4',1,'k4');" "out_of_stock"
deny "كمية أكبر من المخزون مرفوضة"        service_role "" "select create_order('$A','$P1',5,'k5');" "out_of_stock|check"
deny "كمية 0 أو سالبة مرفوضة"            service_role "" "select create_order('$A','$P1',0,'k6');" "check"

echo; echo "== 3) التسليم بدون دفع =="
deny "fulfill_order على طلب غير مدفوع"   service_role "" "select fulfill_order('$OA');" "not_paid"
ok   "طلب معلّق لا يملك deliveries"      service_role "" "select count(*) from deliveries where order_id='$OA';" 0

echo; echo "== 4) صلاحيات Admin / تصعيد الصلاحيات =="
deny "A لا يرفع نفسه Admin (Grant)"      authenticated $A "update profiles set role='admin' where id='$A';" "permission denied"
su_deny "Trigger يمنع تغيير role حتى لو فُتح Grant بالخطأ" "begin; grant update(role) on profiles to authenticated; set local role authenticated; set local request.jwt.claim.sub='$A'; update profiles set role='admin' where id='$A'; rollback;" "role change not allowed"
ok   "A لا يعدّل ملف B"                  authenticated $A "with u as (update profiles set full_name='x' where id='$B' returning 1) select count(*) from u;" 0
ok   "A يعدّل اسمه"                      authenticated $A "with u as (update profiles set full_name='أحمد' where id='$A' returning 1) select count(*) from u;" 1
ok   "العميل لا يقرأ audit_logs"         authenticated $A "select count(*) from audit_logs;" 0
ok   "Admin يقرأ audit_logs"             authenticated $ADM "select count(*)>0 from audit_logs;" t
ok   "Admin يرى كل الطلبات"              authenticated $ADM "select count(*) from orders;" 2
ok   "A لا يرى ملف Admin"                authenticated $A "select count(*) from profiles where id='$ADM';" 0
deny "Admin العميل لا يكتب منتجات مباشرة" authenticated $ADM "insert into products(slug,name,price_halalas,product_type) values ('h','h',1,'code');" "permission denied"

echo; echo "== 5) المخزون والأسرار =="
deny "A لا يقرأ inventory_items"         authenticated $A "select secret from inventory_items;" "permission denied"
deny "anon لا يقرأ inventory_items"      anon "" "select secret from inventory_items;" "permission denied"
deny "A لا يقرأ products (التعليمات)"    authenticated $A "select delivery_instructions from products;" "permission denied"
deny "A لا يقرأ deliveries"              authenticated $A "select * from deliveries;" "permission denied"
deny "A لا يقرأ webhook_events"          authenticated $A "select * from webhook_events;" "permission denied"
deny "A لا يعدّل inventory_items"        authenticated $A "update inventory_items set status='available';" "permission denied"
ok   "الواجهة العامة لا تحوي أعمدة سرية" anon "" "select count(*) from information_schema.columns where table_name='storefront_products' and column_name in ('secret','delivery_instructions');" 0
ok   "المتجر يعرض النشط فقط"             anon "" "select string_agg(slug,',' order by slug) from storefront_products;" "p1,p4,p5,p6"
ok   "منتج بلا مخزون يظهر in_stock=false" anon "" "select in_stock from storefront_products where slug='p4';" f

echo; echo "== 6) Webhook: إعادة الإرسال والتحقق =="
ok   "إعادة نفس الحدث = duplicate_event" service_role "" "select process_paid_payment('$OP','pay_seed2',5000,'SAR','evt_seed2','payment_paid');" duplicate_event
ok   "نفس الدفعة بحدث جديد = duplicate_payment" service_role "" "select process_paid_payment('$OP','pay_seed2',5000,'SAR','evt_new','payment_paid');" duplicate_payment
ok   "التسليم لم يتكرر بعد الإعادة"      service_role "" "select process_paid_payment('$OP','pay_seed2',5000,'SAR','evt_seed2','payment_paid'); select count(*) from deliveries where order_id='$OP';" "duplicate_event
1"
ok   "مبلغ خاطئ مرفوض"                   service_role "" "select process_paid_payment('$OA','pay_x',100,'SAR','evt_a1','payment_paid');" amount_mismatch
ok   "عملة خاطئة مرفوضة"                 service_role "" "select process_paid_payment('$OA','pay_x',5000,'USD','evt_a2','payment_paid');" amount_mismatch
ok   "المبلغ الخاطئ لا يغيّر الحالة"      service_role "" "select process_paid_payment('$OA','pay_x',100,'SAR','evt_a1','payment_paid'); select payment_status||'/'||fulfillment_status from orders where id='$OA';" "amount_mismatch
pending/pending"
ok   "طلب غير موجود"                     service_role "" "select process_paid_payment('99999999-9999-9999-9999-999999999999','p',1,'SAR','evt_nf','payment_paid');" order_not_found
ok   "الدفع الصحيح يسلّم"                service_role "" "select process_paid_payment('$OA','pay_ok',5000,'SAR','evt_ok','payment_paid'); select payment_status||'/'||fulfillment_status from orders where id='$OA';" "ok
paid/fulfilled"
ok   "دفعة ثانية لنفس الطلب لا تسلّم مرتين" service_role "" "select process_paid_payment('$OA','pay_ok',5000,'SAR','evt_ok','payment_paid'); select process_paid_payment('$OA','pay_dup',5000,'SAR','evt_dup','payment_paid'); select count(*) from deliveries where order_id='$OA';" "ok
already_paid
1"

echo; echo "== 7) إعادة استخدام المنتج المسلَّم =="
su_deny "نفس العنصر لا يُسلَّم لطلبين"   "insert into deliveries(order_id,inventory_item_id) select '$OA', inventory_item_id from deliveries where order_id='$OP';" "unique|duplicate"
ok   "fulfill_order المكرر لا يضيف تسليمًا" service_role "" "select process_paid_payment('$OA','pay_ok2',5000,'SAR','evt_ok2','payment_paid'); select fulfill_order('$OA'); select fulfill_order('$OA'); select count(*) from deliveries where order_id='$OA';" "ok
1"
su_deny "Audit Log غير قابل للتعديل"     "update audit_logs set action='x';" "append-only"
su_deny "Audit Log غير قابل للحذف"       "delete from audit_logs;" "append-only"

echo; echo "== 8) بنية الحماية =="
su_ok "RLS مفعّل على كل جداول public"    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;" 0
su_ok "كل دوال SECURITY DEFINER لها search_path ثابت" "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));" 0
ok   "الطلب يبقى بعد حذف المنتج ناعمًا ويختفي من المتجر" service_role "" "update products set deleted_at=now() where id='$P1'; select count(*) from orders where product_id='$P1'; select count(*) from storefront_products where slug='p1';" "2
0"

echo; echo "== 8.5) دوال الإدارة =="
deny "العميل لا يستدعي admin_stats"        authenticated $A "select admin_stats();" "permission denied"
deny "Admin كعميل لا يستدعي admin_stats"   authenticated $ADM "select admin_stats();" "permission denied"
deny "anon لا يستدعي admin_orders"         anon "" "select * from admin_orders();" "permission denied"
deny "العميل لا يستدعي admin_customers"    authenticated $A "select * from admin_customers();" "permission denied"
ok   "admin_stats: المبيعات صحيحة"         service_role "" "select admin_stats()->>'sales_halalas';" 5000
ok   "admin_orders: % لا يُرجع الكل"        service_role "" "select count(*) from admin_orders('%');" 0

echo; echo "== 9) التزامن (عمليات متوازية حقيقية) =="
mkorder() { db -c "select id from create_order('$A','$1',1,'$2')"; }
# أ) 10 ضغطات متوازية بنفس Idempotency-Key
rm -f /tmp/dc_*; for i in $(seq 1 10); do ( db -c "select id from create_order('$A','$P6',1,'dbl-click')" > /tmp/dc_$i 2>&1 ) & done; wait
N=$(db -c "select count(*) from orders where idempotency_key='dbl-click'"); ERR=$(grep -l -iE "error|duplicate" /tmp/dc_* 2>/dev/null | wc -l)
if [ "$N" == "1" ]; then PASS=$((PASS+1)); echo "PASS  ضغط الدفع 10 مرات = طلب واحد فقط"; else FAIL=$((FAIL+1)); echo "FAIL  طلبات مكررة: $N"; fi
if [ "$ERR" == "0" ]; then PASS=$((PASS+1)); echo "PASS  والبقية تستلم نفس الطلب بلا أخطاء"; else FAIL=$((FAIL+1)); echo "FAIL  $ERR من الاستدعاءات المتوازية رجعت بخطأ (500 للعميل)"; fi
# ب) 10 طلبات مدفوعة بالتوازي على مخزون 5
IDS=(); for i in $(seq 1 10); do IDS+=($(mkorder $P5 "conc-$i")); done
for i in $(seq 1 10); do ( db -c "select process_paid_payment('${IDS[$((i-1))]}','cp_$i',100,'SAR','ce_$i','payment_paid')" >/dev/null 2>&1 ) & done; wait
F=$(db -c "select count(*) from orders where product_id='$P5' and fulfillment_status='fulfilled'")
X=$(db -c "select count(*) from orders where product_id='$P5' and fulfillment_status='failed'")
D=$(db -c "select count(distinct inventory_item_id)||'/'||count(*) from deliveries d join orders o on o.id=d.order_id where o.product_id='$P5'")
S=$(db -c "select count(*) from inventory_items where product_id='$P5' and status='sold'")
if [ "$F/$X/$D/$S" == "5/5/5/5/5/5" ] || [ "$F/$X/$D/$S" == "5/5/5/5" ]; then echo; fi
if [ "$F" == "5" ] && [ "$X" == "5" ] && [ "$D" == "5/5" ] && [ "$S" == "5" ]; then PASS=$((PASS+1)); echo "PASS  10 دفعات متوازية على 5 مخزون: 5 سُلّمت، 5 فشلت، لا تسليم مزدوج"; else FAIL=$((FAIL+1)); echo "FAIL  fulfilled=$F failed=$X deliveries(distinct/total)=$D sold=$S"; fi
# ج) نفس الـ Webhook 10 مرات بالتوازي
OC=$(mkorder $P6 "wh-conc"); rm -f /tmp/wh_*
for i in $(seq 1 10); do ( db -c "select process_paid_payment('$OC','wh_pay','100','SAR','wh_evt','payment_paid')" > /tmp/wh_$i 2>&1 ) & done; wait
OKC=$(cat /tmp/wh_* | grep -c '^ok$'); DD=$(db -c "select count(*) from deliveries where order_id='$OC'")
if [ "$OKC" == "1" ] && [ "$DD" == "1" ]; then PASS=$((PASS+1)); echo "PASS  نفس الـ Webhook 10 مرات متوازية = معالجة واحدة وتسليم واحد"; else FAIL=$((FAIL+1)); echo "FAIL  ok=$OKC deliveries=$DD  $(cat /tmp/wh_* | sort | uniq -c | tr '\n' ' ')"; fi

echo; echo "النتيجة: نجح $PASS | فشل $FAIL"; [ $FAIL -eq 0 ]

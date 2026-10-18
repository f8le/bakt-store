-- ============ الأنواع ============
create extension if not exists pgcrypto;
create type app_role as enum ('customer','admin');
create type payment_status as enum ('pending','paid','failed','refunded');
create type fulfillment_status as enum ('pending','fulfilled','failed');
create type inventory_status as enum ('available','sold','void');

create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============ الجداول ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 100),
  phone text check (char_length(phone) <= 20),
  role app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  slug text unique not null,
  name text not null,
  description text,
  image_url text,
  price_halalas int not null check (price_halalas >= 0),      -- السعر بالهللة (SAR*100)
  compare_at_halalas int check (compare_at_halalas >= 0),     -- السعر السابق
  duration text,                                              -- مدة الاشتراك
  product_type text not null check (product_type in ('code','account','subscription','key')),
  features jsonb not null default '[]',
  delivery_instructions text,                                 -- لا تظهر إلا بعد الشراء
  is_active boolean not null default true,
  deleted_at timestamptz,                                     -- Soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  secret text not null,                                       -- الكود/الحساب (Server-side فقط)
  status inventory_status not null default 'available',
  order_id uuid,
  sold_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index inventory_unique_secret on inventory_items (product_id, md5(secret));
create index inventory_available_idx on inventory_items (product_id, created_at) where status = 'available';

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  product_id uuid not null references products(id),
  product_name text not null,                                 -- Snapshot
  quantity int not null check (quantity between 1 and 5),
  unit_price_halalas int not null,
  total_halalas int not null,
  currency text not null default 'SAR',
  payment_status payment_status not null default 'pending',
  fulfillment_status fulfillment_status not null default 'pending',
  payment_reference text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index orders_user_idx on orders (user_id, created_at desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider text not null,
  provider_payment_id text not null,
  amount_halalas int not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)                      -- يمنع إعادة استخدام نفس الدفعة
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  type text not null,
  received_at timestamptz not null default now(),
  unique (provider, event_id)                                 -- Idempotency / Replay
);

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  inventory_item_id uuid not null unique references inventory_items(id), -- عنصر واحد = تسليم واحد
  delivered_at timestamptz not null default now()
);

create table audit_logs (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}',                           -- ممنوع وضع أسرار هنا
  created_at timestamptz not null default now()
);

create trigger t_profiles_u before update on profiles for each row execute function set_updated_at();
create trigger t_products_u before update on products for each row execute function set_updated_at();
create trigger t_orders_u before update on orders for each row execute function set_updated_at();

-- Audit Log غير قابل للتعديل أو الحذف
create function audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_logs is append-only'; end $$;
create trigger t_audit_ro before update or delete on audit_logs for each row execute function audit_immutable();

-- ============ الصلاحيات ============
create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- منع تصعيد الصلاحيات: العملاء (anon/authenticated) لا يغيّرون role أبدًا.
-- السيرفر (service_role) ومحرر SQL (postgres) مسموح لهما. نعتمد على الدور الفعلي وليس على JWT claims.
create function protect_role() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and current_user in ('anon', 'authenticated') then
    raise exception 'role change not allowed';
  end if;
  return new;
end $$;
create trigger t_protect_role before update on profiles for each row execute function protect_role();

-- إنشاء profile تلقائيًا (دائمًا customer)
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''), 100));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ============ الدوال (Server-side فقط) ============
-- إنشاء الطلب: السعر يُقرأ من قاعدة البيانات فقط
create function create_order(p_user_id uuid, p_product_id uuid, p_qty int, p_idem text)
returns orders language plpgsql security definer set search_path = public as $$
declare p products; o orders; stock int;
begin
  select * into o from orders where user_id = p_user_id and idempotency_key = p_idem;
  if found then return o; end if;                             -- ضغط الزر مرتين = نفس الطلب
  select * into p from products where id = p_product_id and is_active and deleted_at is null;
  if not found then raise exception 'product_unavailable'; end if;
  select count(*) into stock from inventory_items where product_id = p.id and status = 'available';
  if stock < p_qty then raise exception 'out_of_stock'; end if;
  begin
    insert into orders (user_id, product_id, product_name, quantity, unit_price_halalas, total_halalas, idempotency_key)
    values (p_user_id, p.id, p.name, p_qty, p.price_halalas, p.price_halalas * p_qty, p_idem)
    returning * into o;
  exception when unique_violation then                        -- ضغطتان متزامنتان بنفس المفتاح: نعيد الطلب الفائز
    select * into o from orders where user_id = p_user_id and idempotency_key = p_idem;
  end;
  return o;
end $$;

-- التسليم الذري: FOR UPDATE SKIP LOCKED يمنع التسليم المزدوج تحت التزامن
create function fulfill_order(p_order_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders; ids uuid[];
begin
  select * into o from orders where id = p_order_id for update;
  if o.payment_status <> 'paid' then raise exception 'not_paid'; end if;
  if o.fulfillment_status = 'fulfilled' then return; end if;
  select array_agg(id) into ids from (
    select id from inventory_items where product_id = o.product_id and status = 'available'
    order by created_at limit o.quantity for update skip locked) s;
  if coalesce(array_length(ids, 1), 0) < o.quantity then
    update orders set fulfillment_status = 'failed' where id = o.id;
    insert into audit_logs (action, entity, entity_id, meta) values ('fulfillment.failed','order',o.id::text,'{"reason":"no_stock"}');
    return;
  end if;
  update inventory_items set status='sold', order_id=o.id, sold_at=now() where id = any(ids);
  insert into deliveries (order_id, inventory_item_id) select o.id, unnest(ids);
  update orders set fulfillment_status = 'fulfilled' where id = o.id;
  insert into audit_logs (action, entity, entity_id, meta) values ('fulfillment.done','order',o.id::text,jsonb_build_object('count',o.quantity));
end $$;

-- معالجة الدفع المؤكد: معاملة واحدة ذرية + Idempotent
create function process_paid_payment(p_order_id uuid, p_payment_id text, p_amount int, p_currency text, p_event_id text, p_event_type text)
returns text language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  insert into webhook_events (provider, event_id, type) values ('moyasar', p_event_id, p_event_type) on conflict do nothing;
  if not found then return 'duplicate_event'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then return 'order_not_found'; end if;
  if o.total_halalas <> p_amount or o.currency <> p_currency then
    insert into audit_logs (action, entity, entity_id, meta) values ('payment.amount_mismatch','order',o.id::text,
      jsonb_build_object('expected',o.total_halalas,'got',p_amount));
    return 'amount_mismatch';
  end if;
  insert into payments (order_id, provider, provider_payment_id, amount_halalas, status)
  values (o.id, 'moyasar', p_payment_id, p_amount, 'paid') on conflict (provider, provider_payment_id) do nothing;
  if not found then return 'duplicate_payment'; end if;
  if o.payment_status = 'paid' then
    insert into audit_logs (action, entity, entity_id, meta) values ('payment.extra_payment','order',o.id::text,jsonb_build_object('payment',p_payment_id));
    return 'already_paid';                                    -- يحتاج استرداد يدوي
  end if;
  update orders set payment_status = 'paid', payment_reference = p_payment_id where id = o.id;
  perform fulfill_order(o.id);
  return 'ok';
end $$;

-- منتجات العميل المشتراة: auth.uid() فقط وطلب مدفوع فقط
create function my_deliveries()
returns table (order_id uuid, product_name text, secret text, instructions text, delivered_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.product_name, i.secret, p.delivery_instructions, d.delivered_at
  from deliveries d
  join orders o on o.id = d.order_id and o.user_id = auth.uid() and o.payment_status = 'paid'
  join inventory_items i on i.id = d.inventory_item_id
  join products p on p.id = o.product_id
  order by d.delivered_at desc $$;

-- ============ واجهة المتجر العامة (بدون أسرار أو عدد المخزون) ============
create view storefront_products as
select p.id, p.slug, p.name, p.description, p.image_url, p.price_halalas, p.compare_at_halalas,
       p.duration, p.product_type, p.features, p.category_id,
       exists (select 1 from inventory_items i where i.product_id = p.id and i.status = 'available') as in_stock
from products p where p.is_active and p.deleted_at is null;

-- ============ RLS ============
alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table inventory_items enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table webhook_events enable row level security;
alter table deliveries enable row level security;
alter table audit_logs enable row level security;

-- إغلاق كل شيء أولًا ثم فتح الضروري فقط
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

create policy profiles_select on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy profiles_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select on profiles to authenticated;
grant update (full_name, phone) on profiles to authenticated;          -- role غير قابل للتعديل

create policy orders_select on orders for select to authenticated using (user_id = auth.uid() or is_admin());
grant select on orders to authenticated;                                -- لا INSERT/UPDATE/DELETE

create policy payments_select on payments for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin())));
grant select on payments to authenticated;

create policy categories_select on categories for select to anon, authenticated using (is_active and deleted_at is null);
grant select on categories to anon, authenticated;

create policy audit_select on audit_logs for select to authenticated using (is_admin());
grant select on audit_logs to authenticated;

grant select on storefront_products to anon, authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function my_deliveries() to authenticated;
-- products / inventory_items / deliveries / webhook_events: بلا أي Policy أو Grant للعملاء.
-- الإدارة تتم عبر Server Routes بـ service_role بعد requireAdmin().
-- create_order / fulfill_order / process_paid_payment: service_role فقط (صلاحية التنفيذ ممنوحة له افتراضيًا).

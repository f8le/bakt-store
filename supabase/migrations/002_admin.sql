-- دوال لوحة الإدارة: تُستدعى من السيرفر فقط (service_role) بعد requireAdmin()
create function admin_stats() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sales_halalas', coalesce((select sum(total_halalas) from orders where payment_status = 'paid'), 0),
    'orders_total', (select count(*) from orders),
    'orders_paid', (select count(*) from orders where payment_status = 'paid'),
    'orders_pending', (select count(*) from orders where payment_status = 'pending'),
    'orders_new_24h', (select count(*) from orders where created_at > now() - interval '24 hours'),
    'fulfillment_failed', (select count(*) from orders where payment_status = 'paid' and fulfillment_status = 'failed'),
    'customers', (select count(*) from profiles where role = 'customer'),
    'top_products', coalesce((select jsonb_agg(t) from (
        select product_name, sum(quantity)::int as qty, sum(total_halalas)::bigint as revenue
        from orders where payment_status = 'paid' group by product_id, product_name order by qty desc limit 5) t), '[]'),
    'low_stock', coalesce((select jsonb_agg(t) from (
        select p.id, p.name, count(i.id) filter (where i.status = 'available')::int as available
        from products p left join inventory_items i on i.product_id = p.id
        where p.deleted_at is null group by p.id, p.name
        having count(i.id) filter (where i.status = 'available') <= 5 order by 3, 2 limit 10) t), '[]')
  ) $$;

create function admin_inventory_summary()
returns table (product_id uuid, name text, is_active boolean, available bigint, sold bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.is_active,
         count(i.id) filter (where i.status = 'available'), count(i.id) filter (where i.status = 'sold')
  from products p left join inventory_items i on i.product_id = p.id
  where p.deleted_at is null group by p.id, p.name, p.is_active order by p.name $$;

create function admin_orders(p_search text default null, p_pay payment_status default null, p_fulfil fulfillment_status default null,
                             p_limit int default 50, p_offset int default 0)
returns table (id uuid, email text, product_name text, quantity int, total_halalas int,
               payment_status payment_status, fulfillment_status fulfillment_status, created_at timestamptz, total_count bigint)
language sql stable security definer set search_path = public as $$
  select o.id, u.email::text, o.product_name, o.quantity, o.total_halalas, o.payment_status, o.fulfillment_status, o.created_at, count(*) over ()
  from orders o
  join auth.users u on u.id = o.user_id,
  lateral (select '%' || replace(replace(replace(coalesce(p_search, ''), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as pat) s
  where (p_pay is null or o.payment_status = p_pay)
    and (p_fulfil is null or o.fulfillment_status = p_fulfil)
    and (coalesce(btrim(p_search), '') = '' or o.id::text = lower(btrim(p_search)) or u.email ilike s.pat or o.product_name ilike s.pat)
  order by o.created_at desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0) $$;

create function admin_customers(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, email text, full_name text, role app_role, created_at timestamptz, orders_count bigint, total_spent bigint, total_count bigint)
language sql stable security definer set search_path = public as $$
  select pr.id, u.email::text, pr.full_name, pr.role, pr.created_at,
         count(o.id) filter (where o.payment_status = 'paid'),
         coalesce(sum(o.total_halalas) filter (where o.payment_status = 'paid'), 0)::bigint,
         count(*) over ()
  from profiles pr
  join auth.users u on u.id = pr.id
  left join orders o on o.user_id = pr.id,
  lateral (select '%' || replace(replace(replace(coalesce(p_search, ''), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as pat) s
  where coalesce(btrim(p_search), '') = '' or u.email ilike s.pat or pr.full_name ilike s.pat
  group by pr.id, u.email, pr.full_name, pr.role, pr.created_at
  order by pr.created_at desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0) $$;

-- الدوال الجديدة تأخذ صلاحيات افتراضية في Supabase، فنسحبها صراحةً
revoke all on function admin_stats(), admin_inventory_summary(), admin_orders(text, payment_status, fulfillment_status, int, int),
  admin_customers(text, int, int) from public, anon, authenticated;
grant execute on function admin_stats(), admin_inventory_summary(), admin_orders(text, payment_status, fulfillment_status, int, int),
  admin_customers(text, int, int) to service_role;

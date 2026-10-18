import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

// service_role: يتجاوز RLS. يُستخدم Server-side فقط وبعد التحقق من الهوية/الصلاحية.
export const admin = () =>
  createClient(env().NEXT_PUBLIC_SUPABASE_URL, env().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

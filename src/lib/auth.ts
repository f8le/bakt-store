import 'server-only';
import { userClient } from './supabase/server';
import { admin } from './supabase/admin';

import { HttpError } from './http-error';
export { HttpError };

export async function requireUser() {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();   // يتحقق من JWT لدى Supabase (لا نثق بالكوكي فقط)
  if (!user) throw new HttpError(401, 'يجب تسجيل الدخول أولًا');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  // الدور يُقرأ من جدول profiles وليس من user_metadata (الأخير قابل للتعديل من العميل)
  const { data } = await admin().from('profiles').select('role').eq('id', user.id).single();
  if (data?.role !== 'admin') throw new HttpError(403, 'غير مصرح لك بهذه العملية');
  return user;
}

import { redirect } from 'next/navigation';
/** للصفحات (وليس الـ API): يحوّل لتسجيل الدخول مع العودة بعده */
export async function requirePageUser(next: string) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { user, sb };
}

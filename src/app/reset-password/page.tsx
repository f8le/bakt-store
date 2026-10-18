import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { userClient } from '@/lib/supabase/server';
import ResetForm from '@/components/ResetForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'كلمة مرور جديدة', robots: { index: false } };

// لا تُعرض إلا بجلسة صالحة جاءت من رابط الاستعادة (عبر /auth/callback)، وإلا نعيد المستخدم لطلب رابط جديد
export default async function Page() {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/forgot-password');
  return <ResetForm />;
}

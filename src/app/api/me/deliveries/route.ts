import { NextResponse } from 'next/server';
import { handle, noStore } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { userClient } from '@/lib/supabase/server';

export const GET = () => handle(async () => {
  await requireUser();
  const sb = await userClient();                           // بصلاحيات المستخدم: auth.uid() داخل الدالة
  const { data, error } = await sb.rpc('my_deliveries');
  if (error) throw error;
  return NextResponse.json({ items: data }, { headers: noStore });
});

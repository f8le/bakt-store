import { NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';

// تأكيد البريد: نبدّل الـ code بجلسة ثم نحوّل لمسار داخلي فقط
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const dest = new URL(safeNext(url.searchParams.get('next')), url.origin);
  if (code) {
    const sb = await userClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/login', url.origin));
  }
  return NextResponse.redirect(dest);
}

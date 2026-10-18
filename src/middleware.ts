import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // حماية CSRF: الطلبات المغيّرة للبيانات يجب أن تأتي من موقعنا (الـ Webhook مستثنى ويُحمى بالتوقيع)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && pathname.startsWith('/api/') && !pathname.startsWith('/api/webhooks/')) {
    if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_SITE_URL) {
      return NextResponse.json({ error: 'طلب غير مسموح' }, { status: 403 });
    }
  }
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser(); // تجديد الجلسة. الحماية الفعلية للمسارات تتم داخل كل Route/Page
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

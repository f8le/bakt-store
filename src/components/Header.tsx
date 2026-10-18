import Link from 'next/link';
import { SITE } from '@/lib/site';
import { userClient } from '@/lib/supabase/server';

export default async function Header() {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  const isAdmin = user ? (await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()).data?.role === 'admin' : false;
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-brand">{SITE.nameAr}</span>
          <span className="text-xs font-medium tracking-widest text-neutral-400">{SITE.nameEn}</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/products" className="rounded-lg px-3 py-2 hover:bg-neutral-100">المنتجات</Link>
          <Link href="/contact" className="hidden rounded-lg px-3 py-2 hover:bg-neutral-100 sm:block">الدعم</Link>
          {user ? (
            <>
              {isAdmin && <Link href="/admin" className="btn-ghost border-brand text-brand">الإدارة</Link>}
              <Link href="/account" className="btn-ghost">حسابي</Link>
              <form action="/api/auth/signout" method="post"><button className="rounded-lg px-3 py-2 text-neutral-500 hover:bg-neutral-100">خروج</button></form>
            </>
          ) : (
            <Link href="/login" className="btn-ghost">دخول</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/browser';
import { safeNext } from '@/lib/safe-next';

export default function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'err' | 'ok'; text: string } | null>(null);
  const signup = mode === 'signup';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email')).trim().toLowerCase();
    const password = String(f.get('password'));
    const name = String(f.get('name') ?? '').trim().slice(0, 100);
    if (signup && password.length < 8) return setMsg({ type: 'err', text: 'كلمة المرور يجب ألا تقل عن 8 أحرف' });
    if (signup && password !== String(f.get('confirm'))) return setMsg({ type: 'err', text: 'كلمتا المرور غير متطابقتين' });
    setBusy(true); setMsg(null);
    const sb = browserClient();
    if (signup) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name },
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}` } });
      setBusy(false);
      if (error) return setMsg({ type: 'err', text: 'تعذّر إنشاء الحساب. تأكد من البيانات أو جرّب بريدًا آخر' });
      if (data.session) { location.href = safeNext(next); return; }
      return setMsg({ type: 'ok', text: 'تم إنشاء الحساب. أرسلنا رابط التأكيد إلى بريدك، افتحه ثم سجّل الدخول.' });
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }); // رسالة موحّدة
    location.href = safeNext(next);
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold">{signup ? 'إنشاء حساب' : 'تسجيل الدخول'}</h1>
      {signup && <input name="name" placeholder="الاسم" maxLength={100} className="input" autoComplete="name" />}
      <input name="email" type="email" required placeholder="البريد الإلكتروني" className="input" autoComplete="email" dir="ltr" />
      <input name="password" type="password" required minLength={signup ? 8 : undefined} placeholder="كلمة المرور" className="input" autoComplete={signup ? 'new-password' : 'current-password'} dir="ltr" />
      {signup && <input name="confirm" type="password" required placeholder="تأكيد كلمة المرور" className="input" autoComplete="new-password" dir="ltr" />}
      {msg && <p role="alert" className={`rounded-lg p-3 text-sm ${msg.type === 'err' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg.text}</p>}
      {!signup && <p className="text-sm"><Link className="text-brand" href="/forgot-password">نسيت كلمة المرور؟</Link></p>}
      <button className="btn w-full" disabled={busy}>{busy ? 'لحظة…' : signup ? 'إنشاء الحساب' : 'دخول'}</button>
      <p className="text-center text-sm text-neutral-500">
        {signup ? <>لديك حساب؟ <Link className="text-brand" href={`/login?next=${encodeURIComponent(next)}`}>سجّل الدخول</Link></>
                : <>ليس لديك حساب؟ <Link className="text-brand" href={`/signup?next=${encodeURIComponent(next)}`}>أنشئ حسابًا</Link></>}
      </p>
    </form>
  );
}

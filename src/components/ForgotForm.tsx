'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

export default function ForgotForm() {
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true);
    const email = String(new FormData(e.currentTarget).get('email')).trim().toLowerCase();
    await browserClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/reset-password` });
    setBusy(false); setDone(true);   // نفس الرسالة دائمًا: لا نكشف هل البريد مسجّل (منع User Enumeration)
  }
  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold">استعادة كلمة المرور</h1>
      {done ? <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">إن كان هذا البريد مسجّلًا لدينا فقد أرسلنا إليه رابط الاستعادة. تحقق من بريدك (وملف الرسائل غير المرغوبة).</p> : (
        <>
          <input name="email" type="email" required placeholder="البريد الإلكتروني" className="input" dir="ltr" autoComplete="email" />
          <button className="btn w-full" disabled={busy}>{busy ? 'لحظة…' : 'إرسال رابط الاستعادة'}</button>
        </>)}
    </form>
  );
}

'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

export default function ResetForm() {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget); const pw = String(f.get('pw'));
    if (pw.length < 8) return setMsg({ ok: false, t: 'كلمة المرور يجب ألا تقل عن 8 أحرف' });
    if (pw !== String(f.get('confirm'))) return setMsg({ ok: false, t: 'كلمتا المرور غير متطابقتين' });
    setBusy(true);
    const { error } = await browserClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, t: 'تعذّر تغيير كلمة المرور. اطلب رابط استعادة جديدًا.' });
    setMsg({ ok: true, t: 'تم تغيير كلمة المرور.' }); setTimeout(() => { location.href = '/account'; }, 1200);
  }
  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold">كلمة مرور جديدة</h1>
      <input name="pw" type="password" required minLength={8} placeholder="كلمة المرور الجديدة" className="input" dir="ltr" autoComplete="new-password" />
      <input name="confirm" type="password" required placeholder="تأكيد كلمة المرور" className="input" dir="ltr" autoComplete="new-password" />
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.t}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? 'لحظة…' : 'حفظ'}</button>
    </form>
  );
}

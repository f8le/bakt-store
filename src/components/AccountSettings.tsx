'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

export default function AccountSettings({ userId, fullName, phone }: { userId: string; fullName: string; phone: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const sb = browserClient();

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await sb.from('profiles').update({ full_name: String(f.get('name')).trim().slice(0, 100), phone: String(f.get('phone')).trim().slice(0, 20) }).eq('id', userId);
    setMsg(error ? { ok: false, t: 'تعذّر حفظ البيانات' } : { ok: true, t: 'تم حفظ بياناتك' });
  }
  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget); const pw = String(f.get('pw'));
    if (pw.length < 8) return setMsg({ ok: false, t: 'كلمة المرور يجب ألا تقل عن 8 أحرف' });
    const { error } = await sb.auth.updateUser({ password: pw });
    setMsg(error ? { ok: false, t: 'تعذّر تغيير كلمة المرور، سجّل الدخول من جديد وحاول مجددًا' } : { ok: true, t: 'تم تغيير كلمة المرور' });
    if (!error) e.currentTarget.reset();
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form onSubmit={saveProfile} className="card space-y-3 p-4">
        <h2 className="font-bold">بياناتي</h2>
        <input name="name" defaultValue={fullName} maxLength={100} placeholder="الاسم" className="input" />
        <input name="phone" defaultValue={phone} maxLength={20} placeholder="رقم الجوال (اختياري)" className="input" dir="ltr" inputMode="tel" />
        <button className="btn w-full">حفظ</button>
      </form>
      <form onSubmit={changePassword} className="card space-y-3 p-4">
        <h2 className="font-bold">تغيير كلمة المرور</h2>
        <input name="pw" type="password" minLength={8} required placeholder="كلمة المرور الجديدة" className="input" autoComplete="new-password" dir="ltr" />
        <button className="btn w-full">تغيير</button>
      </form>
      {msg && <p role="status" className={`md:col-span-2 rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.t}</p>}
    </div>
  );
}

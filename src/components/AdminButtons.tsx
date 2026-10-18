'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// زر حذف عام: يستدعي DELETE ثم يحدّث الصفحة
export function DeleteButton({ url, confirmText, label = 'حذف' }: { url: string; confirmText: string; label?: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-50" onClick={async () => {
      if (!confirm(confirmText)) return;
      setBusy(true);
      const r = await fetch(url, { method: 'DELETE' });
      if (!r.ok) alert((await r.json().catch(() => ({}))).error ?? 'تعذّر الحذف');
      setBusy(false); router.refresh();
    }}>{label}</button>
  );
}

export function InventoryAdd({ productId }: { productId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const items = String(new FormData(form).get('items')).split('\n').map((x) => x.trim()).filter(Boolean);
    if (!items.length) return setMsg({ ok: false, t: 'أدخل عنصرًا واحدًا على الأقل' });
    setBusy(true);
    const r = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, items }) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setMsg({ ok: false, t: d.error ?? 'تعذّرت الإضافة' });
    setMsg({ ok: true, t: `تمت إضافة ${d.added} عنصر` }); form.reset(); router.refresh();
  }
  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h2 className="font-bold">إضافة مخزون</h2>
      <textarea name="items" rows={6} dir="ltr" className="input font-mono text-sm" placeholder={'عنصر واحد في كل سطر (كود / حساب / مفتاح)\nحتى 500 سطر'} />
      {msg && <p role="status" className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.t}</p>}
      <button className="btn" disabled={busy}>{busy ? '…' : 'إضافة'}</button>
    </form>
  );
}

export function CategoryAdd() {
  const router = useRouter(); const [err, setErr] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('');
    const form = e.currentTarget; const f = new FormData(form);
    const r = await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: String(f.get('name')).trim(), slug: String(f.get('slug')).trim().toLowerCase() }) });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? 'تعذّرت الإضافة');
    form.reset(); router.refresh();
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input name="name" required maxLength={60} placeholder="اسم التصنيف" className="input w-48" />
      <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="slug-en" dir="ltr" className="input w-48" />
      <button className="btn-ghost">إضافة تصنيف</button>
      {err && <span role="alert" className="text-sm text-red-600">{err}</span>}
    </form>
  );
}

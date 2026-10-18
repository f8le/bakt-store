'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Cat = { id: string; name: string };
type P = { id?: string; name?: string; slug?: string; description?: string | null; image_url?: string | null; price_halalas?: number; compare_at_halalas?: number | null;
  category_id?: string | null; duration?: string | null; product_type?: string; features?: unknown; delivery_instructions?: string | null; is_active?: boolean };

const toHalalas = (v: string): number | null => { const t = v.trim().replace(',', '.'); return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null; };
const toSar = (h?: number | null) => (h == null ? '' : (h / 100).toFixed(2));

export default function ProductForm({ product, categories }: { product?: P; categories: Cat[] }) {
  const router = useRouter();
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const editing = !!product?.id;
  const feats = Array.isArray(product?.features) ? (product!.features as string[]).join('\n') : '';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('');
    const f = new FormData(e.currentTarget);
    const price = toHalalas(String(f.get('price')));
    const cmpRaw = String(f.get('compare')).trim();
    const cmp = cmpRaw ? toHalalas(cmpRaw) : null;
    if (price === null || (cmpRaw && cmp === null)) return setErr('السعر غير صالح (مثال: 25 أو 25.50)');
    const s = (k: string) => String(f.get(k) ?? '').trim() || null;
    const body = {
      name: String(f.get('name')).trim(), slug: String(f.get('slug')).trim().toLowerCase(), description: s('description'), image_url: s('image_url'),
      price_halalas: price, compare_at_halalas: cmp, category_id: s('category_id'), duration: s('duration'), product_type: String(f.get('product_type')),
      features: String(f.get('features')).split('\n').map((x) => x.trim()).filter(Boolean), delivery_instructions: s('delivery_instructions'), is_active: f.get('is_active') === 'on',
    };
    setBusy(true);
    const res = await fetch(editing ? `/api/admin/products/${product!.id}` : '/api/admin/products', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? 'تعذّر الحفظ');
    router.push('/admin/products'); router.refresh();
  }

  return (
    <form onSubmit={submit} className="card grid gap-3 p-4 md:grid-cols-2">
      <label className="space-y-1 text-sm">الاسم<input name="name" required maxLength={120} defaultValue={product?.name} className="input" /></label>
      <label className="space-y-1 text-sm">المعرّف (slug) بالإنجليزية<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} defaultValue={product?.slug} className="input" dir="ltr" placeholder="netflix-1-month" /></label>
      <label className="space-y-1 text-sm">السعر (ر.س)<input name="price" required inputMode="decimal" defaultValue={toSar(product?.price_halalas)} className="input" dir="ltr" /></label>
      <label className="space-y-1 text-sm">السعر السابق (اختياري)<input name="compare" inputMode="decimal" defaultValue={toSar(product?.compare_at_halalas)} className="input" dir="ltr" /></label>
      <label className="space-y-1 text-sm">النوع<select name="product_type" defaultValue={product?.product_type ?? 'code'} className="input">
        <option value="code">كود</option><option value="account">حساب</option><option value="subscription">اشتراك</option><option value="key">مفتاح تفعيل</option></select></label>
      <label className="space-y-1 text-sm">التصنيف<select name="category_id" defaultValue={product?.category_id ?? ''} className="input"><option value="">بدون</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="space-y-1 text-sm">مدة الاشتراك<input name="duration" maxLength={60} defaultValue={product?.duration ?? ''} className="input" placeholder="شهر / سنة" /></label>
      <label className="space-y-1 text-sm">رابط الصورة (https)<input name="image_url" type="url" maxLength={500} defaultValue={product?.image_url ?? ''} className="input" dir="ltr" /></label>
      <label className="space-y-1 text-sm md:col-span-2">الوصف<textarea name="description" rows={3} maxLength={5000} defaultValue={product?.description ?? ''} className="input" /></label>
      <label className="space-y-1 text-sm">المميزات (سطر لكل ميزة، حتى 12)<textarea name="features" rows={4} defaultValue={feats} className="input" /></label>
      <label className="space-y-1 text-sm">تعليمات بعد الشراء (تظهر للمشتري فقط)<textarea name="delivery_instructions" rows={4} maxLength={3000} defaultValue={product?.delivery_instructions ?? ''} className="input" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} /> المنتج نشط (ظاهر للعملاء)</label>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{err}</p>}
      <div className="md:col-span-2"><button className="btn" disabled={busy}>{busy ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'إضافة المنتج'}</button></div>
    </form>
  );
}

'use client';
import { useRef, useState } from 'react';

export default function BuyButton({ productId, slug, inStock }: { productId: string; slug: string; inStock: boolean }) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const idem = useRef(crypto.randomUUID()); // ضغطات متتالية = نفس الطلب

  async function buy() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem.current },
        body: JSON.stringify({ productId, quantity: qty }),
      });
      if (res.status === 401) { window.location.href = `/login?next=${encodeURIComponent(`/products/${slug}`)}`; return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'تعذّر إنشاء الطلب'); setLoading(false); return; }
      idem.current = crypto.randomUUID(); // الشراء التالي طلب جديد
      window.location.href = `/pay/${data.orderId}`;
    } catch { setError('تحقق من اتصالك بالإنترنت وحاول مجددًا'); setLoading(false); }
  }

  if (!inStock) return <button className="btn w-full" disabled>غير متوفر حاليًا</button>;
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 text-sm">الكمية
        <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input w-24 py-2">
          {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
      <button onClick={buy} disabled={loading} className="btn w-full text-lg">{loading ? 'جارٍ إنشاء الطلب…' : 'اشترِ الآن'}</button>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

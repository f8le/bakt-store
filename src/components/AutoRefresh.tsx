'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// يعيد تحميل بيانات الصفحة كل 3 ثوانٍ (حتى دقيقتين) بانتظار تأكيد الـ Webhook
export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => { if (++n > 40) clearInterval(t); else router.refresh(); }, 3000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

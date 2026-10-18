'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  // لا نعرض تفاصيل الخطأ للمستخدم
  return <div className="card mx-auto max-w-md space-y-3 p-8 text-center"><h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1><p className="text-neutral-500">حاول مرة أخرى، وإن استمرت المشكلة تواصل معنا.</p><button className="btn" onClick={reset}>إعادة المحاولة</button></div>;
}

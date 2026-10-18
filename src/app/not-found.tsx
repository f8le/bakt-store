import Link from 'next/link';
export default function NotFound() {
  return <div className="card mx-auto max-w-md space-y-3 p-8 text-center"><h1 className="text-xl font-bold">الصفحة غير موجودة</h1><Link href="/" className="btn">العودة للرئيسية</Link></div>;
}

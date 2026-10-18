import Link from 'next/link';
import { SITE } from '@/lib/site';

const links = [['/faq', 'الأسئلة الشائعة'], ['/contact', 'تواصل معنا'], ['/terms', 'الشروط والأحكام'], ['/privacy', 'سياسة الخصوصية'], ['/refund', 'سياسة الاسترجاع']];

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6 text-sm text-neutral-500">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map(([href, label]) => <Link key={href} href={href} className="hover:text-brand">{label}</Link>)}
        </div>
        <p>© {new Date().getFullYear()} {SITE.nameAr} ({SITE.nameEn}). جميع الحقوق محفوظة. الدفع يتم عبر بوابة دفع مرخّصة ولا نخزّن بيانات بطاقتك.</p>
      </div>
    </footer>
  );
}

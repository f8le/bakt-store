import type { Metadata } from 'next';
import ForgotForm from '@/components/ForgotForm';
export const metadata: Metadata = { title: 'استعادة كلمة المرور', robots: { index: false } };
export default function Page() { return <ForgotForm />; }

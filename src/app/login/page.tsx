import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';
import { safeNext } from '@/lib/safe-next';

export const metadata: Metadata = { title: 'تسجيل الدخول', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={safeNext(next)} />;
}

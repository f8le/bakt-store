import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { INFO } from '@/lib/pages';

type Props = { params: Promise<{ page: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(INFO).map((page) => ({ page }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  const i = INFO[page];
  return i ? { title: i.title, description: i.description, alternates: { canonical: `/${page}` } } : {};
}

export default async function InfoPage({ params }: Props) {
  const { page } = await params;
  const i = Object.hasOwn(INFO, page) ? INFO[page] : undefined;
  if (!i) notFound();
  return (
    <article className="card mx-auto max-w-2xl space-y-3 p-6 leading-8">
      <h1 className="text-2xl font-bold">{i.title}</h1>
      {i.body.map((b, k) => typeof b === 'string' ? <p key={k} className="text-neutral-700">{b}</p> : <h2 key={k} className="pt-2 text-lg font-bold">{b.h}</h2>)}
    </article>
  );
}

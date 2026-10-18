'use client';
import { useState } from 'react';

export default function SecretReveal({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg bg-neutral-100 px-3 py-2 text-sm">{shown ? value : '••••••••••••••••'}</code>
      <button className="btn-ghost" onClick={() => setShown((s) => !s)}>{shown ? 'إخفاء' : 'إظهار'}</button>
      <button className="btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>{copied ? 'تم النسخ' : 'نسخ'}</button>
    </div>
  );
}

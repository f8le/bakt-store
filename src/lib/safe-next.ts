// يمنع Open Redirect: لا يقبل إلا مسارًا داخليًا
export function safeNext(v: string | null | undefined, fallback = '/account'): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\r\n\\]/.test(v)) return fallback;
  return v;
}

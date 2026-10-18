import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './auth';

// معالج أخطاء موحّد: رسائل عربية عامة، بلا Stack Traces أو تفاصيل داخلية
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError) return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
    console.error('api_error', e instanceof Error ? e.name : 'unknown'); // لا نسجل الرسالة الكاملة
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}

export const noStore = { 'Cache-Control': 'no-store' };

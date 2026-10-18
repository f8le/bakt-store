import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { CategoryInput } from '@/lib/schemas';
import { createCategory } from '@/lib/admin-actions';

export const POST = (req: Request) => handle(async () => {
  const me = await requireAdmin();
  await createCategory(me, CategoryInput.parse(await req.json()));
  return NextResponse.json({ ok: true }, { status: 201 });
});

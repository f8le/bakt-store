import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { ProductInput } from '@/lib/schemas';
import { createProduct } from '@/lib/admin-actions';

export const POST = (req: Request) => handle(async () => {
  const me = await requireAdmin();
  const id = await createProduct(me, ProductInput.parse(await req.json()));
  return NextResponse.json({ ok: true, id }, { status: 201 });
});

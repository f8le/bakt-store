import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth';
import { UUID_RE } from '@/lib/format';
import { ProductPatch } from '@/lib/schemas';
import { deleteProduct, updateProduct } from '@/lib/admin-actions';

type Ctx = { params: Promise<{ id: string }> };
const getId = async (c: Ctx) => { const { id } = await c.params; if (!UUID_RE.test(id)) throw new HttpError(400, 'معرّف غير صالح'); return id; };

export const PATCH = (req: Request, c: Ctx) => handle(async () => {
  const me = await requireAdmin();
  await updateProduct(me, await getId(c), ProductPatch.parse(await req.json()));
  return NextResponse.json({ ok: true });
});
export const DELETE = (_: Request, c: Ctx) => handle(async () => {
  const me = await requireAdmin();
  await deleteProduct(me, await getId(c));
  return NextResponse.json({ ok: true });
});

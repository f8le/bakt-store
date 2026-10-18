import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth';
import { UUID_RE } from '@/lib/format';
import { deleteInventoryItem } from '@/lib/admin-actions';

export const DELETE = (_: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  const me = await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) throw new HttpError(400, 'معرّف غير صالح');
  await deleteInventoryItem(me, id);
  return NextResponse.json({ ok: true });
});

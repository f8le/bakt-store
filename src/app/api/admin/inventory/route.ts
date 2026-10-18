import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { InventoryAdd } from '@/lib/schemas';
import { addInventory } from '@/lib/admin-actions';

export const POST = (req: Request) => handle(async () => {
  const me = await requireAdmin();
  const { productId, items } = InventoryAdd.parse(await req.json());
  return NextResponse.json({ ok: true, added: await addInventory(me, productId, items) });
});

import 'server-only';
import { admin } from './supabase/admin';

export async function audit(actorId: string | null, action: string, entity: string, entityId: string, meta: Record<string, unknown> = {}) {
  // ممنوع تمرير كلمات مرور أو أسرار أو أكواد المخزون في meta
  await admin().from('audit_logs').insert({ actor_id: actorId, action, entity, entity_id: entityId, meta });
}

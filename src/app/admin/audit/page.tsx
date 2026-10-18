import { listAudit, requireAdminPage } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';
export default async function AuditPage() {
  await requireAdminPage('/admin/audit');
  const logs = await listAudit();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">سجل الأحداث الأمنية</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" dir="ltr">
          <thead className="bg-neutral-50 text-neutral-500"><tr><th className="p-3 text-left">Time</th><th className="text-left">Action</th><th className="text-left">Entity</th><th className="text-left">Details</th></tr></thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id}><td className="whitespace-nowrap p-3">{new Date(l.created_at).toLocaleString('en-GB')}</td><td className="font-medium">{l.action}</td>
                <td>{l.entity} {String(l.entity_id ?? '').slice(0, 8)}</td><td className="text-xs text-neutral-500">{JSON.stringify(l.meta)}</td></tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-neutral-500">لا أحداث.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

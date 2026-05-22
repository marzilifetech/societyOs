'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/ErrorState';

interface AuditEntry {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');

  const { data, isLoading, isError, refetch } = useQuery<AuditPage>({
    queryKey: ['admin-audit-logs', page, actor, action, resource],
    queryFn: () =>
      api.get<AuditPage>(
        `/admin/audit-logs?page=${page}&pageSize=50` +
          (actor ? `&actor=${encodeURIComponent(actor)}` : '') +
          (action ? `&action=${encodeURIComponent(action)}` : '') +
          (resource ? `&resource=${encodeURIComponent(resource)}` : ''),
      ),
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500">
          Immutable record of administrative actions across the system.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          aria-label="Filter by actor"
          placeholder="Actor (user id or name)"
          value={actor}
          onChange={(e) => {
            setActor(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <input
          aria-label="Filter by action"
          placeholder="Action (e.g. login, delete_user)"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <input
          aria-label="Filter by resource"
          placeholder="Resource (e.g. resident, payment)"
          value={resource}
          onChange={(e) => {
            setResource(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-gray-400">
          Loading…
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Audit log couldn't be loaded. Please try again." />
      ) : !data?.items?.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
          <ScrollText className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">No audit events</p>
          <p className="text-xs text-gray-400 mt-1">
            {actor || action || resource ? 'Try clearing filters to see more results' : 'Administrative actions will be recorded here'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Resource</th>
                <th className="text-left px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {e.actorName ?? e.actorId}
                  </td>
                  <td className="px-4 py-3">
                    <code className="bg-gray-100 rounded px-2 py-0.5 text-xs">{e.action}</code>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {e.resource}
                    {e.resourceId ? <span className="text-gray-400"> / {e.resourceId}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {data?.page ?? page} of {data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1}
        </span>
        <button
          disabled={!data || data.items.length < data.pageSize}
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wrench, AlertTriangle, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type Incident = {
  id: string;
  itemId: string;
  title?: string;
  description: string;
  severity?: string;
  status?: string;
  reportedAt?: string;
  resolvedAt?: string;
  createdAt?: string;
};

type InfraItem = {
  id: string;
  name: string;
  category: string;
  status: string;
  location?: string;
  lastMaintenanceAt?: string;
  incidents?: Incident[];
};

export default function InfrastructurePage() {
  const qc = useQueryClient();
  const [showIncidentForm, setShowIncidentForm] = useState<string | null>(null);
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', severity: 'MEDIUM' });
  const [activeTab, setActiveTab] = useState<'items' | 'incidents'>('items');

  const { data: items, isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useQuery<InfraItem[]>({
    queryKey: ['infrastructure-items'],
    queryFn: () => api.get<InfraItem[]>('/infrastructure/status'),
  });

  const incidents: Incident[] | undefined = items?.flatMap((it) => it.incidents ?? []);
  const incidentsLoading = itemsLoading;
  const incidentsError = itemsError;
  const refetchIncidents = refetchItems;

  const reportMutation = useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: { title: string; description: string; severity: string } }) =>
      api.post('/infrastructure/report', { itemId, ...body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['infrastructure-items'] });
      toast.success('Incident reported');
      setShowIncidentForm(null);
      setIncidentForm({ title: '', description: '', severity: 'MEDIUM' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/infrastructure/incidents/${id}/resolve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['infrastructure-items'] });
      toast.success('Incident resolved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openIncidents = incidents?.filter((i) => !i.resolvedAt && i.status !== 'RESOLVED') ?? [];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Infrastructure</h1>
        <p className="text-gray-500 text-sm mt-1">{items?.length ?? 0} items · {openIncidents.length} open incidents</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['items', 'incidents'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              activeTab === t ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {t === 'items' ? `Infrastructure (${items?.length ?? 0})` : `Incidents (${incidents?.length ?? 0})`}
          </button>
        ))}
      </div>

      {activeTab === 'items' && !itemsLoading && !itemsError && !items?.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
          <Wrench className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">No infrastructure items yet</p>
          <p className="text-xs text-gray-400 mt-1">Items like lifts, gates, and meters will appear here once added</p>
        </div>
      ) : null}

      {activeTab === 'items' && (itemsLoading || itemsError || (items && items.length > 0)) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Category</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Location</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {itemsLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">Loading…</td></tr>
              ) : itemsError ? (
                <tr><td colSpan={5} className="px-6 py-12"><ErrorState onRetry={refetchItems} message="Infrastructure information couldn't be loaded. Your data is safe — please try again." /></td></tr>
              ) : (
                items!.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.location ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'text-xs font-medium px-2.5 py-1 rounded-full',
                        item.status === 'OPERATIONAL' ? 'bg-green-100 text-green-700' :
                        item.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700',
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {showIncidentForm === item.id ? (
                        <div className="space-y-2 min-w-[240px]">
                          <input
                            value={incidentForm.title}
                            onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })}
                            placeholder="Incident title"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary-400"
                          />
                          <textarea
                            value={incidentForm.description}
                            onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                            placeholder="Description"
                            rows={2}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary-400 resize-none"
                          />
                          <select
                            value={incidentForm.severity}
                            onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                          </select>
                          <div className="flex gap-1">
                            <button onClick={() => setShowIncidentForm(null)} className="text-xs text-gray-500">Cancel</button>
                            <button
                              onClick={() => reportMutation.mutate({ itemId: item.id, body: { ...incidentForm, title: incidentForm.title.trim(), description: incidentForm.description.trim() } })}
                              disabled={reportMutation.isPending || !incidentForm.title.trim()}
                              className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg disabled:opacity-50"
                            >
                              Report
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowIncidentForm(item.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Report Incident
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="space-y-3">
          {incidentsLoading && <div className="py-16 text-center text-gray-400">Loading…</div>}
          {!incidentsLoading && incidentsError && <ErrorState onRetry={refetchIncidents} message="Incidents couldn't be loaded. Please try again." />}
          {!incidentsLoading && !incidentsError && incidents?.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
              <AlertTriangle className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">No incidents reported</p>
              <p className="text-xs text-gray-400 mt-1">Reported issues with infrastructure will appear here</p>
            </div>
          )}
          {incidents?.map((incident) => (
            <div key={incident.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full',
                      incident.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                      incident.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      incident.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700',
                    )}>
                      {incident.severity}
                    </span>
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full',
                      incident.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                    )}>
                      {incident.status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{incident.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{incident.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Reported {new Date(incident.reportedAt ?? incident.createdAt ?? Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {incident.resolvedAt && ` · Resolved ${new Date(incident.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                {incident.status !== 'RESOLVED' && (
                  <button
                    onClick={() => resolveMutation.mutate(incident.id)}
                    disabled={resolveMutation.isPending}
                    className="ml-4 shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

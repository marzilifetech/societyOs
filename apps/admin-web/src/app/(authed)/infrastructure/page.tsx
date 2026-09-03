'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wrench, AlertTriangle, Check, Plus, Upload, Download, X } from 'lucide-react';
import { api, downloadAdminFile } from '@/lib/api';
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
  type: string;
  status: string;
  incidents?: Incident[];
};

const INFRA_TYPES = ['LIFT', 'POWER', 'WATER', 'GENERATOR', 'WIFI'] as const;
const INFRA_STATUSES = ['OPERATIONAL', 'MAINTENANCE', 'FAULT'] as const;

export default function InfrastructurePage() {
  const qc = useQueryClient();
  const [showIncidentForm, setShowIncidentForm] = useState<string | null>(null);
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', severity: 'MEDIUM' });
  const [activeTab, setActiveTab] = useState<'items' | 'incidents'>('items');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', type: 'LIFT', status: 'OPERATIONAL' });
  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [preview, setPreview] = useState<any>(null);

  const { data: items, isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useQuery<InfraItem[]>({
    queryKey: ['infrastructure-items'],
    queryFn: () => api.get<InfraItem[]>('/infrastructure/status'),
  });

  const incidents: Incident[] | undefined = items?.flatMap((it) => it.incidents ?? []);
  const incidentsLoading = itemsLoading;
  const incidentsError = itemsError;
  const refetchIncidents = refetchItems;

  const reportMutation = useMutation({
    // `title` and `severity` are now declared on the DTO. The global
    // ValidationPipe runs with forbidNonWhitelisted, so sending them at an API
    // that did not declare them 400'd every submission.
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
    // `resolution` is optional server-side now; it used to be required, so this
    // empty body came back 400 and Resolve did nothing.
    mutationFn: ({ id, resolution }: { id: string; resolution?: string }) =>
      api.patch(`/infrastructure/incidents/${id}/resolve`, resolution ? { resolution } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['infrastructure-items'] });
      toast.success('Incident resolved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post('/admin/infrastructure', { ...addForm, name: addForm.name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['infrastructure-items'] });
      toast.success('Item added');
      setShowAdd(false);
      setAddForm({ name: '', type: 'LIFT', status: 'OPERATIONAL' });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to add'),
  });

  const previewMutation = useMutation({
    mutationFn: (csv: string) => api.post('/admin/infrastructure/import/preview', { csv }),
    onSuccess: (data) => setPreview(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: (csv: string) =>
      api.post<{ created: number; skipped: number; errors: { row: number; reason: string }[] }>(
        '/admin/infrastructure/import',
        { csv },
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['infrastructure-items'] });
      setShowImport(false);
      setImportCsv('');
      setPreview(null);
      toast.success(`Imported ${data.created} items (${data.skipped} skipped)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const csv = String(reader.result ?? '');
      setImportCsv(csv);
      previewMutation.mutate(csv);
    };
    reader.readAsText(file);
  };

  const openIncidents = incidents?.filter((i) => !i.resolvedAt && i.status !== 'RESOLVED') ?? [];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Infrastructure</h1>
          <p className="text-gray-500 text-sm mt-1">{items?.length ?? 0} items · {openIncidents.length} open incidents</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadAdminFile('/admin/infrastructure/import/template', 'infrastructure-import-template.csv').catch((e: Error) => toast.error(e.message))}
            className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 rounded-xl text-sm"
          >
            <Download className="w-4 h-4" /> Template
          </button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 rounded-xl text-sm">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
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
          <p className="text-xs text-gray-400 mt-1 mb-4">Add items one by one, or bulk upload a CSV</p>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 rounded-xl text-sm">
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'items' && (itemsLoading || itemsError || (items && items.length > 0)) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {itemsLoading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">Loading…</td></tr>
              ) : itemsError ? (
                <tr><td colSpan={4} className="px-6 py-12"><ErrorState onRetry={refetchItems} message="Infrastructure information couldn't be loaded. Your data is safe — please try again." /></td></tr>
              ) : (
                items!.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.type}</td>
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
                  <h3 className="font-semibold text-gray-900">
                    {incident.title || incident.description?.slice(0, 60) || 'Incident'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{incident.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Reported {new Date(incident.reportedAt ?? incident.createdAt ?? Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {incident.resolvedAt && ` · Resolved ${new Date(incident.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                {incident.status !== 'RESOLVED' && (
                  <button
                    onClick={() => {
                      const note = window.prompt('Resolution note (optional)') ?? undefined;
                      resolveMutation.mutate({ id: incident.id, resolution: note?.trim() || undefined });
                    }}
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

      {/* Add item modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Add Infrastructure Item</h2>
              <button aria-label="Close" onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="e.g. Main Lift, Borewell Pump"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type *</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
                  value={addForm.type}
                  onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {INFRA_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
                  value={addForm.status}
                  onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {INFRA_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="text-gray-500 text-sm px-4 py-2">Cancel</button>
              <button
                disabled={!addForm.name.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate()}
                className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {addMutation.isPending ? 'Adding…' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Import infrastructure CSV</h2>
              <button aria-label="Close" onClick={() => { setShowImport(false); setPreview(null); setImportCsv(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500">
              Columns: <code className="bg-gray-100 px-1 rounded">name, type, status</code>. Type: {INFRA_TYPES.join(', ')}. Status optional (defaults to Operational).
            </p>
            <button
              type="button"
              onClick={() => downloadAdminFile('/admin/infrastructure/import/template', 'infrastructure-import-template.csv').catch((e: Error) => toast.error(e.message))}
              className="text-xs text-primary-600 inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Download template
            </button>
            <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            {preview && (
              <div className="text-xs bg-gray-50 rounded-xl p-3 max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Preview: {preview.valid?.length ?? 0} valid, {preview.errors?.length ?? 0} errors</p>
                {preview.errors?.map((e: any) => (
                  <p key={e.row} className="text-red-600">Row {e.row}: {e.reason}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                disabled={!importCsv || importMutation.isPending}
                onClick={() => importMutation.mutate(importCsv)}
                className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
              >
                {importMutation.isPending ? 'Importing…' : 'Import'}
              </button>
              <button onClick={() => { setShowImport(false); setPreview(null); setImportCsv(''); }} className="text-gray-500 text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

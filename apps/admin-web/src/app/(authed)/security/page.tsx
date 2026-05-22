'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type Incident = {
  id: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  location?: string;
  resolvedAt?: string;
  resolvedNote?: string;
  createdAt: string;
  reportedBy?: { user?: { name?: string }; flat?: { flatNumber?: string } };
};

type PatrolRound = {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMin?: number;
  notes?: string;
  staff?: { name: string; designation?: string };
};

type Tab = 'incidents' | 'rounds';
type SeverityFilter = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  MEDIUM: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-700' },
};

const INCIDENT_STATUS_META: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'bg-amber-100 text-amber-700' },
  INVESTIGATING: { label: 'Investigating', color: 'bg-blue-100 text-blue-700' },
  RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
};

const ROUND_STATUS_META: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  ABANDONED: { label: 'Abandoned', color: 'bg-red-100 text-red-700' },
};

const SEVERITY_FILTERS: SeverityFilter[] = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function IncidentRow({
  incident,
  onMarkInvestigating,
  onResolve,
}: {
  incident: Incident;
  onMarkInvestigating: (id: string) => void;
  onResolve: (id: string, note: string) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');
  const sevMeta = SEVERITY_META[incident.severity] ?? { label: incident.severity, color: 'bg-gray-100 text-gray-600' };
  const statusMeta = INCIDENT_STATUS_META[incident.status] ?? { label: incident.status, color: 'bg-gray-100 text-gray-600' };

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-sm text-gray-900">{incident.reportedBy?.user?.name ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{incident.reportedBy?.flat?.flatNumber ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{incident.type}</td>
        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{incident.description}</td>
        <td className="px-4 py-3">
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', sevMeta.color)}>{sevMeta.label}</span>
        </td>
        <td className="px-4 py-3">
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', statusMeta.color)}>{statusMeta.label}</span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{incident.location ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
          {new Date(incident.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2 items-center">
            {incident.status === 'OPEN' && (
              <button
                onClick={() => onMarkInvestigating(incident.id)}
                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Mark Investigating
              </button>
            )}
            {(incident.status === 'OPEN' || incident.status === 'INVESTIGATING') && (
              <button
                onClick={() => setResolving((v) => !v)}
                className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Resolve
              </button>
            )}
          </div>
        </td>
      </tr>
      {resolving && (
        <tr>
          <td colSpan={9} className="px-4 pb-3 bg-green-50 border-b border-green-100">
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Resolution note (optional)"
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400 flex-1 max-w-sm"
              />
              <button
                onClick={() => {
                  onResolve(incident.id, note);
                  setResolving(false);
                  setNote('');
                }}
                className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Confirm Resolved
              </button>
              <button
                onClick={() => setResolving(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SecurityPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('incidents');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [roundDate, setRoundDate] = useState('');

  const {
    data: incidents,
    isLoading: incidentsLoading,
    isError: incidentsError,
    refetch: refetchIncidents,
  } = useQuery({
    queryKey: ['admin-incidents', severityFilter],
    queryFn: () =>
      api.get<Incident[]>(`/security/incidents${severityFilter !== 'ALL' ? `?severity=${severityFilter}` : ''}`),
    enabled: activeTab === 'incidents',
  });

  const {
    data: rounds,
    isLoading: roundsLoading,
    isError: roundsError,
    refetch: refetchRounds,
  } = useQuery({
    queryKey: ['admin-patrol-rounds', roundDate],
    queryFn: () => api.get<PatrolRound[]>(`/security/rounds${roundDate ? `?date=${roundDate}` : ''}`),
    enabled: activeTab === 'rounds',
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, resolvedNote }: { id: string; status: string; resolvedNote?: string }) =>
      api.patch(`/security/incidents/${id}`, { status, ...(resolvedNote ? { resolvedNote } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-incidents'] });
      toast.success('Incident status updated.');
    },
    onError: (err: Error & { code?: string }) => {
      toast.error(err.code ? `${err.message} (${err.code})` : err.message);
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>
        <p className="text-gray-500 text-sm mt-1">Incidents and patrol rounds</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(['incidents', 'rounds'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab === 'incidents' ? 'Incidents' : 'Patrol Rounds'}
          </button>
        ))}
      </div>

      {activeTab === 'incidents' && (
        <>
          {/* Severity filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setSeverityFilter(f)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  severityFilter === f
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                )}
              >
                {f === 'ALL' ? 'All' : SEVERITY_META[f]?.label ?? f}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            {incidentsLoading ? (
              <div className="py-16 text-center text-gray-400">Loading…</div>
            ) : incidentsError ? (
              <ErrorState onRetry={refetchIncidents} message="Incidents couldn't be loaded. Your data is safe — please try again." />
            ) : !incidents?.length ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <Shield className="w-10 h-10 text-gray-300 mb-3" />
                <p className="font-medium text-gray-700">No incidents reported</p>
                <p className="text-sm text-gray-400 mt-1">Reported security incidents will appear here.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Reported By', 'Flat', 'Type', 'Description', 'Severity', 'Status', 'Location', 'Date', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {incidents.map((incident) => (
                    <IncidentRow
                      key={incident.id}
                      incident={incident}
                      onMarkInvestigating={(id) => statusMutation.mutate({ id, status: 'INVESTIGATING' })}
                      onResolve={(id, note) => statusMutation.mutate({ id, status: 'RESOLVED', resolvedNote: note || undefined })}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === 'rounds' && (
        <>
          {/* Date filter */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={roundDate}
              onChange={(e) => setRoundDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-primary-400"
            />
            {roundDate && (
              <button
                onClick={() => setRoundDate('')}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            {roundsLoading ? (
              <div className="py-16 text-center text-gray-400">Loading…</div>
            ) : roundsError ? (
              <ErrorState onRetry={refetchRounds} message="Patrol rounds couldn't be loaded. Your data is safe — please try again." />
            ) : !rounds?.length ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
                <p className="font-medium text-gray-700">No patrol rounds</p>
                <p className="text-sm text-gray-400 mt-1">Patrol rounds for the selected date will appear here.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Staff', 'Start Time', 'End Time', 'Duration (min)', 'Status', 'Notes'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rounds.map((round) => {
                    const statusMeta = ROUND_STATUS_META[round.status] ?? { label: round.status, color: 'bg-gray-100 text-gray-600' };
                    return (
                      <tr key={round.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{round.staff?.name ?? '—'}</p>
                          {round.staff?.designation && (
                            <p className="text-xs text-gray-400">{round.staff.designation}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(round.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {round.completedAt
                            ? new Date(round.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {round.durationMin != null ? round.durationMin : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', statusMeta.color)}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{round.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

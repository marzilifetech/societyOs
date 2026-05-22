'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, AlertCircle, AlertTriangle, Siren } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-red-100 text-red-700',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

interface SosLogEntry {
  id: string;
  residentName: string;
  flat: string;
  alertTime: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  rating?: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export default function MedicalSosPage() {
  const { data: sosLog, isLoading, isError, refetch } = useQuery({
    queryKey: ['sos-log'],
    queryFn: () => api.get<SosLogEntry[]>('/medical/admin/sos/log'),
    refetchInterval: 30_000,
  });

  const avgResolution = sosLog
    ? sosLog
        .filter((s) => s.resolvedAt && s.alertTime)
        .reduce((acc, s, _, arr) => {
          const mins = (new Date(s.resolvedAt!).getTime() - new Date(s.alertTime).getTime()) / 60000;
          return acc + mins / arr.length;
        }, 0)
    : null;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SOS Alert Log</h1>
          <p className="text-gray-500 text-sm mt-1">Medical emergency timeline</p>
        </div>
        {/* TODO: re-enable once a /admin/sos/responders config screen exists. */}
      </div>

      {avgResolution !== null && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 inline-flex items-center gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Response Time</p>
            <p className="text-2xl font-bold text-gray-900">{avgResolution.toFixed(1)} min</p>
          </div>
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', avgResolution <= 5 ? 'bg-green-100 text-green-600' : avgResolution <= 10 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600')}>
            {avgResolution <= 5 ? <Check className="w-5 h-5" /> : avgResolution <= 10 ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="SOS alerts couldn't be loaded. Your data is safe — please try again." />
        ) : !sosLog?.length ? (
          <div className="py-16 text-center">
            <Siren className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">No SOS alerts</p>
            <p className="text-sm text-gray-400 mt-1">All quiet over the last 24h.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Resident', 'Flat', 'Alert Time', 'Acknowledged By', 'Resolution Time', 'Rating', 'Status'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sosLog.map((log) => {
                const resolutionMins = log.resolvedAt && log.alertTime
                  ? ((new Date(log.resolvedAt).getTime() - new Date(log.alertTime).getTime()) / 60000).toFixed(1)
                  : null;
                return (
                  <tr key={log.id} className={cn('hover:bg-gray-50', log.status === 'ACTIVE' && 'border-l-4 border-red-400')}>
                    <td className="px-5 py-3 font-medium text-gray-900">{log.residentName}</td>
                    <td className="px-5 py-3 text-gray-600">{log.flat}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(log.alertTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{log.acknowledgedBy ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{resolutionMins ? `${resolutionMins} min` : '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{log.rating != null ? `${log.rating}/5` : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', STATUS_BADGE[log.status] ?? 'bg-gray-100 text-gray-500')}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

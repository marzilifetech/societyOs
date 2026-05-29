'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import { ShieldCheck, AlertTriangle, Plus } from 'lucide-react';

interface EmergencyContact {
  id: string;
  label: string;
  phone: string;
}

interface SosRecipient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role?: string;
}

interface SocietyResponse {
  id: string;
  config: Record<string, unknown> | null;
}

const CONTACT_LABELS = ['Medical', 'Security', 'Admin', 'Police', 'Fire'];

type BroadcastSeverity = 'INFO' | 'WARNING' | 'EMERGENCY';

const SEVERITY_STYLES: Record<BroadcastSeverity, string> = {
  INFO: 'bg-blue-50 border-blue-200 text-blue-800',
  WARNING: 'bg-orange-50 border-orange-200 text-orange-800',
  EMERGENCY: 'bg-red-50 border-red-200 text-red-800',
};

const SEVERITY_BADGE: Record<BroadcastSeverity, string> = {
  INFO: 'bg-blue-100 text-blue-700',
  WARNING: 'bg-orange-100 text-orange-700',
  EMERGENCY: 'bg-red-100 text-red-700',
};

export default function SosPage() {
  const qc = useQueryClient();

  const [broadcastForm, setBroadcastForm] = useState<{ title: string; message: string; severity: BroadcastSeverity }>({
    title: '',
    message: '',
    severity: 'INFO',
  });
  const [broadcastConfirm, setBroadcastConfirm] = useState(false);

  const { data: active, isLoading, isError, refetch } = useQuery({
    queryKey: ['active-sos'],
    queryFn: () => api.get<any[]>('/sos/active'),
    // Backend `sos` throttler bucket = 5 req/min; 10s polling hit 429 in ~50s.
    // 15s gives 4 req/min, leaving room for one ack/resolve PATCH per minute.
    refetchInterval: 15_000,
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/sos/${id}/acknowledge`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-sos'] });
      toast.success('Alert acknowledged');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to acknowledge alert'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/sos/${id}/resolve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-sos'] });
      toast.success('Alert resolved');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to resolve alert'),
  });

  function confirmResolve(id: string) {
    if (window.confirm('Mark this SOS alert as resolved?')) resolveMutation.mutate(id);
  }

  const { data: recentBroadcasts } = useQuery({
    queryKey: ['emergency-broadcasts'],
    queryFn: () => api.get<any[]>('/notices/broadcasts'),
  });

  const broadcastMutation = useMutation({
    mutationFn: () => api.post('/notices/broadcast', {
      ...broadcastForm,
      title: broadcastForm.title.trim(),
      message: broadcastForm.message.trim(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency-broadcasts'] });
      setBroadcastForm({ title: '', message: '', severity: 'INFO' });
      setBroadcastConfirm(false);
      toast.success('Broadcast sent');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to send broadcast'),
  });

  // Emergency contacts (persisted in society.config.emergencyContacts)
  const { data: society } = useQuery({
    queryKey: ['society-info'],
    queryFn: () => api.get<SocietyResponse>('/admin/society'),
    retry: false,
  });

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactDraft, setContactDraft] = useState<{ label: string; phone: string }>({ label: 'Medical', phone: '' });
  const [contactsSaved, setContactsSaved] = useState(false);

  useEffect(() => {
    if (!society?.config) return;
    const cfg = society.config as Record<string, unknown>;
    const raw = Array.isArray(cfg.emergencyContacts) ? (cfg.emergencyContacts as EmergencyContact[]) : [];
    setContacts(
      raw
        .filter((c) => c && typeof c.phone === 'string' && typeof c.label === 'string')
        .map((c, idx) => ({
          id: c.id ?? `c-${idx}-${c.phone}`,
          label: c.label,
          phone: c.phone,
        })),
    );
  }, [society]);

  const contactsMutation = useMutation({
    mutationFn: (next: EmergencyContact[]) =>
      api.patch('/admin/society', { config: { emergencyContacts: next } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['society-info'] });
      setContactsSaved(true);
      toast.success('Emergency contacts saved');
      setTimeout(() => setContactsSaved(false), 2000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function addContact() {
    const label = contactDraft.label.trim();
    const phone = contactDraft.phone.trim();
    if (!label || !phone) {
      toast.error('Label and phone are both required');
      return;
    }
    if (!/^\+?[\d\s\-]{6,20}$/.test(phone)) {
      toast.error('Enter a valid phone number');
      return;
    }
    const next = [
      ...contacts,
      { id: `c-${Date.now()}`, label, phone },
    ];
    setContacts(next);
    setContactDraft({ label: 'Medical', phone: '' });
  }

  function removeContact(id: string) {
    if (!window.confirm('Remove this emergency contact? Remember to click Save Contacts after.')) return;
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  // SOS Recipients
  const { data: sosRecipients, refetch: refetchRecipients } = useQuery({
    queryKey: ['sos-recipients'],
    queryFn: () => api.get<SosRecipient[]>('/admin/sos/recipients'),
  });

  const [recipientDraft, setRecipientDraft] = useState<{ name: string; phone: string; email: string; role: string }>({
    name: '', phone: '', email: '', role: '',
  });
  const [showAddRecipient, setShowAddRecipient] = useState(false);

  const addRecipientMutation = useMutation({
    mutationFn: () => api.post('/admin/sos/recipients', {
      name: recipientDraft.name,
      phone: recipientDraft.phone,
      email: recipientDraft.email || undefined,
      role: recipientDraft.role || undefined,
    }),
    onSuccess: () => {
      refetchRecipients();
      setRecipientDraft({ name: '', phone: '', email: '', role: '' });
      setShowAddRecipient(false);
      toast.success('Recipient added');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to add recipient'),
  });

  const removeRecipientMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/sos/recipients/${id}`),
    onSuccess: () => {
      refetchRecipients();
      toast.success('Recipient removed');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to remove recipient'),
  });

  function confirmRemoveRecipient(id: string, name: string) {
    if (window.confirm(`Remove ${name} from SOS recipients?`)) {
      removeRecipientMutation.mutate(id);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">SOS Alerts</h1>
        {(active?.length ?? 0) > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
            {active!.length} ACTIVE
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-400">Loading…</div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="SOS alerts couldn't be loaded. Your data is safe — please try again." />
      ) : (active?.length ?? 0) === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 flex flex-col items-center text-center">
          <ShieldCheck className="w-12 h-12 text-green-500 mb-3" />
          <p className="text-gray-700 font-medium">No active SOS alerts</p>
          <p className="text-gray-400 text-sm mt-1">Page refreshes automatically every 10 seconds</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active!.map((alert) => (
            <div key={alert.id} className="bg-white border-2 border-red-400 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="font-bold text-red-600">EMERGENCY ALERT</span>
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-0.5 rounded-full',
                      alert.status === 'ACTIVE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                    )}>
                      {alert.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">
                    Triggered {new Date(alert.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                {alert.responseTimeSecs && (
                  <span className="text-xs text-gray-400">
                    Response: {alert.responseTimeSecs}s
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400">Triggered by</p>
                  <p className="text-sm font-medium text-gray-900">{alert.resident?.name ?? '—'}</p>
                  {alert.resident?.role === 'STAFF' || alert.resident?.staffMember ? (
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      Staff
                    </span>
                  ) : (
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      Resident
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400">Flat</p>
                  <p className="text-sm font-medium text-gray-900">
                    {alert.resident?.resident?.flat
                      ? `${alert.resident.resident.flat.block}-${alert.resident.resident.flat.number}`
                      : alert.resident?.unit?.flatNumber ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{alert.resident?.phone ?? '—'}</p>
                </div>
              </div>

              {!!alert.note && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs font-semibold text-amber-900 mb-1">Note from sender</p>
                  <p className="text-sm text-amber-950 whitespace-pre-wrap">{alert.note}</p>
                </div>
              )}

              {(alert.lat || alert.lng) && (
                <div className="bg-gray-50 rounded-xl px-4 py-2 mb-4">
                  <p className="text-xs text-gray-500">Location: {alert.lat?.toFixed(6)}, {alert.lng?.toFixed(6)}</p>
                </div>
              )}

              <div className="flex gap-3">
                {alert.status === 'ACTIVE' && (
                  <button
                    className="flex-1 bg-amber-500 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-amber-600 transition-colors"
                    onClick={() => ackMutation.mutate(alert.id)}
                  >
                    Acknowledge
                  </button>
                )}
                <button
                  className="flex-1 bg-green-500 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
                  disabled={resolveMutation.isPending}
                  onClick={() => confirmResolve(alert.id)}
                >
                  {resolveMutation.isPending ? 'Resolving…' : 'Resolve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emergency Broadcast */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Emergency Broadcast</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Severity</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              value={broadcastForm.severity}
              onChange={(e) => setBroadcastForm((f) => ({ ...f, severity: e.target.value as BroadcastSeverity }))}
            >
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              placeholder="e.g. Water supply disruption"
              value={broadcastForm.title}
              onChange={(e) => setBroadcastForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Message</label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400 resize-none"
              placeholder="Describe the situation…"
              value={broadcastForm.message}
              onChange={(e) => setBroadcastForm((f) => ({ ...f, message: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              className={cn(
                'px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-colors',
                broadcastForm.severity === 'EMERGENCY'
                  ? 'bg-red-500 hover:bg-red-600'
                  : broadcastForm.severity === 'WARNING'
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : 'bg-blue-500 hover:bg-blue-600',
              )}
              disabled={!broadcastForm.title.trim() || !broadcastForm.message.trim()}
              onClick={() => setBroadcastConfirm(true)}
            >
              Send Broadcast
            </button>
          </div>
        </div>

        {/* Confirmation dialog */}
        {broadcastConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
              <h3 className="font-bold text-gray-900 mb-2">Send Emergency Broadcast?</h3>
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">{broadcastForm.title}</span>
              </p>
              <p className="text-sm text-gray-500 mb-4">{broadcastForm.message}</p>
              <div className={cn('text-xs font-medium px-2.5 py-1 rounded-full inline-block mb-4', SEVERITY_BADGE[broadcastForm.severity])}>
                {broadcastForm.severity}
              </div>
              <p className="text-xs text-gray-400 mb-4">This will notify all residents via push notification.</p>
              <div className="flex gap-3">
                <button
                  className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-200 transition-colors"
                  onClick={() => setBroadcastConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className={cn(
                    'flex-1 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40 transition-colors',
                    broadcastForm.severity === 'EMERGENCY'
                      ? 'bg-red-500 hover:bg-red-600'
                      : broadcastForm.severity === 'WARNING'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-blue-500 hover:bg-blue-600',
                  )}
                  disabled={broadcastMutation.isPending}
                  onClick={() => broadcastMutation.mutate()}
                >
                  {broadcastMutation.isPending ? 'Sending…' : 'Confirm Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent broadcasts */}
        {(recentBroadcasts?.length ?? 0) > 0 && (
          <div className="mt-6">
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Recent broadcasts</p>
            <div className="space-y-2">
              {recentBroadcasts!.map((b) => (
                <div
                  key={b.id}
                  className={cn('border rounded-xl px-4 py-3 text-sm', b.isPinned ? SEVERITY_STYLES['EMERGENCY'] : SEVERITY_STYLES['INFO'])}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold">{b.title}</span>
                    <span className="text-xs opacity-70">{new Date(b.publishedAt).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-xs opacity-80">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Emergency Contacts */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Emergency Contacts</h2>
        <p className="text-sm text-gray-500 mb-4">
          Numbers shown to residents in the SOS flow and as fallback when push delivery fails.
        </p>

        <div className="space-y-2 mb-4">
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-400">No emergency contacts configured.</p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.label}</p>
                  <p className="text-xs text-gray-500">{c.phone}</p>
                </div>
                <button
                  className="text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 px-2.5 py-1 rounded-lg transition-colors"
                  onClick={() => removeContact(c.id)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-12 gap-2 mb-4">
          <select
            className="col-span-4 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary-400"
            value={contactDraft.label}
            onChange={(e) => setContactDraft((d) => ({ ...d, label: e.target.value }))}
          >
            {CONTACT_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            className="col-span-6 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
            value={contactDraft.phone}
            onChange={(e) => setContactDraft((d) => ({ ...d, phone: e.target.value }))}
          />
          <button
            className="col-span-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
            onClick={addContact}
          >
            Add
          </button>
        </div>

        <button
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50',
            contactsSaved
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-primary-500 text-white hover:bg-primary-600',
          )}
          disabled={contactsMutation.isPending}
          onClick={() => contactsMutation.mutate(contacts)}
        >
          {contactsMutation.isPending ? 'Saving…' : contactsSaved ? 'Saved' : 'Save Contacts'}
        </button>
      </div>

      {/* SOS Recipients */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-900">SOS Recipients</h2>
          <button
            className="text-sm text-primary-600 border border-primary-200 hover:border-primary-400 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
            onClick={() => setShowAddRecipient(!showAddRecipient)}
          >
            {showAddRecipient ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Recipient</>}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          These contacts are notified (phone/email) whenever an SOS alert is triggered.
        </p>

        {showAddRecipient && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400"
                placeholder="Name *"
                value={recipientDraft.name}
                onChange={(e) => setRecipientDraft((d) => ({ ...d, name: e.target.value }))}
              />
              <input
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400"
                placeholder="Phone *"
                value={recipientDraft.phone}
                onChange={(e) => setRecipientDraft((d) => ({ ...d, phone: e.target.value }))}
              />
              <input
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400"
                placeholder="Email (optional)"
                value={recipientDraft.email}
                onChange={(e) => setRecipientDraft((d) => ({ ...d, email: e.target.value }))}
              />
              <input
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary-400"
                placeholder="Role (e.g. Security)"
                value={recipientDraft.role}
                onChange={(e) => setRecipientDraft((d) => ({ ...d, role: e.target.value }))}
              />
            </div>
            <button
              className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-600 transition-colors"
              disabled={!recipientDraft.name || !recipientDraft.phone || addRecipientMutation.isPending}
              onClick={() => addRecipientMutation.mutate()}
            >
              {addRecipientMutation.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}

        <div className="space-y-2">
          {!sosRecipients?.length ? (
            <p className="text-sm text-gray-400">No SOS recipients configured.</p>
          ) : (
            sosRecipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{r.name}{r.role ? ` — ${r.role}` : ''}</p>
                  <p className="text-xs text-gray-500">{r.phone}{r.email ? ` · ${r.email}` : ''}</p>
                </div>
                <button
                  className="text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 px-2.5 py-1 rounded-lg transition-colors"
                  onClick={() => confirmRemoveRecipient(r.id, r.name)}
                  disabled={removeRecipientMutation.isPending}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

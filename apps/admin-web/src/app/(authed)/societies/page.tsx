'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Archive,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  Card,
  Button,
  Input,
  Textarea,
  Field,
  Modal,
  EmptyState,
  SocietyStatusPill,
  Table,
  THead,
  TH,
  TR,
  TD,
} from '@/components/primitives';

type SocietyStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

type SocietyRow = {
  id: string;
  name: string;
  shortCode: string | null;
  city: string;
  pincode: string;
  flatCount: number;
  userCount: number;
  showInDirectory: boolean;
  status: SocietyStatus;
  suspendedAt: string | null;
  suspendedReason: string | null;
  archivedAt: string | null;
  createdAt: string;
};

const STATUS_TABS: { label: string; value: SocietyStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export default function SocietiesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const initialStatus = (params.get('status') as SocietyStatus | null) ?? 'ALL';
  const [status, setStatus] = useState<SocietyStatus | 'ALL'>(initialStatus);
  const [search, setSearch] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<SocietyRow | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    // Sync URL ?status= when user changes the tab — keeps deep-links working.
    const next = new URLSearchParams(params.toString());
    if (status === 'ALL') next.delete('status');
    else next.set('status', status);
    router.replace(`/societies${next.toString() ? `?${next.toString()}` : ''}`);
  }, [status]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set('search', search.trim());
    if (status !== 'ALL') p.set('status', status);
    if (status === 'ARCHIVED') p.set('includeArchived', 'true');
    return p.toString();
  }, [search, status]);

  const { data: societies = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-societies', status, search],
    queryFn: () => api.get<SocietyRow[]>(`/admin/societies${query ? `?${query}` : ''}`),
    // Don't issue the cross-society call unless the viewer can act on it.
    enabled: isSuperAdmin,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/societies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-societies'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Society archived');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/societies/${id}/restore`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-societies'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Society restored');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/societies/${id}/suspend`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-societies'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Society suspended — logins are now blocked');
      setSuspendTarget(null);
      setSuspendReason('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/societies/${id}/resume`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-societies'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Society resumed — logins are open again');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Role gate must render-conditional, not early-return, so the hooks above
  // execute on every render and React's hook ordering stays stable when the
  // user object is updated mid-session (society switch, role refresh).
  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-950">Restricted</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">
                Society management is a platform-level operation. Sign in as a super-admin to manage societies.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-gray-500 tracking-wide uppercase">Platform</p>
          <h1 className="text-[28px] font-semibold tracking-tight text-gray-950 mt-1">Societies</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Onboard, suspend, archive — control every society&apos;s lifecycle.
          </p>
        </div>
        <Link href="/societies/new">
          <Button leadingIcon={<Plus className="w-4 h-4" />}>Onboard society</Button>
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={
                'px-3 h-7 text-[13px] font-medium rounded-md transition-colors ' +
                (status === t.value
                  ? 'bg-white text-gray-950 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city, or code…"
            leadingIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
      </div>

      {isError ? (
        <Card>
          <p className="text-[13px] text-red-700">Couldn&apos;t load societies.</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      ) : isLoading ? (
        <Card>
          <p className="text-[13px] text-gray-500">Loading…</p>
        </Card>
      ) : societies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-5 h-5" />}
          title={
            status === 'ALL'
              ? 'No societies yet'
              : status === 'SUSPENDED'
                ? 'No suspended societies'
                : status === 'ARCHIVED'
                  ? 'No archived societies'
                  : 'No active societies'
          }
          description={
            status === 'ALL'
              ? 'Onboard your first society to start managing communities.'
              : 'Nothing here. Switch tabs above or onboard a new society.'
          }
          action={
            <Link href="/societies/new">
              <Button size="sm" leadingIcon={<Plus className="w-3.5 h-3.5" />}>
                Onboard society
              </Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Society</TH>
              <TH>Location</TH>
              <TH className="text-right">Flats</TH>
              <TH className="text-right">Users</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <tbody>
            {societies.map((s) => (
              <TR key={s.id}>
                <TD>
                  <div className="min-w-0">
                    <Link
                      href={`/societies/${s.id}`}
                      className="text-[14px] font-medium text-gray-950 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.shortCode && (
                      <p className="text-[11px] font-mono text-gray-400 mt-0.5">{s.shortCode}</p>
                    )}
                    {s.status === 'SUSPENDED' && s.suspendedReason && (
                      <p className="text-[11px] text-amber-700 mt-1 italic max-w-[260px] truncate">
                        “{s.suspendedReason}”
                      </p>
                    )}
                  </div>
                </TD>
                <TD className="text-[13px] text-gray-600">
                  {s.city}
                  {s.pincode && <span className="text-gray-400"> · {s.pincode}</span>}
                </TD>
                <TD className="text-right tabular-nums text-[13px] text-gray-700">{s.flatCount}</TD>
                <TD className="text-right tabular-nums text-[13px] text-gray-700">{s.userCount}</TD>
                <TD>
                  <SocietyStatusPill status={s.status} />
                </TD>
                <TD className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Link href={`/societies/${s.id}`}>
                      <Button variant="ghost" size="sm" trailingIcon={<ArrowUpRight className="w-3 h-3" />}>
                        Open
                      </Button>
                    </Link>
                    {s.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<PauseCircle className="w-3.5 h-3.5" />}
                        onClick={() => setSuspendTarget(s)}
                      >
                        Suspend
                      </Button>
                    )}
                    {s.status === 'SUSPENDED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<PlayCircle className="w-3.5 h-3.5" />}
                        onClick={() => resumeMutation.mutate(s.id)}
                        loading={resumeMutation.isPending}
                      >
                        Resume
                      </Button>
                    )}
                    {s.status !== 'ARCHIVED' && s.status !== 'SUSPENDED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Archive className="w-3.5 h-3.5" />}
                        onClick={() => {
                          if (confirm(`Archive "${s.name}"? Logins will be blocked.`)) {
                            archiveMutation.mutate(s.id);
                          }
                        }}
                      >
                        Archive
                      </Button>
                    )}
                    {s.status === 'ARCHIVED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={() => restoreMutation.mutate(s.id)}
                        loading={restoreMutation.isPending}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={!!suspendTarget}
        onClose={() => {
          setSuspendTarget(null);
          setSuspendReason('');
        }}
        title={`Suspend ${suspendTarget?.name ?? ''}`}
        description="Users will be blocked from logging in until you resume. Data stays intact."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setSuspendTarget(null);
                setSuspendReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={suspendMutation.isPending}
              onClick={() => {
                if (suspendTarget) {
                  suspendMutation.mutate({ id: suspendTarget.id, reason: suspendReason });
                }
              }}
            >
              Suspend society
            </Button>
          </>
        }
      >
        <Field
          label="Reason"
          hint="Visible internally on the society detail page. Keep it brief."
        >
          <Textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="e.g. Unpaid invoices >30 days — billing hold per ops protocol."
            rows={3}
          />
        </Field>
      </Modal>
    </div>
  );
}

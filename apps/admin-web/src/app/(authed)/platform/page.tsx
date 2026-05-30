'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Home, ArrowUpRight, Plus, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardHeader, Stat, Button, SocietyStatusPill, EmptyState } from '@/components/primitives';

type PlatformStats = {
  societies: { total: number; active: number; suspended: number; archived: number };
  users: { total: number };
  flats: { total: number };
  recentSocieties: {
    id: string;
    name: string;
    city: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
    userCount: number;
    createdAt: string;
  }[];
};

export default function PlatformOverviewPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.get<PlatformStats>('/admin/platform/stats'),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: isSuperAdmin,
  });

  // Render-conditional role gate (not early-return) — keeps hook ordering
  // stable across role/state changes mid-session.
  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-950">Platform console</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">
                Only platform super-admins can view cross-society totals.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-gray-500 tracking-wide uppercase">
            Platform
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight text-gray-950 mt-1">
            Overview
          </h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Cross-society totals and recent onboardings.
          </p>
        </div>
        <Link href="/societies/new">
          <Button leadingIcon={<Plus className="w-4 h-4" />}>Onboard society</Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat
          label="Societies"
          value={isLoading ? '–' : data?.societies.total ?? 0}
          hint={
            data
              ? `${data.societies.active} active · ${data.societies.suspended} suspended`
              : undefined
          }
        />
        <Stat
          label="Active"
          value={isLoading ? '–' : data?.societies.active ?? 0}
          hint="Accepting logins"
        />
        <Stat
          label="Total users"
          value={isLoading ? '–' : data?.users.total ?? 0}
          hint="All roles · all societies"
        />
        <Stat
          label="Total flats"
          value={isLoading ? '–' : data?.flats.total ?? 0}
          hint="Across all societies"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recently onboarded"
            description="Five most recent societies (any status)."
            actions={
              <Link href="/societies">
                <Button variant="secondary" size="sm" trailingIcon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                  All societies
                </Button>
              </Link>
            }
          />
          {isLoading ? (
            <p className="text-[13px] text-gray-500">Loading…</p>
          ) : !data?.recentSocieties.length ? (
            <EmptyState
              icon={<Building2 className="w-5 h-5" />}
              title="No societies yet"
              description="Onboard your first society to start managing communities."
              action={
                <Link href="/societies/new">
                  <Button size="sm" leadingIcon={<Plus className="w-3.5 h-3.5" />}>
                    Onboard society
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-gray-100 -mx-5">
              {data.recentSocieties.map((s) => (
                <li key={s.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/60">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/societies/${s.id}`}
                      className="text-[14px] font-medium text-gray-900 hover:text-gray-950 hover:underline"
                    >
                      {s.name}
                    </Link>
                    <p className="text-[12px] text-gray-500 truncate">{s.city}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[12px] text-gray-500 tabular-nums">
                      {s.userCount} users
                    </span>
                    <SocietyStatusPill status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="space-y-2">
            <Link href="/societies/new" className="block">
              <Button variant="secondary" fullWidth leadingIcon={<Plus className="w-4 h-4" />}>
                Onboard a society
              </Button>
            </Link>
            <Link href="/societies?status=SUSPENDED" className="block">
              <Button variant="ghost" fullWidth>
                Review suspended ({data?.societies.suspended ?? 0})
              </Button>
            </Link>
            <Link href="/societies?status=ARCHIVED" className="block">
              <Button variant="ghost" fullWidth>
                Archived ({data?.societies.archived ?? 0})
              </Button>
            </Link>
            <Link href="/building-admins" className="block">
              <Button variant="ghost" fullWidth>
                Admins
              </Button>
            </Link>
            <Link href="/audit" className="block">
              <Button variant="ghost" fullWidth>
                Audit log
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Society status guide"
          description="What each lifecycle state means and who it affects."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusGuide tone="success" label="Active">
            Logins open for all roles. Standard billing.
          </StatusGuide>
          <StatusGuide tone="warning" label="Suspended">
            Logins blocked with <code className="text-[11px] bg-gray-100 px-1 py-0.5 rounded">SOCIETY_SUSPENDED</code>.
            Data preserved. Reversible.
          </StatusGuide>
          <StatusGuide tone="neutral" label="Archived">
            Logins blocked permanently. Users soft-deactivated. Use for off-boarding.
          </StatusGuide>
        </div>
      </Card>
    </div>
  );
}

function StatusGuide({
  tone,
  label,
  children,
}: {
  tone: 'success' | 'warning' | 'neutral';
  label: string;
  children: React.ReactNode;
}) {
  const dot = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    neutral: 'bg-gray-400',
  }[tone];
  return (
    <div className="flex gap-3">
      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dot}`} />
      <div>
        <p className="text-[13px] font-semibold text-gray-950">{label}</p>
        <p className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

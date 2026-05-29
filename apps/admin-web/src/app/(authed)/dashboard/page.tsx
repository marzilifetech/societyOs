'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Users,
  HardHat,
  Wrench,
  KeyRound,
  Banknote,
  ClipboardList,
  Home,
  Siren,
  Clock,
  Megaphone,
  PartyPopper,
  X,
  Cake,
  CalendarDays,
  Pin,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { ErrorState } from '@/components/ui/ErrorState';
import { Stat, Card } from '@/components/primitives';

interface DashboardStats {
  totalResidents: number;
  totalStaff: number;
  openServiceRequests: number;
  pendingComplaints: number;
  todayVisitors: number;
  overdueMaintenanceBills: number;
  activeAlerts: number;
  occupancyRate: number;
}

interface FinancialSnapshot {
  collected: number;
  outstanding: number;
  overdue: number;
  period: string;
}

interface ActivityItem {
  id: string;
  type: 'VISITOR' | 'SERVICE_REQUEST' | 'COMPLAINT' | 'SOS';
  label: string;
  createdAt: string;
}

interface EventItem {
  id: string;
  title: string;
  startAt: string;
  venue: string;
  registeredCount: number;
  maxAttendees: number;
}

interface ComplaintCategoryDatum {
  category: string;
  count: number;
}

interface SrTrendDatum {
  day: string;
  count: number;
}

interface BirthdayItem {
  id: string;
  name: string;
  flat: string | null;
  age: number;
}

interface NoticeItem {
  id: string;
  title: string;
  publishedAt?: string;
  isPinned?: boolean;
}

const ACTIVITY_DOT: Record<string, string> = {
  VISITOR: 'bg-blue-500',
  SERVICE_REQUEST: 'bg-primary-500',
  COMPLAINT: 'bg-amber-500',
  SOS: 'bg-red-500',
};

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatEventDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const SOS_DISMISS_TTL_MS = 10 * 60 * 1000; // 10 minutes

export default function DashboardPage() {
  const societyId = useAuthStore((s: { user: { societyId: string } | null }) => s.user?.societyId ?? 'default');

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/admin/dashboard/stats'),
    refetchInterval: 30_000,
  });

  const { data: recentSR } = useQuery({
    queryKey: ['recent-service-requests'],
    queryFn: () => api.get<any[]>('/service-requests?limit=5'),
  });

  const { data: activeAlerts } = useQuery({
    queryKey: ['active-sos'],
    queryFn: () => api.get<any[]>('/sos/active'),
    refetchInterval: 30_000,
  });

  const { data: pendingResidents } = useQuery({
    queryKey: ['residents-pending'],
    queryFn: () => api.get<any[]>('/admin/residents/pending'),
    refetchInterval: 60_000,
  });

  const { data: financial } = useQuery({
    queryKey: ['financial', societyId],
    queryFn: () => api.get<FinancialSnapshot>('/admin/dashboard/financial'),
  });

  const { data: activity } = useQuery({
    queryKey: ['activity', societyId],
    queryFn: () => api.get<ActivityItem[]>('/admin/activity'),
  });

  const { data: events } = useQuery({
    queryKey: ['events-upcoming', societyId],
    queryFn: () => api.get<EventItem[]>('/admin/events'),
  });

  const { data: complaintChartData } = useQuery({
    queryKey: ['dashboard-complaints-by-category', societyId],
    queryFn: () =>
      api.get<ComplaintCategoryDatum[]>('/admin/dashboard/complaints-by-category'),
  });

  const { data: srTrendData } = useQuery({
    queryKey: ['dashboard-sr-trend', societyId],
    queryFn: () => api.get<SrTrendDatum[]>('/admin/dashboard/sr-trend'),
  });

  // F6: today's birthdays — drives both the inbox + Today @ Society widgets.
  const { data: birthdays = [] } = useQuery({
    queryKey: ['dashboard-birthdays', societyId],
    queryFn: () => api.get<BirthdayItem[]>('/admin/dashboard/birthdays?on=today'),
    staleTime: 10 * 60_000,
  });

  // Notices — used to surface pinned count and recency on Today @ Society.
  const { data: notices = [] } = useQuery({
    queryKey: ['dashboard-notices', societyId],
    queryFn: () => api.get<NoticeItem[]>('/notices'),
    staleTime: 60_000,
  });

  // SOS banner dismissal
  const sosDismissKey = `sos-dismissed-${societyId}`;
  const [sosDismissed, setSosDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(sosDismissKey);
    if (stored) {
      const ts = parseInt(stored, 10);
      if (Date.now() - ts < SOS_DISMISS_TTL_MS) {
        setSosDismissed(true);
      } else {
        localStorage.removeItem(sosDismissKey);
        setSosDismissed(false);
      }
    }
  }, [sosDismissKey]);

  function handleSosDismiss() {
    localStorage.setItem(sosDismissKey, String(Date.now()));
    setSosDismissed(true);
  }

  const showSosBanner = (activeAlerts?.length ?? 0) > 0 && !sosDismissed;

  // Upcoming events: future only, sorted ascending, top 3
  const upcomingEvents = (events ?? [])
    .filter((e) => new Date(e.startAt) > new Date())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  const STAT_CARDS: Array<{
    label: string;
    value: number | string | undefined;
    Icon: typeof Users;
    color: string;
    href: string;
    alert?: boolean;
    subtitle?: string;
  }> = [
    { label: 'Residents', value: stats?.totalResidents, Icon: Users, color: 'bg-blue-50 text-blue-600', href: '/residents' },
    { label: 'Staff', value: stats?.totalStaff, Icon: HardHat, color: 'bg-purple-50 text-purple-600', href: '/staff' },
    { label: 'Open Requests', value: stats?.openServiceRequests, Icon: Wrench, color: 'bg-amber-50 text-amber-600', href: '/service-requests' },
    { label: 'Today Visitors', value: stats?.todayVisitors, Icon: KeyRound, color: 'bg-teal-50 text-teal-600', href: '/visitors' },
    { label: 'Overdue Bills', value: stats?.overdueMaintenanceBills, Icon: Banknote, color: 'bg-red-50 text-red-600', href: '/maintenance' },
    { label: 'Pending Complaints', value: stats?.pendingComplaints, Icon: ClipboardList, color: 'bg-orange-50 text-orange-600', href: '/complaints' },
    { label: 'Occupancy', value: stats ? `${stats.occupancyRate}%` : undefined, Icon: Home, color: 'bg-green-50 text-green-600', href: '/residents' },
    { label: 'SOS Alerts', value: stats?.activeAlerts, Icon: Siren, color: 'bg-red-50 text-red-600', href: '/sos', alert: (stats?.activeAlerts ?? 0) > 0 },
    { label: 'Pending Approvals', value: pendingResidents?.length, Icon: Clock, color: 'bg-amber-50 text-amber-600', href: '/residents', subtitle: 'Residents awaiting approval', alert: (pendingResidents?.length ?? 0) > 0 },
  ];

  const QUICK_ACTIONS: Array<{ label: string; href: string; Icon: typeof Megaphone; color: string }> = [
    { label: 'Post Notice', href: '/notices', Icon: Megaphone, color: 'bg-blue-500' },
    { label: 'Create Event', href: '/events', Icon: PartyPopper, color: 'bg-purple-500' },
    { label: 'Send Alert', href: '/sos', Icon: Siren, color: 'bg-red-500' },
    { label: 'Generate Bills', href: '/maintenance', Icon: Banknote, color: 'bg-green-500' },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Active SOS banner */}
      {showSosBanner && (
        <div className="bg-red-500 text-white rounded-2xl px-6 py-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Siren className="w-7 h-7 animate-pulse" />
            <div>
              <p className="font-bold">{activeAlerts!.length} Active SOS Alert{activeAlerts!.length > 1 ? 's' : ''}</p>
              <p className="text-red-100 text-sm">Immediate attention required</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/sos" className="bg-white text-red-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition-colors">
              View Now
            </a>
            <button
              onClick={handleSosDismiss}
              aria-label="Dismiss SOS banner"
              className="bg-red-600 text-white font-semibold text-sm p-2 rounded-xl hover:bg-red-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {QUICK_ACTIONS.map((action) => (
          <a key={action.label} href={action.href}
            className={cn('flex items-center gap-3 px-4 py-3 rounded-2xl text-white font-medium text-sm hover:opacity-90 transition-opacity', action.color)}>
            <action.Icon className="w-5 h-5" />
            {action.label}
          </a>
        ))}
      </div>

      {isError && <ErrorState onRetry={refetch} message="Dashboard stats couldn't be loaded. Your data is safe — please try again." />}

      {/* F3: Today's Inbox + Today @ Society widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <TodaysInbox
          pendingResidents={pendingResidents ?? []}
          openComplaints={stats?.pendingComplaints ?? 0}
          overdueBills={stats?.overdueMaintenanceBills ?? 0}
          activeSos={stats?.activeAlerts ?? 0}
          birthdaysToday={birthdays.length}
        />
        <TodayAtSociety
          birthdays={birthdays}
          upcomingEvent={upcomingEvents[0]}
          pinnedNoticesCount={notices.filter((n) => n.isPinned).length}
        />
      </div>

      {/* Stats grid — restyled with the Stat primitive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {STAT_CARDS.map((card) => (
          <Link key={card.label} href={card.href} className="block">
            <Stat
              label={card.label}
              value={isLoading ? '…' : (card.value ?? 0)}
              hint={card.subtitle}
              className={cn(
                'hover:border-gray-300 transition-colors',
                card.alert && 'border-red-300',
                card.label === 'Pending Approvals' && card.alert && 'border-amber-300',
              )}
            />
          </Link>
        ))}
      </div>

      {/* Financial Snapshot */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Collected</p>
          {financial ? (
            <p className="text-2xl font-bold text-green-600">₹{financial.collected.toLocaleString()}</p>
          ) : (
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          )}
          {financial && <p className="text-xs text-gray-400 mt-1">{financial.period}</p>}
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Outstanding</p>
          {financial ? (
            <p className="text-2xl font-bold text-amber-500">₹{financial.outstanding.toLocaleString()}</p>
          ) : (
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          )}
          {financial && <p className="text-xs text-gray-400 mt-1">{financial.period}</p>}
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Overdue</p>
          {financial ? (
            <p className="text-2xl font-bold text-red-500">₹{financial.overdue.toLocaleString()}</p>
          ) : (
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          )}
          {financial && <p className="text-xs text-gray-400 mt-1">{financial.period}</p>}
        </div>
      </div>

      {/* Recent service requests */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Service Requests</h2>
          <a href="/service-requests" className="text-sm text-primary-500 hover:underline">View all</a>
        </div>
        <div className="divide-y divide-gray-50">
          {!recentSR?.length ? (
            <p className="px-6 py-8 text-gray-400 text-sm text-center">No service requests</p>
          ) : (
            recentSR.map((sr) => (
              <ServiceRequestRow key={sr.id} sr={sr} />
            ))
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Complaints by Category</h3>
          {complaintChartData === undefined ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : complaintChartData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">No complaints recorded</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={complaintChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, color: '#111827' }} />
                <Bar dataKey="count" fill="#821A52" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Service Requests (Last 30 days)</h3>
          {srTrendData === undefined ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : srTrendData.every((d) => d.count === 0) ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">No service requests in the last 30 days</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={srTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, color: '#111827' }} />
                <Area type="monotone" dataKey="count" stroke="#821A52" strokeWidth={2} fill="rgba(130,26,82,0.10)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Activity Feed + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Activity Feed */}
        <div className="rounded-2xl p-5 border border-gray-200 bg-white shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {!activity?.length ? (
            <div className="py-8 text-center">
              <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No recent activity yet</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {activity.slice(0, 10).map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', ACTIVITY_DOT[item.type] ?? 'bg-gray-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{item.label}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{relativeTime(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="rounded-2xl p-5 border border-gray-200 bg-white shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Upcoming Events</h3>
          {!upcomingEvents.length ? (
            <div className="py-8 text-center">
              <PartyPopper className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No upcoming events</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{event.venue}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-primary-600">{formatEventDate(event.startAt)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{event.registeredCount} / {event.maxAttendees} registered</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-blue-100 text-blue-700' },
  ASSIGNED: { label: 'Assigned', color: 'bg-purple-100 text-purple-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

function ServiceRequestRow({ sr }: { sr: any }) {
  const meta = STATUS_META[sr.status] ?? STATUS_META.PENDING;
  return (
    <div className="px-6 py-3.5 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{sr.category}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{sr.description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', meta.color)}>
          {meta.label}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(sr.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  );
}

// F3: "Today's Inbox" surfaces the 5 most-urgent items needing admin
// attention. We grade by impact (active SOS > overdue bills > pending
// residents > open complaints > today's birthdays) and cap at 5 — anything
// past that belongs on the relevant detail page.
function TodaysInbox({
  pendingResidents,
  openComplaints,
  overdueBills,
  activeSos,
  birthdaysToday,
}: {
  pendingResidents: any[];
  openComplaints: number;
  overdueBills: number;
  activeSos: number;
  birthdaysToday: number;
}) {
  type Row = { id: string; icon: typeof Siren; label: string; href: string; tone: string };
  const rows: Row[] = [];
  if (activeSos > 0) {
    rows.push({
      id: 'sos',
      icon: Siren,
      label: `${activeSos} active SOS alert${activeSos === 1 ? '' : 's'}`,
      href: '/sos',
      tone: 'text-red-600',
    });
  }
  if (overdueBills > 0) {
    rows.push({
      id: 'bills',
      icon: Banknote,
      label: `${overdueBills} overdue maintenance bill${overdueBills === 1 ? '' : 's'}`,
      href: '/maintenance',
      tone: 'text-amber-600',
    });
  }
  pendingResidents.slice(0, 3).forEach((r) => {
    rows.push({
      id: `resident-${r.id}`,
      icon: Clock,
      label: `Approve resident: ${r.name ?? r.phone ?? 'pending'}`,
      href: `/residents/${r.id}`,
      tone: 'text-amber-600',
    });
  });
  if (openComplaints > 0) {
    rows.push({
      id: 'complaints',
      icon: ClipboardList,
      label: `${openComplaints} pending complaint${openComplaints === 1 ? '' : 's'}`,
      href: '/complaints',
      tone: 'text-orange-600',
    });
  }
  if (birthdaysToday > 0) {
    rows.push({
      id: 'birthdays',
      icon: Cake,
      label: `${birthdaysToday} resident birthday${birthdaysToday === 1 ? '' : 's'} today`,
      href: '#today-at-society',
      tone: 'text-pink-600',
    });
  }

  const limited = rows.slice(0, 5);
  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-950">Today&apos;s Inbox</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">Items that need your attention now.</p>
        </div>
      </div>
      {limited.length === 0 ? (
        <div className="py-8 text-center">
          <ClipboardList className="w-7 h-7 text-gray-300 mx-auto mb-2" />
          <p className="text-[13px] text-gray-500">Inbox zero — nothing urgent today.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 -mx-1">
          {limited.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-center gap-3 px-1 py-2.5 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <row.icon className={cn('w-4 h-4 shrink-0', row.tone)} />
                <span className="text-[13px] text-gray-800 flex-1 truncate">{row.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// F3: "Today @ Society" — celebratory + community-flavoured glance card.
// Birthdays first (event-of-the-day), then the next upcoming event in the
// week, then pinned notices count as a quick civic-attention signal.
function TodayAtSociety({
  birthdays,
  upcomingEvent,
  pinnedNoticesCount,
}: {
  birthdays: BirthdayItem[];
  upcomingEvent: EventItem | undefined;
  pinnedNoticesCount: number;
}) {
  const eventInSevenDays =
    upcomingEvent &&
    new Date(upcomingEvent.startAt).getTime() - Date.now() < 7 * 86_400_000
      ? upcomingEvent
      : undefined;
  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-950" id="today-at-society">
            Today @ Society
          </h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            A quick civic glance — birthdays, events, pinned notices.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-3 px-1 py-2">
          <Cake className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-900">
              {birthdays.length === 0
                ? 'No birthdays today'
                : `${birthdays.length} birthday${birthdays.length === 1 ? '' : 's'} today`}
            </p>
            {birthdays.length > 0 && (
              <p className="text-[12px] text-gray-500 truncate mt-0.5">
                {birthdays.slice(0, 3).map((b) => b.name).join(', ')}
                {birthdays.length > 3 && `, +${birthdays.length - 3} more`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3 px-1 py-2">
          <CalendarDays className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {eventInSevenDays ? (
              <Link href="/events" className="block">
                <p className="text-[13px] font-medium text-gray-900 truncate">{eventInSevenDays.title}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {new Date(eventInSevenDays.startAt).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' · '}
                  {eventInSevenDays.venue}
                </p>
              </Link>
            ) : (
              <p className="text-[13px] font-medium text-gray-900">No events in the next 7 days</p>
            )}
          </div>
        </div>
        <Link href="/notices" className="flex items-start gap-3 px-1 py-2 hover:bg-gray-50 rounded-lg transition-colors">
          <Pin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-900">
              {pinnedNoticesCount === 0
                ? 'No pinned notices'
                : `${pinnedNoticesCount} pinned notice${pinnedNoticesCount === 1 ? '' : 's'}`}
            </p>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Open the noticeboard
            </p>
          </div>
        </Link>
      </div>
    </Card>
  );
}

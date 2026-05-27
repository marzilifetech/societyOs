'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, UserCircle, Trophy, CalendarOff, UserCheck,
  Wrench, FileText, MessageSquareWarning, Receipt, Megaphone, CalendarDays, Siren,
  UtensilsCrossed, Stethoscope, Shirt, ConciergeBell, Sparkles, ShieldCheck,
  HandPlatter, ParkingSquare, Plane, Package, Bug,
  Wallet, PiggyBank, Store,
  BarChart3, Home, Vote, Building2, MessagesSquare, Settings,
  ScrollText, UserCog, Layers, type LucideIcon,
  ChevronRight, LogOut,
} from 'lucide-react';
import { SocietySwitcher } from '@/components/layout/SocietySwitcher';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

type Item = { href: string; icon: LucideIcon; label: string };

const NAV_ITEMS: Item[] = [
  { href: '/dashboard',         icon: LayoutDashboard,      label: 'Dashboard' },
  { href: '/residents',         icon: Users,                label: 'Residents' },
  { href: '/flats',             icon: Building2,            label: 'Flats & Blocks' },
  { href: '/staff',             icon: UserCircle,           label: 'Staff' },
  { href: '/staff/leaderboard', icon: Trophy,               label: 'Leaderboard' },
  { href: '/staff/leaves',      icon: CalendarOff,          label: 'Staff Leaves' },
  { href: '/visitors',          icon: UserCheck,            label: 'Visitors' },
  { href: '/service-requests',  icon: Wrench,               label: 'Service Requests' },
  { href: '/document-requests', icon: FileText,             label: 'Document Requests' },
  { href: '/complaints',        icon: MessageSquareWarning, label: 'Complaints' },
  { href: '/maintenance',       icon: Receipt,              label: 'Maintenance' },
  { href: '/notices',           icon: Megaphone,            label: 'Notices' },
  { href: '/events',            icon: CalendarDays,         label: 'Events' },
  { href: '/sos',               icon: Siren,                label: 'SOS Alerts' },
];

const NAV_SECTIONS: { label: string; items: Item[] }[] = [
  {
    label: 'Operations',
    items: [
      { href: '/canteen',        icon: UtensilsCrossed, label: 'Canteen' },
      { href: '/medical',        icon: Stethoscope,     label: 'Medical' },
      { href: '/laundry',        icon: Shirt,           label: 'Laundry' },
      { href: '/concierge',      icon: ConciergeBell,   label: 'Concierge' },
      { href: '/housekeeping',   icon: Sparkles,        label: 'Housekeeping' },
      { href: '/security',       icon: ShieldCheck,     label: 'Security' },
      { href: '/domestic-help',  icon: HandPlatter,     label: 'Domestic Help' },
      { href: '/parking',        icon: ParkingSquare,   label: 'Parking' },
      { href: '/travel',         icon: Plane,           label: 'Travel Pauses' },
      { href: '/packages',       icon: Package,         label: 'Packages' },
      { href: '/pest-control',   icon: Bug,             label: 'Pest Control' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/wallet',         icon: Wallet,          label: 'Wallet Activity' },
      { href: '/budget',         icon: PiggyBank,       label: 'Society Budget' },
      { href: '/vendors',        icon: Store,           label: 'Vendors' },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/polls',          icon: Vote,            label: 'Polls' },
      { href: '/property',       icon: Home,            label: 'Property' },
      { href: '/agm',            icon: ScrollText,      label: 'AGM / Meetings' },
      { href: '/community',      icon: MessagesSquare,  label: 'Community Posts' },
      { href: '/infrastructure', icon: Building2,       label: 'Infrastructure' },
      { href: '/feedback',       icon: BarChart3,       label: 'Feedback' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/platform',        icon: Layers,           label: 'Platform' },
      { href: '/societies',       icon: Building2,        label: 'Societies' },
      { href: '/building-admins', icon: UserCog,          label: 'Building Admins' },
      { href: '/audit',           icon: ScrollText,       label: 'Audit Log' },
      { href: '/settings',        icon: Settings,         label: 'Settings' },
    ],
  },
];

// Items only super-admins should see.
const SUPER_ADMIN_ONLY = new Set(['/platform', '/societies', '/building-admins']);

function NavItem({ href, icon: Icon, label, badge }: Item & { badge?: number }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-primary-500' : 'text-gray-400')} />
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 leading-none">
          {badge}
        </span>
      )}
      {active && badge == null && (
        <ChevronRight className="ml-auto w-3.5 h-3.5 text-primary-500" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'A';

  // SUPER_ADMIN sits in the Platform society which has no residents; polling
  // every 60s would return zero and waste a request per minute per tab.
  const { data: pendingResidents } = useQuery({
    queryKey: ['residents-pending'],
    queryFn: () => api.get<any[]>('/admin/residents/pending'),
    refetchInterval: 60_000,
    enabled: !!user && user.role !== 'SUPER_ADMIN',
  });
  const pendingCount = pendingResidents?.length ?? 0;

  return (
    <aside className="w-60 flex flex-col h-screen sticky top-0 shrink-0 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight">SocietyOS</h1>
            <p className="text-[10px] text-gray-400 -mt-0.5 tracking-wide uppercase">Admin</p>
          </div>
        </div>
      </div>

      <SocietySwitcher />

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            badge={item.href === '/residents' ? pendingCount : undefined}
          />
        ))}

        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(
            (item) => !SUPER_ADMIN_ONLY.has(item.href) || user?.role === 'SUPER_ADMIN',
          );
          if (items.length === 0) return null;
          return (
            <div key={section.label} className="pt-4">
              <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-gray-400">
                {section.label}
              </p>
              {items.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-gray-200">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1 bg-gray-50">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.name ?? 'Admin'}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.role?.replace('_', ' ') ?? 'Administrator'}</p>
          </div>
        </div>
        <button
          onClick={clearAuth}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors py-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

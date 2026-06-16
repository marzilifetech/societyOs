'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type SocietyContext = {
  id: string;
  name: string;
  city?: string | null;
};

/**
 * Slim header strip that makes the currently-active society obvious on every
 * authed screen. Super-admins switch via the sidebar SocietySwitcher; this bar
 * is the read-only confirmation of which tenant the page is showing.
 *
 * Re-keyed on `admin_selected_society_id` so a super-admin switch refetches
 * without a hard reload race (SocietySwitcher already reloads, but cached
 * queries from before the reload would otherwise flash stale data).
 */
export function TopBar() {
  const { user } = useAuthStore();

  const { data: society } = useQuery({
    queryKey: ['admin-society-context'],
    queryFn: () => api.get<SocietyContext>('/admin/society'),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-2.5 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-primary-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 leading-none mb-0.5">
            Active society
          </p>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-gray-900 truncate">
              {society?.name ?? 'Loading…'}
            </span>
            {society?.city && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-500 shrink-0">
                <MapPin className="w-3 h-3" />
                {society.city}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

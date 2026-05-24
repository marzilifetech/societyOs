'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type SocietyRow = {
  id: string;
  name: string;
  city: string;
};

export function SocietySwitcher() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [selectedId, setSelectedId] = useState(user?.societyId ?? '');

  useEffect(() => {
    const stored = localStorage.getItem('admin_selected_society_id');
    setSelectedId(stored ?? user?.societyId ?? '');
  }, [user?.societyId]);

  const { data: societies = [] } = useQuery({
    queryKey: ['admin-societies'],
    queryFn: () => api.get<SocietyRow[]>('/admin/societies'),
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) return null;

  const selected = societies.find((s) => s.id === selectedId);

  const onChange = (societyId: string) => {
    if (societyId === user?.societyId) {
      localStorage.removeItem('admin_selected_society_id');
    } else {
      localStorage.setItem('admin_selected_society_id', societyId);
    }
    window.location.reload();
  };

  return (
    <div className="px-3 pb-3">
      <label className="block text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-1.5 px-1">
        Active Society
      </label>
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-200"
        >
          {societies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.city})
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      {selected && selected.id !== user?.societyId && (
        <p className="text-[10px] text-amber-600 mt-1 px-1">Viewing as super-admin</p>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Award, Star, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type StaffMember = {
  id: string;
  name: string;
  tasksCompleted: number;
  avgRating?: number;
  onTimeRate?: number;
  attendanceRate?: number;
  rank?: number;
  score?: number;
};

type Period = 'week' | 'month' | 'quarter';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
];

const MEDAL_ICONS = [Trophy, Medal, Award] as const;
const MEDAL_ICON_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
const PODIUM_COLORS = [
  'border-yellow-300 bg-yellow-50',
  'border-gray-300 bg-gray-50',
  'border-amber-400 bg-amber-50',
];
const PODIUM_LABEL_COLORS = ['text-yellow-600', 'text-gray-500', 'text-amber-700'];

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('w-3 h-3', i < full ? 'fill-amber-400' : 'fill-none text-gray-300')}
        />
      ))}
      <span className="text-gray-500 ml-1 text-xs">({rating.toFixed(1)})</span>
    </span>
  );
}

export default function StaffLeaderboardPage() {
  const [period, setPeriod] = useState<Period>('month');

  const { data: leaderboardData, isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-leaderboard', period],
    queryFn: async () => {
      try {
        return await api.get<{ staff: StaffMember[] }>(`/staff/leaderboard?period=${period}`);
      } catch {
        // Fallback: fetch all staff and compute rank client-side
        const staffList = await api.get<StaffMember[]>(`/staff?period=${period}`);
        const arr = Array.isArray(staffList) ? staffList : (staffList as any)?.staff ?? [];
        const sorted = [...arr].sort((a: StaffMember, b: StaffMember) => (b.tasksCompleted ?? 0) - (a.tasksCompleted ?? 0));
        return { staff: sorted.map((s: StaffMember, i: number) => ({ ...s, rank: i + 1 })) };
      }
    },
  });

  const staffArr: StaffMember[] = (leaderboardData as any)?.staff ?? (Array.isArray(leaderboardData) ? leaderboardData : []);

  const ranked = staffArr.map((s, i) => ({ ...s, rank: s.rank ?? i + 1 }));
  const podium = ranked.slice(0, 3);
  // Reorder podium: silver (2nd) | gold (1st) | bronze (3rd) for visual effect
  const podiumOrdered = podium.length >= 2 ? [podium[1], podium[0], podium[2]].filter(Boolean) : podium;
  const table = ranked.slice(3);

  const fmt = (n?: number) => (n != null ? `${Math.round(n)}%` : '—');

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Leaderboard</h1>
          <p className="text-gray-500 text-sm mt-1">Performance rankings across your team</p>
        </div>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                period === p.value
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex justify-center gap-6">
            {[1, 2, 3].map((i) => <div key={i} className="w-32 h-40 bg-gray-100 animate-pulse rounded-2xl" />)}
          </div>
          <div className="h-48 bg-gray-100 animate-pulse rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Leaderboard couldn't be loaded. Please try again." />
      ) : !ranked.length ? (
        <div className="py-16 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No staff performance data yet</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          {podium.length > 0 && (
            <div className="flex items-end justify-center gap-4 mb-8">
              {podiumOrdered.map((s) => {
                // Map back to original rank index (0-based)
                const rankIdx = s.rank! - 1;
                const isGold = rankIdx === 0;
                const isSilver = rankIdx === 1;
                const podiumHeight = isGold ? 'h-40' : isSilver ? 'h-32' : 'h-28';
                const borderColor = PODIUM_COLORS[rankIdx] ?? PODIUM_COLORS[2];
                const labelColor = PODIUM_LABEL_COLORS[rankIdx] ?? PODIUM_LABEL_COLORS[2];
                const MedalIcon = MEDAL_ICONS[rankIdx] ?? MEDAL_ICONS[2];
                const medalColor = MEDAL_ICON_COLORS[rankIdx] ?? MEDAL_ICON_COLORS[2];
                return (
                  <div key={s.id} className="flex flex-col items-center gap-2">
                    <div className={cn('w-28 rounded-2xl border-2 flex flex-col items-center justify-center p-3 gap-1', podiumHeight, borderColor)}>
                      <MedalIcon className={cn('w-7 h-7', medalColor)} />
                      <p className="text-sm font-bold text-gray-900 text-center leading-tight">{s.name}</p>
                      <p className={cn('text-xs font-semibold', labelColor)}>
                        {s.tasksCompleted} tasks
                      </p>
                      {s.avgRating != null && (
                        <p className="text-[10px] text-amber-500 inline-flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400" /> {s.avgRating.toFixed(1)}
                        </p>
                      )}
                    </div>
                    <p className={cn('text-xs font-bold', labelColor)}>#{s.rank}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table for rank 4+ */}
          {table.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 w-12">Rank</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Name</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Tasks</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Rating</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">On-Time</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-center text-gray-500 font-medium">#{s.rank}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-5 py-3 text-center text-gray-600">{s.tasksCompleted}</td>
                      <td className="px-5 py-3 text-center">
                        {s.avgRating != null ? <Stars rating={s.avgRating} /> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn('text-xs font-medium',
                          (s.onTimeRate ?? 0) >= 80 ? 'text-green-600' : (s.onTimeRate ?? 0) >= 60 ? 'text-amber-600' : 'text-red-600')}>
                          {fmt(s.onTimeRate)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn('text-xs font-medium',
                          (s.attendanceRate ?? 0) >= 90 ? 'text-green-600' : (s.attendanceRate ?? 0) >= 75 ? 'text-amber-600' : 'text-red-600')}>
                          {fmt(s.attendanceRate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

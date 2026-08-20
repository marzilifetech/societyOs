'use client';

import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/useAccess';
import { cn } from '@/lib/cn';
import type { Permission } from '@/lib/permissions';

type Catalogue = { groups: { group: string; permissions: Permission[] }[] };

/** 'residents:approve' -> 'Approve' — the group heading already says the noun. */
function actionLabel(permission: string): string {
  const action = permission.split(':').slice(1).join(' ');
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function resourceLabel(permission: string): string {
  return permission.split(':')[0].replace(/_/g, ' ');
}

/**
 * Grouped permission checkboxes, driven by the SERVER's catalogue
 * (`GET /admin/permissions`) rather than a hardcoded list — so a permission
 * added in the backend appears here on the next deploy with no UI change.
 *
 * Permissions the current user does not hold render disabled, because the
 * server refuses to let anyone grant beyond their own access. Greying them out
 * rather than hiding them makes that ceiling visible, instead of leaving the
 * editor looking arbitrarily incomplete.
 */
export function RolePermissionPicker({
  selected,
  onChange,
  disabled,
}: {
  selected: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
}) {
  const { can, access } = useAccess();
  const { data } = useQuery<Catalogue>({
    queryKey: ['admin', 'permissions'],
    queryFn: () => api.get<Catalogue>('/admin/permissions'),
    staleTime: 5 * 60_000,
  });

  const chosen = new Set<string>(selected);

  const toggle = (permission: Permission) => {
    const next = new Set<string>(chosen);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    onChange([...next] as Permission[]);
  };

  const toggleGroup = (permissions: Permission[], allOn: boolean) => {
    const grantable = permissions.filter((p) => can(p));
    const next = new Set<string>(chosen);
    grantable.forEach((p) => (allOn ? next.delete(p) : next.add(p)));
    onChange([...next] as Permission[]);
  };

  if (!data) return <p className="text-sm text-gray-400">Loading permissions…</p>;

  return (
    <div className="space-y-4">
      {data.groups.map(({ group, permissions }) => {
        const grantable = permissions.filter((p) => can(p));
        const allOn = grantable.length > 0 && grantable.every((p) => chosen.has(p));
        return (
          <div key={group} className="rounded-lg border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{group}</p>
              {!disabled && grantable.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleGroup(permissions, allOn)}
                  className="text-xs font-medium text-primary-600 hover:underline"
                >
                  {allOn ? 'Clear' : 'Select all'}
                </button>
              )}
            </div>
            <div className="grid gap-x-6 gap-y-1 p-3 sm:grid-cols-2">
              {permissions.map((permission) => {
                const grantableHere = can(permission);
                const on = chosen.has(permission);
                return (
                  <label
                    key={permission}
                    className={cn(
                      'flex items-start gap-2 rounded px-2 py-1.5',
                      grantableHere && !disabled
                        ? 'cursor-pointer hover:bg-gray-50'
                        : 'cursor-not-allowed opacity-50',
                    )}
                    title={
                      grantableHere
                        ? permission
                        : 'You do not have this permission, so you cannot grant it'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled || !grantableHere}
                      onChange={() => toggle(permission)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-gray-800">{actionLabel(permission)}</span>
                      <span className="block text-[11px] capitalize text-gray-400">
                        {resourceLabel(permission)}
                      </span>
                    </span>
                    {!grantableHere && <Lock className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {!access?.isSuperAdmin && (
        <p className="text-xs text-gray-500">
          Greyed-out permissions are ones you do not hold yourself — the server will refuse to
          grant them.
        </p>
      )}
    </div>
  );
}

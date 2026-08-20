'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Trash2, Pencil, X } from 'lucide-react';
import { api } from '@/lib/api';
import { RolePermissionPicker } from '@/components/admin/RolePermissionPicker';
import { cn } from '@/lib/cn';
import type { Permission } from '@/lib/permissions';

type Role = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  permissions: Permission[];
  isSystem: boolean;
  societyId: string | null;
};

const slugify = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);

export function RolesTab({ onError }: { onError: (m: string | null) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{ name: string; description: string; permissions: Permission[] }>(
    { name: '', description: '', permissions: [] },
  );

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['admin', 'roles'],
    queryFn: () => api.get<Role[]>('/admin/roles'),
  });

  const done = () => {
    setEditing(null);
    setCreating(false);
    setDraft({ name: '', description: '', permissions: [] });
    onError(null);
    qc.invalidateQueries({ queryKey: ['admin'] });
  };

  const createRole = useMutation({
    mutationFn: () =>
      api.post('/admin/roles', {
        key: slugify(draft.name),
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        permissions: draft.permissions,
      }),
    onSuccess: done,
    onError: (e: any) => onError(e?.message ?? 'Could not create this role.'),
  });

  const updateRole = useMutation({
    mutationFn: (role: Role) =>
      api.patch(`/admin/roles/${role.id}`, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        permissions: draft.permissions,
      }),
    onSuccess: done,
    onError: (e: any) => onError(e?.message ?? 'Could not update this role.'),
  });

  const deleteRole = useMutation({
    mutationFn: (roleId: string) => api.delete(`/admin/roles/${roleId}`),
    onSuccess: done,
    onError: (e: any) => onError(e?.message ?? 'Could not delete this role.'),
  });

  const startEdit = (role: Role) => {
    setCreating(false);
    setEditing(role);
    setDraft({
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions,
    });
  };

  const startDuplicate = (role: Role) => {
    setEditing(null);
    setCreating(true);
    setDraft({
      name: `${role.name} (copy)`,
      description: role.description ?? '',
      permissions: role.permissions,
    });
  };

  const isOpen = creating || !!editing;

  return (
    <div className="space-y-5">
      {!isOpen && (
        <button
          onClick={() => {
            setCreating(true);
            setDraft({ name: '', description: '', permissions: [] });
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" />
          New role
        </button>
      )}

      {isOpen && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {creating ? 'New role' : `Edit ${editing?.name}`}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Pick exactly what this role can do. Anyone assigned it gets these permissions.
              </p>
            </div>
            <button onClick={done} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Role name (e.g. Facility Manager)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What is this role for? (optional)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <RolePermissionPicker
            selected={draft.permissions}
            onChange={(permissions) => setDraft({ ...draft, permissions })}
          />

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => (creating ? createRole.mutate() : editing && updateRole.mutate(editing))}
              disabled={!draft.name.trim() || draft.permissions.length === 0}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                !draft.name.trim() || draft.permissions.length === 0
                  ? 'bg-gray-300'
                  : 'bg-primary-500 hover:bg-primary-600',
              )}
            >
              {creating ? 'Create role' : 'Save changes'}
            </button>
            <span className="text-xs text-gray-500">
              {draft.permissions.length} permission{draft.permissions.length === 1 ? '' : 's'}
              {draft.permissions.length === 0 && ' — pick at least one'}
            </span>
          </div>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading roles…</p>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{role.name}</p>
                    {role.isSystem && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                        title="Built-in roles are managed in code and re-synced on deploy"
                      >
                        <Lock className="h-2.5 w-2.5" /> Built-in
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{role.description}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {role.permissions.length} permissions
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {/* Built-ins are duplicated rather than edited: they are
                      re-synced from code on every deploy, so an edit would be
                      silently reverted. */}
                  <button
                    onClick={() => (role.isSystem ? startDuplicate(role) : startEdit(role))}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    {role.isSystem ? 'Duplicate' : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                  {!role.isSystem && (
                    <button
                      onClick={() => deleteRole.mutate(role.id)}
                      className="rounded-lg px-2 py-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

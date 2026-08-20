'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Trash2, Layers, AlertCircle, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAccess, Can } from '@/lib/useAccess';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/cn';
import { RolesTab } from './RolesTab';

type AdminRow = {
  id: string;
  user: { id: string; name: string | null; phone: string; status: string };
  roleKey: string;
  roleName: string;
  permissions: string[];
  blocks: string[];
  isActive: boolean;
};

type Role = { id: string; key: string; name: string; description?: string; permissions: string[]; isSystem: boolean };

export default function ManageAdminsPage() {
  const qc = useQueryClient();
  const { can, isBlockScoped, blocks: myBlocks } = useAccess();
  const [form, setForm] = useState({ phone: '', name: '', roleKey: '', blocks: '' });
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'admins' | 'roles'>('admins');

  const { data: admins = [], isLoading } = useQuery<AdminRow[]>({
    queryKey: ['admin', 'admins'],
    queryFn: () => api.get<AdminRow[]>('/admin/admins'),
    enabled: can(PERMISSIONS.ADMINS_MANAGE),
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['admin', 'roles'],
    queryFn: () => api.get<Role[]>('/admin/roles'),
    enabled: can(PERMISSIONS.ADMINS_MANAGE),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const addAdmin = useMutation({
    mutationFn: () =>
      api.post('/admin/admins', {
        phone: form.phone.trim(),
        name: form.name.trim() || undefined,
        roleKey: form.roleKey,
        blocks: form.blocks
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setForm({ phone: '', name: '', roleKey: '', blocks: '' });
      setError(null);
      invalidate();
    },
    // Surface the server's reason verbatim — these are the escalation guards
    // ("you cannot grant permissions you do not have"), and paraphrasing them
    // would hide exactly why the action was refused.
    onError: (e: any) => setError(e?.message ?? 'Could not add this admin.'),
  });

  /**
   * Change an existing admin's role or scope in place.
   *
   * PATCH by grant id rather than re-POSTing by phone: editing someone already
   * in the list should not require re-typing their number, and a typo there
   * would silently invite a second person instead of editing this one.
   */
  const updateAdmin = useMutation({
    mutationFn: (vars: { grantId: string; roleKey?: string; blocks?: string[] }) =>
      api.patch(`/admin/admins/${vars.grantId}`, {
        roleKey: vars.roleKey,
        blocks: vars.blocks,
      }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: any) => setError(e?.message ?? 'Could not update this admin.'),
  });

  const removeAdmin = useMutation({
    mutationFn: (grantId: string) => api.delete(`/admin/admins/${grantId}`),
    onSuccess: invalidate,
    onError: (e: any) => setError(e?.message ?? 'Could not remove this admin.'),
  });

  if (!can(PERMISSIONS.ADMINS_MANAGE)) {
    return (
      <div className="p-8">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-gray-300" />
          <h1 className="mt-3 text-base font-semibold text-gray-900">Not available to you</h1>
          <p className="mt-1 text-sm text-gray-500">
            Managing admins needs the <code className="text-xs">admins:manage</code> permission.
            Ask an Owner to grant it.
          </p>
        </div>
      </div>
    );
  }

  const selectedRole = roles.find((r) => r.key === form.roleKey);

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Admins</h1>
        <p className="mt-1 text-sm text-gray-500">
          A society can have as many admins as it needs. Each one gets a role, and optionally a
          block scope that limits everything they see.
        </p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {(['admins', 'roles'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize',
              tab === t
                ? 'border-primary-500 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-800',
            )}
          >
            {t === 'admins' ? 'Admins' : 'Roles & permissions'}
          </button>
        ))}
      </div>

      {tab === 'roles' && <RolesTab onError={setError} />}

      {tab === 'admins' && isBlockScoped && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            You manage {myBlocks.join(', ')}, so you can only grant access within those blocks.
          </p>
        </div>
      )}

      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* ── Add ─────────────────────────────────────────────────────────── */}
      {tab === 'admins' && <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Add an admin</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          They do not need an account yet — we will create one, and it activates when they first
          sign in.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Mobile number"
            inputMode="numeric"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name (optional)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={form.roleKey}
            onChange={(e) => setForm({ ...form, roleKey: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Choose a role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.key}>
                {r.name}
                {r.isSystem ? '' : ' (custom)'}
              </option>
            ))}
          </select>
          <input
            value={form.blocks}
            onChange={(e) => setForm({ ...form, blocks: e.target.value })}
            placeholder={isBlockScoped ? `e.g. ${myBlocks[0] ?? 'A'}` : 'Blocks (blank = all)'}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {selectedRole && (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">
              {selectedRole.description} — {selectedRole.permissions.length} permissions
            </p>
          </div>
        )}

        <button
          onClick={() => addAdmin.mutate()}
          disabled={!form.phone || !form.roleKey || addAdmin.isPending}
          className={cn(
            'mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white',
            !form.phone || !form.roleKey || addAdmin.isPending
              ? 'bg-gray-300'
              : 'bg-primary-500 hover:bg-primary-600',
          )}
        >
          <Plus className="h-4 w-4" />
          {addAdmin.isPending ? 'Adding…' : 'Add admin'}
        </button>
      </section>}

      {/* ── List ────────────────────────────────────────────────────────── */}
      {tab === 'admins' && <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Person</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Scope</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  No admins yet.
                </td>
              </tr>
            ) : (
              admins.map((a) => (
                <tr key={a.id} className={cn(!a.isActive && 'opacity-50')}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{a.user.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{a.user.phone}</p>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={a.roleKey}
                      disabled={updateAdmin.isPending}
                      onChange={(e) =>
                        updateAdmin.mutate({ grantId: a.id, roleKey: e.target.value })
                      }
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.key}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <input
                      defaultValue={a.blocks.join(', ')}
                      placeholder="Whole society"
                      disabled={updateAdmin.isPending}
                      // Commit on blur/Enter rather than per keystroke — each
                      // change is a privileged write, and firing one per
                      // character would both hammer the API and let a
                      // half-typed block name land as a real scope.
                      onBlur={(e) => {
                        const next = e.target.value.split(',').map((b) => b.trim()).filter(Boolean);
                        if (next.join(',') !== a.blocks.join(',')) {
                          updateAdmin.mutate({ grantId: a.id, blocks: next });
                        }
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700"
                    />
                  </td>
                  <td className="px-5 py-3">
                    {a.user.status === 'PENDING' ? (
                      <span className="text-xs text-amber-700">Invited — not signed in yet</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Can permission={PERMISSIONS.ADMINS_MANAGE}>
                      <button
                        onClick={() => removeAdmin.mutate(a.id)}
                        disabled={removeAdmin.isPending}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </Can>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Pencil, X, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/ErrorState';

type BuildingAdmin = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  role: 'ADMIN' | 'BUILDING_ADMIN';
  managedBlocks: string[];
  createdAt: string;
};

type Block = { block: string; flatCount: number; occupiedCount: number };

type Scope = 'SOCIETY' | 'BUILDINGS';

type CreateForm = {
  name: string;
  phone: string;
  scope: Scope;
  managedBlocks: string[];
};

export default function BuildingAdminsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editBlocks, setEditBlocks] = useState('');
  const [form, setForm] = useState<CreateForm>({ name: '', phone: '', scope: 'SOCIETY', managedBlocks: [] });

  const { data: admins = [], isLoading, isError, refetch } = useQuery<BuildingAdmin[]>({
    queryKey: ['building-admins'],
    queryFn: () => api.get<BuildingAdmin[]>('/admin/building-admins'),
  });

  const { data: blocks = [] } = useQuery<Block[]>({
    queryKey: ['admin-blocks'],
    queryFn: () => api.get<Block[]>('/admin/blocks'),
    enabled: showForm,
  });

  const toggleBlock = (b: string) =>
    setForm((f) => ({
      ...f,
      managedBlocks: f.managedBlocks.includes(b)
        ? f.managedBlocks.filter((x) => x !== b)
        : [...f.managedBlocks, b],
    }));

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/building-admins', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        scope: form.scope,
        managedBlocks: form.scope === 'BUILDINGS' ? form.managedBlocks : [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['building-admins'] });
      toast.success(form.scope === 'SOCIETY' ? 'Society admin created' : 'Building admin created');
      setShowForm(false);
      setForm({ name: '', phone: '', scope: 'SOCIETY', managedBlocks: [] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create'),
  });

  const updateBlocksMutation = useMutation({
    mutationFn: ({ id, blocks }: { id: string; blocks: string[] }) =>
      api.patch(`/admin/building-admins/${id}/blocks`, { managedBlocks: blocks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['building-admins'] });
      toast.success('Blocks updated');
      setEditId(null);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/building-admins/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['building-admins'] });
      toast.success('Building admin removed');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to remove'),
  });

  const isFormValid =
    form.name.trim() &&
    form.phone.trim() &&
    (form.scope === 'SOCIETY' || form.managedBlocks.length > 0);

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admins</h1>
          <p className="text-gray-500 text-sm mt-1">
            Society-wide admins, or admins scoped to specific buildings
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
        >
          {showForm ? 'Cancel' : <><Plus className="w-5 h-5" /> Add Admin</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">New Admin</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="+91XXXXXXXXXX"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            {/* Access scope */}
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1.5">Access scope *</label>
              <div className="inline-flex bg-gray-100 rounded-xl p-0.5">
                {([
                  { value: 'SOCIETY', label: 'Entire society' },
                  { value: 'BUILDINGS', label: 'Specific buildings' },
                ] as { value: Scope; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, scope: opt.value }))}
                    className={
                      'px-4 h-8 text-sm font-medium rounded-lg transition ' +
                      (form.scope === opt.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900')
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {form.scope === 'SOCIETY'
                  ? 'Full access across every building in the society.'
                  : 'Access limited to the selected buildings only.'}
              </p>
            </div>

            {/* Building selector — only for building-scoped admins */}
            {form.scope === 'BUILDINGS' && (
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Buildings / Blocks *</label>
                {blocks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {blocks.map((b) => {
                      const selected = form.managedBlocks.includes(b.block);
                      return (
                        <button
                          key={b.block}
                          type="button"
                          onClick={() => toggleBlock(b.block)}
                          className={
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition ' +
                            (selected
                              ? 'bg-primary-500 border-primary-500 text-white'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300')
                          }
                        >
                          {selected && <Check className="w-3.5 h-3.5" />}
                          Building {b.block}
                          <span className={selected ? 'text-white/70' : 'text-gray-400'}>
                            ({b.flatCount})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    No buildings found yet — add flats first, or use “Entire society”.
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!isFormValid || createMutation.isPending}
            className="mt-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} message="Building admins couldn't be loaded. Please try again." />
      ) : admins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
          <Building2 className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">No admins yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Add a society-wide admin, or one scoped to specific buildings</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Add Admin
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Name
                </th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Phone
                </th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Scope
                </th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Added
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{admin.name}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">{admin.phone}</td>
                  <td className="px-5 py-3">
                    {admin.role === 'ADMIN' ? (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                        Entire society
                      </span>
                    ) : editId === admin.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-primary-200"
                          value={editBlocks}
                          onChange={(e) => setEditBlocks(e.target.value)}
                          placeholder="A, B, C"
                        />
                        <button
                          onClick={() =>
                            updateBlocksMutation.mutate({
                              id: admin.id,
                              blocks: editBlocks.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          disabled={updateBlocksMutation.isPending}
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                          aria-label="Save blocks"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="text-gray-400 hover:text-gray-600"
                          aria-label="Cancel edit"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                          {admin.managedBlocks.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">All blocks</span>
                          ) : (
                            admin.managedBlocks.map((b) => (
                              <span
                                key={b}
                                className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium"
                              >
                                Building {b}
                              </span>
                            ))
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setEditId(admin.id);
                            setEditBlocks(admin.managedBlocks.join(', '));
                          }}
                          className="text-gray-400 hover:text-primary-600 ml-1 p-1 rounded"
                          aria-label="Edit blocks"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(admin.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${admin.name} as building admin?`)) {
                          deleteMutation.mutate(admin.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

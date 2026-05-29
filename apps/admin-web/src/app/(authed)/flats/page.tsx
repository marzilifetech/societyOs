'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Upload, Download, Trash2 } from 'lucide-react';
import { api, downloadAdminFile } from '@/lib/api';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/cn';

type FlatRow = {
  id: string;
  block: string;
  floor: number;
  number: string;
  areaSqft: number | null;
  residentCount: number;
  occupied: boolean;
};

type BlockRow = { block: string; flatCount: number; occupiedCount: number };

export default function FlatsPage() {
  const qc = useQueryClient();
  const [blockFilter, setBlockFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [form, setForm] = useState({ block: '', floor: '1', number: '', areaSqft: '' });

  const queryParams = new URLSearchParams();
  if (blockFilter) queryParams.set('block', blockFilter);
  if (search) queryParams.set('search', search);

  const { data: flats = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-flats', blockFilter, search],
    queryFn: () => api.get<FlatRow[]>(`/admin/flats?${queryParams.toString()}`),
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ['admin-blocks'],
    queryFn: () => api.get<BlockRow[]>('/admin/blocks'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/flats', {
        block: form.block.trim(),
        floor: parseInt(form.floor, 10),
        number: form.number.trim(),
        areaSqft: form.areaSqft ? parseFloat(form.areaSqft) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-flats'] });
      qc.invalidateQueries({ queryKey: ['admin-blocks'] });
      setShowAdd(false);
      setForm({ block: '', floor: '1', number: '', areaSqft: '' });
      toast.success('Flat added');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/flats/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-flats'] });
      qc.invalidateQueries({ queryKey: ['admin-blocks'] });
      toast.success('Flat deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewMutation = useMutation({
    mutationFn: (csv: string) => api.post('/admin/flats/import/preview', { csv }),
    onSuccess: (data) => setPreview(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: (csv: string) =>
      api.post<{ created: number; skipped: number; errors: { row: number; reason: string }[] }>(
        '/admin/flats/import',
        { csv },
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-flats'] });
      qc.invalidateQueries({ queryKey: ['admin-blocks'] });
      setShowImport(false);
      setImportCsv('');
      setPreview(null);
      toast.success(`Imported ${data.created} flats (${data.skipped} skipped)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const csv = String(reader.result ?? '');
      setImportCsv(csv);
      previewMutation.mutate(csv);
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flats & Blocks</h1>
          <p className="text-gray-500 text-sm mt-1">Manage society structure</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadAdminFile('/admin/flats/import/template', 'flats-import-template.csv').catch((e: Error) => toast.error(e.message))}
            className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 rounded-xl text-sm"
          >
            <Download className="w-4 h-4" /> Template
          </button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 rounded-xl text-sm">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" /> Add Flat
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setBlockFilter('')}
          className={cn('px-3 py-1 rounded-full text-xs border', !blockFilter ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-gray-200')}
        >
          All ({flats.length})
        </button>
        {blocks.map((b) => (
          <button
            key={b.block}
            onClick={() => setBlockFilter(b.block)}
            className={cn('px-3 py-1 rounded-full text-xs border', blockFilter === b.block ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-gray-200')}
          >
            Block {b.block} ({b.flatCount})
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search unit…"
          className="ml-auto border border-gray-200 rounded-xl px-3 py-1.5 text-sm"
        />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Block</th>
                <th className="px-4 py-3">Floor</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {flats.map((f) => (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{f.block}</td>
                  <td className="px-4 py-3">{f.floor}</td>
                  <td className="px-4 py-3 font-medium">{f.number}</td>
                  <td className="px-4 py-3">{f.areaSqft ? `${f.areaSqft} sqft` : '—'}</td>
                  <td className="px-4 py-3">
                    {f.occupied ? (
                      <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs">{f.residentCount} resident(s)</span>
                    ) : (
                      <span className="text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full text-xs">Vacant</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!f.occupied && (
                      <button onClick={() => deleteMutation.mutate(f.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3">
            <h2 className="font-semibold">Add flat</h2>
            {(['block', 'floor', 'number', 'areaSqft'] as const).map((f) => (
              <div key={f}>
                <label className="text-xs text-gray-500 capitalize">{f === 'areaSqft' ? 'Area (sqft)' : f}</label>
                <input
                  className="w-full border rounded-xl px-3 py-2 text-sm mt-1"
                  value={form[f]}
                  onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => createMutation.mutate()} className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm">Save</button>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3">
            <h2 className="font-semibold">Import flats CSV</h2>
            <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            {preview && (
              <div className="text-xs bg-gray-50 rounded-xl p-3 max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Preview: {preview.valid?.length ?? 0} valid, {preview.errors?.length ?? 0} errors</p>
                {preview.errors?.map((e: any) => (
                  <p key={e.row} className="text-red-600">Row {e.row}: {e.reason}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                disabled={!importCsv || importMutation.isPending}
                onClick={() => importMutation.mutate(importCsv)}
                className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
              >
                Import
              </button>
              <button onClick={() => { setShowImport(false); setPreview(null); }} className="text-gray-500 text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import { Megaphone, Pin, X, Plus } from 'lucide-react';

const CATEGORIES = ['GENERAL', 'MAINTENANCE', 'EVENT', 'EMERGENCY', 'FINANCE'];

interface EditNoticeForm {
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  expiresAt: string;
}

function EditNoticeModal({
  notice,
  onClose,
  onSave,
  isPending,
}: {
  notice: any;
  onClose: () => void;
  onSave: (id: string, dto: EditNoticeForm) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<EditNoticeForm>({
    title: notice.title ?? '',
    body: notice.body ?? '',
    category: notice.category ?? 'GENERAL',
    isPinned: notice.isPinned ?? false,
    expiresAt: notice.expiresAt ? notice.expiresAt.slice(0, 10) : '',
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Edit Notice</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-400 min-h-[100px] resize-none"
            placeholder="Content *"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <div className="flex gap-3">
            <select
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input
              type="date"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
              className="rounded"
            />
            Pin this notice (shows at top)
          </label>
          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              onClick={() => onSave(notice.id, form)}
              disabled={!form.title || !form.body || isPending}
            >
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              className="px-4 py-2.5 rounded-xl text-sm text-gray-600 border border-gray-200 hover:border-gray-300 transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PushForm {
  title: string;
  body: string;
  targetType: 'ALL' | 'FLAT' | 'BLOCK' | 'INDIVIDUAL';
  targetIds: string;
  scheduledAt: string;
}

export default function NoticesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<any | null>(null);
  const [showPushForm, setShowPushForm] = useState(false);
  const [pushForm, setPushForm] = useState<PushForm>({
    title: '',
    body: '',
    targetType: 'ALL',
    targetIds: '',
    scheduledAt: '',
  });

  const pushMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        title: pushForm.title.trim(),
        body: pushForm.body.trim(),
        targetType: pushForm.targetType,
      };
      if (pushForm.targetType !== 'ALL' && pushForm.targetIds.trim()) {
        payload.targetIds = pushForm.targetIds.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (pushForm.scheduledAt) {
        payload.scheduledAt = new Date(pushForm.scheduledAt).toISOString();
      }
      return api.post('/admin/notifications/push', payload);
    },
    onSuccess: () => {
      toast.success(pushForm.scheduledAt ? 'Push notification scheduled' : 'Push notification sent');
      setShowPushForm(false);
      setPushForm({ title: '', body: '', targetType: 'ALL', targetIds: '', scheduledAt: '' });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to send push notification'),
  });

  function confirmPush() {
    const target =
      pushForm.targetType === 'ALL' ? 'all residents' :
      pushForm.targetType === 'BLOCK' ? `block(s): ${pushForm.targetIds}` :
      pushForm.targetType === 'FLAT' ? `flat(s): ${pushForm.targetIds}` :
      `users: ${pushForm.targetIds}`;
    const when = pushForm.scheduledAt ? `at ${new Date(pushForm.scheduledAt).toLocaleString('en-IN')}` : 'now';
    if (!window.confirm(`Send push notification to ${target} ${when}?`)) return;
    pushMutation.mutate();
  }
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: 'GENERAL',
    isPinned: false,
    expiresAt: '',
  });

  const { data: notices, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-notices'],
    queryFn: () => api.get<any[]>('/notices'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/notices', {
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        isPinned: form.isPinned,
        expiresAt: form.expiresAt || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notices'] });
      setShowForm(false);
      setForm({ title: '', body: '', category: 'GENERAL', isPinned: false, expiresAt: '' });
      toast.success('Notice published');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to create notice'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: EditNoticeForm }) =>
      api.patch(`/notices/${id}`, {
        ...dto,
        title: dto.title.trim(),
        body: dto.body.trim(),
        expiresAt: dto.expiresAt || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notices'] });
      setEditingNotice(null);
      toast.success('Notice updated');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update notice'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notices'] });
      toast.success('Notice deleted');
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to delete notice'),
  });

  const unpinMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notices/${id}/unpin`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-notices'] }),
    onError: (err: any) => toast.error(err?.message ?? 'Failed to unpin notice'),
  });

  const pinMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notices/${id}/pin`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-notices'] }),
    onError: (err: any) => toast.error(err?.message ?? 'Failed to toggle pin'),
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this notice? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      {editingNotice && (
        <EditNoticeModal
          notice={editingNotice}
          onClose={() => setEditingNotice(null)}
          onSave={(id, dto) => editMutation.mutate({ id, dto })}
          isPending={editMutation.isPending}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notices</h1>
        <div className="flex gap-2">
          <button
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
            onClick={() => { setShowPushForm(!showPushForm); setShowForm(false); }}
          >
            {showPushForm ? <><X className="w-4 h-4" /> Cancel</> : 'Send Push'}
          </button>
          <button
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors inline-flex items-center gap-1.5"
            onClick={() => { setShowForm(!showForm); setShowPushForm(false); }}
          >
            {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Notice</>}
          </button>
        </div>
      </div>

      {/* Push Notification Form */}
      {showPushForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Send Push Notification</h2>
          <div className="space-y-3">
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              placeholder="Title *"
              value={pushForm.title}
              onChange={(e) => setPushForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-400 min-h-[80px] resize-none"
              placeholder="Message body *"
              value={pushForm.body}
              onChange={(e) => setPushForm((f) => ({ ...f, body: e.target.value }))}
            />
            <div className="flex gap-3">
              <select
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                value={pushForm.targetType}
                onChange={(e) => setPushForm((f) => ({ ...f, targetType: e.target.value as PushForm['targetType'] }))}
              >
                <option value="ALL">All Residents</option>
                <option value="BLOCK">Specific Block</option>
                <option value="FLAT">Specific Flat(s)</option>
                <option value="INDIVIDUAL">Individual User IDs</option>
              </select>
              {pushForm.targetType !== 'ALL' && (
                <input
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                  placeholder={
                    pushForm.targetType === 'BLOCK' ? 'Block names, comma-separated' :
                    pushForm.targetType === 'FLAT' ? 'Flat numbers, comma-separated' :
                    'User IDs, comma-separated'
                  }
                  value={pushForm.targetIds}
                  onChange={(e) => setPushForm((f) => ({ ...f, targetIds: e.target.value }))}
                />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Schedule (leave blank to send now)</label>
              <input
                type="datetime-local"
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                value={pushForm.scheduledAt}
                onChange={(e) => setPushForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>
            <button
              className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-600 transition-colors"
              onClick={confirmPush}
              disabled={!pushForm.title.trim() || !pushForm.body.trim() || pushMutation.isPending}
            >
              {pushMutation.isPending ? 'Sending…' : pushForm.scheduledAt ? 'Schedule Push' : 'Send Now'}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Notice</h2>
          <div className="space-y-4">
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-400 min-h-[100px] resize-none"
              placeholder="Content *"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            <div className="flex gap-3">
              <select
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                type="date"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                placeholder="Expires at (optional)"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
                className="rounded"
              />
              Pin this notice (shows at top)
            </label>
            <button
              className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              onClick={() => createMutation.mutate()}
              disabled={!form.title || !form.body || createMutation.isPending}
            >
              {createMutation.isPending ? 'Publishing…' : 'Publish Notice'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Notices couldn't be loaded. Your data is safe — please try again." />
        ) : !notices?.length ? (
          <div className="py-16 flex flex-col items-center text-center bg-white rounded-2xl border border-gray-200">
            <Megaphone className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No notices yet</p>
            <p className="text-gray-400 text-sm mt-1">Publish your first notice to broadcast updates to residents.</p>
            <button
              className="mt-4 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 inline-flex items-center gap-1.5"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-4 h-4" /> New Notice
            </button>
          </div>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {notice.isPinned && <Pin className="w-4 h-4 text-amber-500" />}
                  <h3 className="font-semibold text-gray-900">{notice.title}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    {notice.category}
                  </span>
                  {notice.targetAudience && notice.targetAudience !== 'ALL' && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
                      {notice.targetAudience}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(notice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  <button
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-lg transition-colors border inline-flex items-center gap-1',
                      notice.isPinned
                        ? 'text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300 bg-amber-50'
                        : 'text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300',
                    )}
                    onClick={() => pinMutation.mutate(notice.id)}
                    disabled={pinMutation.isPending}
                    title={notice.isPinned ? 'Unpin' : 'Pin to top'}
                    aria-label={notice.isPinned ? 'Unpin notice' : 'Pin notice'}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {notice.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    className="text-xs text-gray-600 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-2.5 py-1 rounded-lg transition-colors"
                    onClick={() => setEditingNotice(notice)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 px-2.5 py-1 rounded-lg transition-colors"
                    onClick={() => handleDelete(notice.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-5 line-clamp-2">{notice.body}</p>
              {notice.expiresAt && (
                <p className="text-xs text-amber-500 mt-2">
                  Expires {new Date(notice.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

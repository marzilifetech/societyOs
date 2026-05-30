'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Pin, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type Post = {
  id: string;
  title?: string;
  content: string;
  authorName?: string;
  isPinned: boolean;
  createdAt: string;
  category?: string;
};

const FILTER_OPTIONS = ['ALL', 'PINNED'] as const;
type Filter = typeof FILTER_OPTIONS[number];

export default function CommunityPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: posts, isLoading, isError, refetch } = useQuery<Post[]>({
    queryKey: ['admin-community-posts'],
    queryFn: async () => {
      const res = await api.get<any>('/community/posts');
      // API returns { posts: [...], total, page, limit }
      const raw: any[] = Array.isArray(res) ? res : (res?.posts ?? []);
      return raw.map((p) => ({
        id: p.id,
        content: p.content,
        isPinned: p.isPinned ?? false,
        isAnonymous: p.isAnonymous ?? false,
        authorName: p.isAnonymous ? 'Anonymous' : (p.resident?.user?.name ?? null),
        createdAt: p.createdAt,
        title: p.title ?? null,
        category: p.category ?? null,
      })) as Post[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/community/posts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-community-posts'] });
      toast.success('Post deleted');
      setDeletingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) => api.patch(`/community/posts/${id}/pin`, { isPinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-community-posts'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = posts?.filter((p) => filter === 'ALL' || (filter === 'PINNED' && p.isPinned)) ?? [];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Community Board</h1>
        <p className="text-gray-500 text-sm mt-1">{posts?.length ?? 0} posts · Moderate and pin community posts</p>
      </div>

      <div className="flex gap-2 mb-6">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              filter === f ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {f === 'ALL' ? `All (${posts?.length ?? 0})` : `Pinned (${posts?.filter((p) => p.isPinned).length ?? 0})`}
          </button>
        ))}
      </div>

      {isLoading && <div className="py-16 text-center text-gray-400">Loading…</div>}
      {isError && <ErrorState onRetry={refetch} message="Community posts couldn't be loaded. Your data is safe — please try again." />}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 flex flex-col items-center text-center">
          <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">
            {filter === 'PINNED' ? 'No pinned posts' : 'No community posts yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {filter === 'PINNED' ? 'Pin a post to highlight it for residents' : 'Posts shared by residents will appear here'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((post) => (
          <div key={post.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {post.isPinned && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                  {post.category && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{post.category}</span>
                  )}
                </div>
                {post.title && <h3 className="font-semibold text-gray-900 mb-1">{post.title}</h3>}
                <p className="text-sm text-gray-600 line-clamp-3">{post.content}</p>
                <div className="flex items-center gap-3 mt-2">
                  {post.authorName && <span className="text-xs text-gray-500">{post.authorName}</span>}
                  <span className="text-xs text-gray-400">
                    {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => pinMutation.mutate({ id: post.id, isPinned: !post.isPinned })}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors',
                    post.isPinned
                      ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                  )}
                >
                  <Pin className="w-3.5 h-3.5" />
                  {post.isPinned ? 'Unpin' : 'Pin'}
                </button>

                {deletingId === post.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Confirm?</span>
                    <button
                      onClick={() => deleteMutation.mutate(post.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                    </button>
                    <button onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(post.id)}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

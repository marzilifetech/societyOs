'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, ExternalLink, Trash2 } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { Button, Modal, cn } from '@/components/primitives';
import { LoadingRows, ErrorRetry, cardClass } from '../../_components';

interface HealthRecord {
  id: string;
  name: string;
  type: string;
  date: string;
  uploadedAt: string;
  fileType: 'pdf' | 'image';
  url: string;
  shareUrl?: string;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[13px] text-gray-500">{label}</span>
      <span className="text-[13px] font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default function RecordDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<HealthRecord>({
    queryKey: ['health-record', id],
    queryFn: () => careApi.get<HealthRecord>(`/health/records/${id}`),
    enabled: !!id,
  });

  const { mutate: deleteRecord, isPending: deleting } = useMutation({
    mutationFn: () => careApi.delete(`/health/records/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-records'] });
      toast.success('Record deleted');
      router.back();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not delete record.'),
  });

  return (
    <>
      <CareHeader title={data?.name ?? 'Health record'} back />

      <CareBody>
        {isLoading && <LoadingRows count={2} />}
        {isError && <ErrorRetry message="Could not load record." onRetry={() => refetch()} />}

        {data && (
          <>
            {/* Preview */}
            {data.fileType === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.url}
                alt={data.name}
                className="w-full rounded-2xl mb-4 bg-gray-100 object-contain max-h-80"
              />
            ) : (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(cardClass, 'p-8 mb-4 flex flex-col items-center justify-center active:bg-gray-50 transition-colors')}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
                  <FileText className="w-7 h-7" />
                </div>
                <p className="text-[14px] font-semibold text-gray-900">Open document</p>
                <p className="text-[12px] text-gray-500 mt-0.5">Opens in a new tab</p>
              </a>
            )}

            {/* Metadata */}
            <div className={cn(cardClass, 'px-4 py-2 mb-4')}>
              <MetaRow label="Type" value={data.type} />
              <MetaRow label="Date" value={new Date(data.date).toLocaleDateString()} />
              <MetaRow label="Uploaded" value={new Date(data.uploadedAt).toLocaleDateString()} />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button
                  variant="secondary"
                  fullWidth
                  className="h-12 rounded-xl"
                  leadingIcon={<ExternalLink className="w-4 h-4" />}
                >
                  Open
                </Button>
              </a>
              <Button
                variant="danger"
                className="h-12 rounded-xl flex-1"
                leadingIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => setConfirmOpen(true)}
              >
                Delete
              </Button>
            </div>
          </>
        )}
      </CareBody>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete record?"
        description="This permanently removes the document from your health records. This can't be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => deleteRecord()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-gray-600">
          {data ? `“${data.name}” will be deleted.` : 'This record will be deleted.'}
        </p>
      </Modal>
    </>
  );
}

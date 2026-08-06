'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UploadCloud, CheckCircle2, FileText, X } from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { Button, Field, Input, cn } from '@/components/primitives';
import { uploadViaCareMedia, cardClass } from '../../_components';

const DOC_TYPES = ['Prescription', 'Lab Report', 'Scan / X-Ray', 'Vaccination', 'Insurance', 'Other'];

export default function UploadRecordPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState('');
  const [docDate, setDocDate] = useState('');
  const [docName, setDocName] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      careApi.post('/health/records', {
        type: docType,
        date: docDate,
        name: docName.trim(),
        fileKey: uploadedKey,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-records'] });
      toast.success('Record uploaded');
      router.back();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not upload record.'),
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setUploadedKey(null);
    setUploading(true);
    try {
      const { s3Key } = await uploadViaCareMedia(file, 'private');
      setUploadedKey(s3Key);
      if (!docName.trim()) setDocName(file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      setFileName(null);
      setUploadedKey(null);
      toast.error(err instanceof Error ? err.message : 'Could not upload file.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docType) {
      toast.error('Select a document type.');
      return;
    }
    if (!docName.trim()) {
      toast.error('Enter a document name.');
      return;
    }
    if (!uploadedKey) {
      toast.error('Please choose a file.');
      return;
    }
    mutate();
  };

  return (
    <>
      <CareHeader title="Upload record" back />

      <CareBody>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Document type */}
          <div>
            <p className="text-[13px] font-medium text-gray-800 mb-2">Document type</p>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map((t) => {
                const active = docType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDocType(t)}
                    className={cn(
                      'h-11 px-4 rounded-xl border text-[13px] font-semibold transition-colors',
                      active
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date */}
          <Field label="Document date">
            <input
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white text-[14px] text-gray-900 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            />
          </Field>

          {/* Name */}
          <Field label="Document name" required>
            <Input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. CBC Report Jan 2026"
              className="h-12 rounded-xl"
            />
          </Field>

          {/* File picker */}
          <div>
            <p className="text-[13px] font-medium text-gray-800 mb-2">File</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {!fileName ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  cardClass,
                  'w-full py-8 flex flex-col items-center justify-center border-dashed border-gray-300 active:bg-gray-50 transition-colors',
                )}
              >
                <UploadCloud className="w-7 h-7 text-primary-600 mb-2" />
                <span className="text-[13px] font-semibold text-gray-700">Choose a file</span>
                <span className="text-[11px] text-gray-400 mt-0.5">Image or PDF</span>
              </button>
            ) : (
              <div className={cn(cardClass, 'px-4 py-3.5 flex items-center gap-3')}>
                <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  {uploading ? <UploadCloud className="w-4 h-4 animate-pulse" /> : <FileText className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-900 truncate">{fileName}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    {uploading ? (
                      'Uploading…'
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-600" /> Ready to save
                      </>
                    )}
                  </p>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => {
                      setFileName(null);
                      setUploadedKey(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            fullWidth
            loading={isPending}
            disabled={uploading}
            className="h-12 rounded-xl"
          >
            {isPending ? 'Saving…' : 'Upload record'}
          </Button>
        </form>
      </CareBody>
    </>
  );
}

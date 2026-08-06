'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Upload,
  ChevronRight,
  FileText,
  FlaskConical,
  ScanLine,
  Syringe,
  ShieldCheck,
  Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react';
import { careApi } from '@/lib/care-api';
import { CareHeader, CareBody } from '@/components/care/chrome';
import { Button, cn } from '@/components/primitives';
import { LoadingRows, ErrorRetry, cardClass } from '../_components';

interface HealthRecord {
  id: string;
  name: string;
  type: string;
  date: string;
  fileType: string;
}

interface RecordsData {
  prescriptions: HealthRecord[];
  labReports: HealthRecord[];
  scans: HealthRecord[];
  vaccination: HealthRecord[];
  insurance: HealthRecord[];
}

const CATEGORIES: { key: keyof RecordsData; label: string; Icon: LucideIcon; tint: string }[] = [
  { key: 'prescriptions', label: 'Prescriptions', Icon: FileText, tint: 'bg-violet-50 text-violet-600' },
  { key: 'labReports', label: 'Lab Reports', Icon: FlaskConical, tint: 'bg-sky-50 text-sky-600' },
  { key: 'scans', label: 'Scans & Imaging', Icon: ScanLine, tint: 'bg-orange-50 text-orange-600' },
  { key: 'vaccination', label: 'Vaccination', Icon: Syringe, tint: 'bg-green-50 text-green-600' },
  { key: 'insurance', label: 'Insurance', Icon: ShieldCheck, tint: 'bg-cyan-50 text-cyan-600' },
];

export default function RecordsPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery<RecordsData>({
    queryKey: ['health-records'],
    queryFn: () => careApi.get<RecordsData>('/health/records'),
  });

  return (
    <>
      <CareHeader
        title="Health records"
        back
        right={
          <Button
            size="sm"
            leadingIcon={<Upload className="w-4 h-4" />}
            onClick={() => router.push('/care/health/records/upload')}
          >
            Upload
          </Button>
        }
      />

      <CareBody>
        {isLoading && <LoadingRows count={4} />}
        {isError && <ErrorRetry message="Could not load records." onRetry={() => refetch()} />}

        {data &&
          CATEGORIES.map((cat) => {
            const records = data[cat.key] ?? [];
            return (
              <section key={cat.key} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center', cat.tint)}>
                    <cat.Icon className="w-4 h-4" />
                  </span>
                  <h2 className="text-[14px] font-bold text-gray-950">{cat.label}</h2>
                  {records.length > 0 && (
                    <span className="text-[12px] text-gray-400">({records.length})</span>
                  )}
                </div>

                {records.length === 0 ? (
                  <div className={cn(cardClass, 'px-4 py-4 text-center')}>
                    <p className="text-[12px] text-gray-400">No {cat.label.toLowerCase()} uploaded</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {records.map((rec) => (
                      <li key={rec.id}>
                        <Link
                          href={`/care/health/records/${rec.id}`}
                          className={cn(cardClass, 'px-4 py-3.5 flex items-center gap-3 active:bg-gray-50 transition-colors')}
                        >
                          <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                            {rec.fileType === 'pdf' ? (
                              <FileText className="w-5 h-5" />
                            ) : (
                              <ImageIcon className="w-5 h-5" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-gray-950 truncate">
                              {rec.name}
                            </span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">
                              {new Date(rec.date).toLocaleDateString()}
                            </span>
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
      </CareBody>
    </>
  );
}

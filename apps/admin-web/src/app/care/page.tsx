'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Stethoscope, HeartPulse, CalendarDays, Pill, FileText, LogOut } from 'lucide-react';
import { useCareAuth } from '@/store/care-auth.store';
import { BottomNav, CareBody } from '@/components/care/chrome';

const QUICK = [
  {
    href: '/care/medical',
    title: 'Medical',
    desc: 'Doctors & appointments',
    icon: Stethoscope,
    tint: 'bg-primary-50 text-primary-700',
  },
  {
    href: '/care/health',
    title: 'Health',
    desc: 'Vitals, meds & records',
    icon: HeartPulse,
    tint: 'bg-teal-50 text-teal-700',
  },
  {
    href: '/care/medical/appointments',
    title: 'My appointments',
    desc: 'Upcoming & past visits',
    icon: CalendarDays,
    tint: 'bg-indigo-50 text-indigo-700',
  },
  {
    href: '/care/health/medications',
    title: 'Medications',
    desc: "Today's reminders",
    icon: Pill,
    tint: 'bg-amber-50 text-amber-700',
  },
  {
    href: '/care/health/records',
    title: 'Records',
    desc: 'Reports & documents',
    icon: FileText,
    tint: 'bg-sky-50 text-sky-700',
  },
];

export default function CareHome() {
  const router = useRouter();
  const user = useCareAuth((s) => s.user);
  const clearAuth = useCareAuth((s) => s.clearAuth);
  const pending = user && user.status && user.status !== 'ACTIVE';

  return (
    <>
      {/* Slim, generic top bar — no personal name/society, just the wordmark. */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 h-14 px-5 flex items-center justify-between">
        <span className="text-[16px] font-semibold tracking-tight text-primary-800">Marzi Care</span>
        <button
          onClick={() => {
            clearAuth();
            router.replace('/care/login');
          }}
          aria-label="Sign out"
          className="w-9 h-9 -mr-1.5 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <CareBody>
        {pending && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[13px] font-medium text-amber-900">Awaiting approval</p>
            <p className="text-[12px] text-amber-800 mt-0.5">
              Your society admin needs to approve your account before you can book appointments or
              log health data.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {QUICK.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm active:bg-gray-50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${q.tint}`}>
                <q.icon className="w-5 h-5" />
              </div>
              <p className="text-[14px] font-semibold text-gray-950 mt-3">{q.title}</p>
              <p className="text-[12px] text-gray-500 mt-0.5">{q.desc}</p>
            </Link>
          ))}
        </div>
      </CareBody>

      <BottomNav />
    </>
  );
}

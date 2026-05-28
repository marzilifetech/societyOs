import { Sidebar } from '@/components/layout/Sidebar';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

// Opt the entire authed route segment OUT of static generation. These pages
// are runtime-only dashboards: every child component reads from React Query,
// localStorage, useSearchParams, etc. — none of it is statically pre-renderable
// and Next.js 15 will deopt the build (`useSearchParams() should be wrapped
// in a Suspense boundary`) the moment any child uses one of those hooks
// without Suspense. Rather than chase Suspense wrappers across 40+ pages,
// declare the segment dynamic. Amplify is provisioned as WEB_COMPUTE (SSR),
// so dynamic rendering is the supported and intended runtime mode here.
//
// See: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic
export const dynamic = 'force-dynamic';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* OfflineBanner renders nothing when online; absolutely-positioned at
          top when offline so users get honest network feedback instead of
          opaque "Something went wrong" errors. */}
      <OfflineBanner />
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}

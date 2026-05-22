import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ToastProvider } from '@/components/ui/ToastProvider';

export const metadata: Metadata = {
  title: 'SocietyOS Admin',
  description: 'Society management dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <OfflineBanner />
        <Providers>{children}</Providers>
        <ToastProvider />
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { LegalShell, H2, P, Bullets } from '@/components/legal/LegalShell';

// Public support page: the App Store "Support URL" for One Community by Marzi.
// App Review requires that URL to lead to a way to contact us and get help.
export const metadata: Metadata = {
  title: 'Support — One Community by Marzi',
  description:
    'Get help with One Community by Marzi: signing in, visitors, maintenance bills, notifications and your account. Contact support@marzi.in.',
};

const ACCENT = '#821A52';
const MAILTO =
  'mailto:support@marzi.in?subject=One%20Community%20support&body=Society%3A%20%0ARegistered%20mobile%20number%3A%20%0AWhat%20happened%3A%20';

export default function SupportPage() {
  return (
    <LegalShell title="Support" subtitle="One Community by Marzi" updated="6 November 2026">
      <section>
        <P>
          <strong>One Community by Marzi</strong> is the resident app for your residential society:
          approve visitors at the gate, see maintenance bills, book services, read notices, vote in
          polls and raise an emergency SOS. If something is not working, we are here to help.
        </P>
      </section>

      <section>
        <H2>Contact us</H2>
        <P>
          Email{' '}
          <a href="mailto:support@marzi.in" className="font-medium" style={{ color: ACCENT }}>
            support@marzi.in
          </a>{' '}
          with your society name and registered mobile number. We reply within 2 business days.
        </P>
        <div className="mt-4">
          <a
            href={MAILTO}
            className="inline-flex items-center rounded-xl px-5 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            Email support
          </a>
        </div>
        <P>Marzi Agetech Private Limited, Bengaluru, Karnataka, India.</P>
      </section>

      <section>
        <H2>Signing in</H2>
        <Bullets
          items={[
            <>
              Open the app, choose your society, enter the mobile number registered with your
              society office, and enter the 4-digit code we send by SMS.
            </>,
            <>
              <strong>My society is not listed</strong> — your society has not joined One Community
              yet. Ask your society office or email us.
            </>,
            <>
              <strong>My number is not recognised</strong> — your society office registers each
              resident. Ask them to add your number, or to update it if it has changed.
            </>,
            <>
              <strong>I did not get the code</strong> — check the number, wait a minute and tap
              resend. SMS can be delayed by your network.
            </>,
          ]}
        />
      </section>

      <section>
        <H2>Using the app</H2>
        <Bullets
          items={[
            <>
              <strong>Visitors</strong> — when security logs a guest for your flat, you get a
              notification to approve or reject. Pending visitors also appear on the Home screen.
            </>,
            <>
              <strong>Maintenance bills</strong> — the app shows your bills, due dates and payments
              recorded by your society office. Payments are made at your society office; the app
              does not take payments.
            </>,
            <>
              <strong>Notifications</strong> — if you are not receiving alerts, allow notifications
              for One Community in your phone&apos;s Settings.
            </>,
            <>
              <strong>Emergency SOS</strong> — alerts your society&apos;s security desk and
              administrators. In a life-threatening emergency, always call 112 as well.
            </>,
          ]}
        />
      </section>

      <section>
        <H2>Your account and data</H2>
        <P>
          You can delete your account inside the app: <strong>Profile</strong> →{' '}
          <strong>Settings</strong> → <strong>Delete account</strong>. See{' '}
          <a href="/account-deletion" className="font-medium" style={{ color: ACCENT }}>
            Delete your account
          </a>{' '}
          for other options, and our{' '}
          <a href="/privacy-policy" className="font-medium" style={{ color: ACCENT }}>
            Privacy Policy
          </a>{' '}
          for how we handle your data. One Community contains no advertising and does not track you.
        </P>
      </section>
    </LegalShell>
  );
}

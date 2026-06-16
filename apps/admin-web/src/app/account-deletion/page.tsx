import type { Metadata } from 'next';
import { LegalShell, H2, P, Bullets } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Delete Your Account — Resident App - Marzi & Staff App - Marzi',
  description:
    'How to delete your account and personal data from the Resident App - Marzi and Staff App - Marzi.',
};

const ACCENT = '#821A52';
const MAILTO =
  'mailto:support@marzi.in?subject=Delete%20My%20Account%20Request&body=App%20(Resident%20or%20Staff)%3A%20%0ARegistered%20mobile%20number%3A%20%0AReason%20(optional)%3A%20';

export default function AccountDeletionPage() {
  return (
    <LegalShell
      title="Delete Your Account"
      subtitle="Resident App - Marzi & Staff App - Marzi"
      updated="17 June 2026"
    >
      <section>
        <P>
          This page explains how to delete your account and personal data from{' '}
          <strong>Resident App - Marzi</strong> and <strong>Staff App - Marzi</strong>, developed by
          Marzi. You can delete your account directly inside the app, or request deletion from this
          page if you can no longer sign in.
        </P>
      </section>

      <section>
        <H2>Option 1 — Delete in the app (fastest)</H2>
        <P>
          <strong>Resident App - Marzi:</strong> open the app → tap the <strong>Profile</strong> tab
          → scroll to the bottom → tap <strong>Delete Account</strong> → confirm.
        </P>
        <P>
          <strong>Staff App - Marzi:</strong> open the app → tap the <strong>Profile</strong> tab →
          tap <strong>Delete Account</strong> → confirm.
        </P>
        <P>
          Your account is signed out immediately and your personal data is erased or anonymised as
          described below.
        </P>
      </section>

      <section>
        <H2>Option 2 — Request deletion by email</H2>
        <P>
          If you cannot access the app, send a deletion request from the email address or for the
          mobile number registered with your account. Include which app you use (Resident or Staff)
          and your registered mobile number so we can verify and locate your account.
        </P>
        <div className="mt-4">
          <a
            href={MAILTO}
            className="inline-flex items-center rounded-xl px-5 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            Request account deletion
          </a>
        </div>
        <P>
          We verify every request and complete it within <strong>7 business days</strong>. We may
          ask you to confirm details to protect your account from unauthorised deletion.
        </P>
      </section>

      <section>
        <H2>What is deleted</H2>
        <P>When your account is deleted, we remove or anonymise the personal data linked to it:</P>
        <Bullets
          items={[
            'Your name, email address, and mobile number.',
            'Identity / KYC documents you uploaded (Aadhaar, PAN, ID proof, address proof).',
            'Photos you uploaded (profile, visitor, complaint, and task photos).',
            'Your device push-notification token.',
            'Your community posts and comments are removed or anonymised.',
            'Your account is deactivated and can no longer be used to sign in.',
          ]}
        />
      </section>

      <section>
        <H2>What we keep, and why</H2>
        <P>
          To meet legal, security, audit, and accounting obligations — and as permitted by the
          Digital Personal Data Protection Act, 2023 — we retain a minimal, de-identified record
          (for example, audit logs and any financial records we are legally required to keep) for
          the applicable statutory period. This retained data is anonymised and cannot be used to
          identify you. Emergency (SOS) and complaint records linked to your account are anonymised
          rather than removed, so community safety history stays intact without identifying you.
        </P>
      </section>

      <section>
        <H2>Timeline</H2>
        <Bullets
          items={[
            'In-app deletion: access is removed immediately; personal data is erased or anonymised right away.',
            'Email request: completed within 7 business days of verification.',
          ]}
        />
      </section>

      <section>
        <H2>Need help?</H2>
        <P>
          Email{' '}
          <a href="mailto:support@marzi.in" className="font-medium" style={{ color: ACCENT }}>
            support@marzi.in
          </a>{' '}
          and we will assist you. See our{' '}
          <a href="/privacy-policy" className="font-medium" style={{ color: ACCENT }}>
            Privacy Policy
          </a>{' '}
          for full details on how we handle your data.
        </P>
      </section>
    </LegalShell>
  );
}

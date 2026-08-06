import type { Metadata } from 'next';
import { LegalShell, H2, P, Bullets } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Privacy Policy — Resident App - Marzi & Staff App - Marzi',
  description:
    'How Marzi collects, uses, shares, and protects your personal data in the Resident App - Marzi and Staff App - Marzi.',
};

const ACCENT = '#821A52';

export default function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="Resident App - Marzi & Staff App - Marzi"
      updated="17 June 2026"
    >
      <section>
        <P>
          This Privacy Policy explains how Marzi (“we”, “us”, “our”) collects, uses, shares, and
          protects your personal data when you use our mobile applications{' '}
          <strong>Resident App - Marzi</strong> and <strong>Staff App - Marzi</strong> (together,
          the “Apps”). The Apps help residential communities manage visitors, deliveries,
          complaints, staff tasks, safety alerts, and resident services. We operate from Bengaluru,
          Karnataka, India. For any privacy question, email{' '}
          <a href="mailto:support@marzi.in" className="font-medium" style={{ color: ACCENT }}>
            support@marzi.in
          </a>
          .
        </P>
      </section>

      <section>
        <H2>1. Information we collect</H2>
        <P>We collect only the data needed to operate the Apps:</P>
        <Bullets
          items={[
            <>
              <strong>Account &amp; identity</strong> — your mobile phone number (used to sign in
              via one-time password), name, and optionally email address.
            </>,
            <>
              <strong>Identity verification documents (Resident App)</strong> — KYC documents you
              choose to upload for your society office, such as Aadhaar, PAN, an ID proof, and an
              address proof.
            </>,
            <>
              <strong>Photos and media</strong> — images you choose to capture or upload, such as
              visitor photos, complaint photos, profile photos, and (Staff App) task and gate-entry
              photos.
            </>,
            <>
              <strong>Location (Staff App)</strong> — precise GPS location captured only at the
              moment a staff member takes a task verification photo or raises an emergency SOS
              alert. This is used in the foreground only; we do not track location in the
              background. In the Resident App, location is used only if you raise an Emergency SOS
              alert.
            </>,
            <>
              <strong>Community content</strong> — posts and comments you choose to share with other
              residents of your society.
            </>,
            <>
              <strong>Device &amp; technical data</strong> — a device notification token (to deliver
              push notifications), the app version, and crash-diagnostic data (Staff App, via
              Sentry) which includes a non-identifying user reference.
            </>,
          ]}
        />
        <P>
          We do <strong>not</strong> collect any advertising identifier (IDFA / Advertising ID), and
          the Apps contain no third-party advertising or cross-app tracking.
        </P>
      </section>

      <section>
        <H2>2. How we use your data</H2>
        <Bullets
          items={[
            'Authenticate you securely using a one-time password (OTP).',
            'Provide the core features: visitor and delivery management, complaints, staff tasks, the resident directory, community posts, and notices.',
            'Send you push notifications about visitors, deliveries, tasks, and emergencies.',
            'Keep the community safe, including processing SOS / emergency alerts and sharing your location with security or operations during an alert.',
            'Verify resident identity for your society office using the KYC documents you provide.',
            'Diagnose crashes and improve reliability.',
            'Meet legal, audit, and security obligations.',
          ]}
        />
      </section>

      <section>
        <H2>3. Legal basis</H2>
        <P>
          We process your personal data under the Digital Personal Data Protection Act, 2023
          (India) on the basis of your consent and for the legitimate purpose of operating your
          residential community. You may withdraw consent at any time by deleting your account (see
          Section 7).
        </P>
      </section>

      <section>
        <H2>4. How we share your data</H2>
        <P>We do not sell your personal data. We share it only as needed to run the Apps:</P>
        <Bullets
          items={[
            <>
              <strong>Your society</strong> — the management committee, administrators, and security
              staff of your community, for the functions above.
            </>,
            <>
              <strong>Service providers</strong> — cloud hosting and storage (Amazon Web Services,
              India region), our authentication / OTP provider (Marzi), and crash diagnostics
              (Sentry). These providers process data only on our instructions.
            </>,
            <>
              <strong>Legal</strong> — where required by law, regulation, or valid legal process.
            </>,
          ]}
        />
      </section>

      <section>
        <H2>5. Data security</H2>
        <P>
          All data is encrypted in transit using HTTPS. We apply role-based access controls, store
          data in secured systems, and maintain an audit trail of administrative actions. No method
          of transmission or storage is completely secure, but we take reasonable measures to
          protect your information.
        </P>
      </section>

      <section>
        <H2>6. Data retention</H2>
        <P>
          We keep your personal data while your account is active. When you delete your account, we
          erase or anonymise your personal data (see Section 7). We retain a minimal,
          de-identified record where required for audit, security, fraud-prevention, or legal and
          accounting obligations. Accounts that remain inactive for three years are automatically
          anonymised.
        </P>
      </section>

      <section>
        <H2>7. Your rights and choices</H2>
        <P>
          Under the Digital Personal Data Protection Act, 2023 you may access, correct, or export
          your data, withdraw consent, and request deletion of your account and associated personal
          data. You can delete your account directly inside either App (Profile → Delete Account),
          or follow the steps on our{' '}
          <a href="/account-deletion" className="font-medium" style={{ color: ACCENT }}>
            Account Deletion page
          </a>
          .
        </P>
      </section>

      <section>
        <H2>8. Children</H2>
        <P>
          The Apps are intended for adult residents and staff of a registered residential community
          and are not directed to children under 18.
        </P>
      </section>

      <section>
        <H2>9. Changes to this policy</H2>
        <P>
          We may update this Privacy Policy from time to time. When we do, we will revise the “Last
          updated” date above and, where appropriate, notify you in the Apps.
        </P>
      </section>

      <section>
        <H2>10. Contact us</H2>
        <P>
          For any privacy request or grievance, contact our Grievance Officer at{' '}
          <a href="mailto:support@marzi.in" className="font-medium" style={{ color: ACCENT }}>
            support@marzi.in
          </a>
          , Marzi, Bengaluru, Karnataka, India. We will respond within the timelines required by
          applicable law.
        </P>
      </section>
    </LegalShell>
  );
}

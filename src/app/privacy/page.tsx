import Link from "next/link";
import { RETENTION } from "@/lib/retention";
export const metadata = { title: "Privacy notice" };

const H2 = "mt-12 font-display text-d-sm";
export default function Privacy() {
  return (
    <article className="container-x pb-16 max-w-3xl [&_p]:mt-4 [&_p]:text-muted [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ul]:text-muted [&_li]:max-w-prose">
      <header className="pt-10 sm:pt-14">
        <h1 className="display-lg">Privacy notice</h1>
        <p className="!text-ink lede">How FITSYNC handles your personal data, described as the software actually works.</p>
      </header>
      <div className="mt-8 rounded-md border border-warn/40 bg-warn/5 p-4 text-sm">
        <p className="!mt-0 !text-ink font-medium">Draft, pending review</p>
        <p className="!mt-1">This notice has not yet been reviewed by a lawyer. Before public launch, the operator of this site must add its legal identity, contact details and grievance contact, and have the notice reviewed under India’s Digital Personal Data Protection Act, 2023 and any other law that applies. It does not claim compliance with any law.</p>
      </div>

      <h2 className={H2}>Who is responsible</h2>
      <p>To be completed by the operator before launch: legal name of the business, registered address, and a contact for privacy questions and grievances. Until then, this site should not be advertised publicly.</p>

      <h2 className={H2}>What we collect</h2>
      <ul>
        <li><strong className="text-ink font-medium">Account:</strong> your email address, an optional name, and your password stored only as a one-way Argon2id hash (older accounts may hold a bcrypt hash until their next login).</li>
        <li><strong className="text-ink font-medium">Body measurements</strong> you choose to enter (all optional), your unit, sizing type and fit preference.</li>
        <li><strong className="text-ink font-medium">Recommendations you save</strong>, including the measurements used at that moment, and <strong className="text-ink font-medium">fit reports</strong> you send.</li>
        <li><strong className="text-ink font-medium">Saved brands.</strong></li>
        <li><strong className="text-ink font-medium">Security records:</strong> signed-in sessions (with a short browser description such as “Chrome on Android”), sign-in events, and a keyed hash of your IP address. We do not store your raw IP address.</li>
      </ul>
      <p>We do not ask for or accept photos or body scans. We do not use advertising trackers or analytics cookies.</p>

      <h2 className={H2}>Cookies</h2>
      <ul>
        <li>A session cookie that keeps you signed in (HttpOnly, Secure, SameSite=Lax).</li>
        <li>A security cookie that protects forms against cross-site request forgery.</li>
        <li>Your light/dark theme choice, stored in your browser only.</li>
      </ul>

      <h2 className={H2}>Why we use it</h2>
      <p>To recommend clothing sizes to you, to keep your account secure, and to improve recommendations from fit reports. Your measurements are never shown publicly, never sold, and never included in public statistics. Administrators can see account details (email, sign-up date, role) to run the service; the admin screens do not display your measurements.</p>

      <h2 className={H2}>Who processes it</h2>
      <p>To be completed by the operator: the hosting provider, database provider, transactional email provider (for confirmation and reset emails) and rate-limiting store actually used in production, with their locations. FITSYNC sends your email address to the email provider only to deliver those messages.</p>

      <h2 className={H2}>How long we keep it</h2>
      <ul>
        <li>Account data, measurements, recommendations and fit reports: until you delete them or your account.</li>
        <li>Ended sessions: deleted {RETENTION.sessionsDays} days after they expire or are signed out.</li>
        <li>Email confirmation and password reset links: deleted {RETENTION.tokensDays} days after they expire or are used.</li>
        <li>Sign-in security events: {RETENTION.authEventsDays} days.</li>
        <li>Administrator action records (changes to brands, charts and accounts): kept as a business record. They name the administrator, not you.</li>
      </ul>
      <p>These periods are defaults to be confirmed by the operator.</p>

      <h2 className={H2}>Your controls</h2>
      <ul>
        <li>Edit or delete your measurements at any time in <Link href="/settings" className="link">Settings</Link>.</li>
        <li>Download a copy of your data as a file.</li>
        <li>See your signed-in devices and sign any of them out.</li>
        <li>Delete your account. Deletion is immediate and removes your measurements, recommendations, fit reports, saved brands, sessions and security events. Backups kept by the database provider expire on that provider’s schedule.</li>
      </ul>

      <h2 className={H2}>Security</h2>
      <p>Passwords are hashed, sessions are stored server-side and can be revoked, links in emails work once and expire, and traffic is encrypted in transit. The database provider is expected to encrypt data at rest; the operator should confirm this for the provider in use.</p>

      <h2 className={H2}>Children</h2>
      <p>To be decided by the operator with legal advice: whether FITSYNC is offered to people under 18 and, if so, how verifiable parental consent is obtained.</p>

      <h2 className={H2}>Changes</h2>
      <p>When this notice changes, the date below changes. Material changes should be announced to signed-in users.</p>
      <p className="text-xs">Last updated: to be set by the operator at publication.</p>
    </article>
  );
}

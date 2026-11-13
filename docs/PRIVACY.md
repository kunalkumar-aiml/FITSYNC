# Privacy: what the software does, and what the operator must still decide

The public notice is `src/app/privacy/page.tsx`. It describes actual behaviour and deliberately does **not** claim legal
compliance. Items marked **OWNER INPUT** must be supplied by the business before launch; items marked **LEGAL REVIEW**
need advice under India’s Digital Personal Data Protection Act, 2023 (and its Rules), and any other law that applies to
your users.

## Data inventory
| Data | Where | Purpose | Retention (default) |
|---|---|---|---|
| Email, optional name, password hash, role, timestamps | `User` | Account | Until account deletion |
| Body measurements, unit, fit and sizing preference | `BodyMeasurement`, `UserProfile` | Recommendations | Until the user deletes them or the account |
| Saved recommendations incl. measurement snapshot | `Recommendation` | History, fit reports | Until account deletion |
| Fit reports and optional notes | `UserFeedback` | Improve recommendations | Until account deletion |
| Saved brands | `SavedBrand` | Convenience | Until account deletion |
| Sessions (browser description, keyed IP hash) | `Session` | Security, “your devices” | 30 days after expiry/revocation |
| Email verification / reset tokens (hashed) | `AuthToken` | Account security | 7 days after expiry/use |
| Sign-in events (type, time, keyed IP hash, user agent) | `AuthEvent` | Security monitoring | 180 days |
| Admin change records (admin email, action, target) | `AdminAuditLog` | Accountability | Kept (business record) |

Cookies: session (strictly necessary), CSRF (strictly necessary). Theme preference is in localStorage. No analytics or advertising trackers.

User rights implemented: view/edit measurements, export everything as JSON (Settings → Download my data), delete measurements, delete account (immediate cascade), see and sign out devices.

## OWNER INPUT
- Legal entity name, address, privacy contact and **grievance officer** details (do not publish without them).
- Processors actually used in production (hosting, database, email, Redis, search API) and their regions.
- Confirm the retention periods above, and the database provider’s backup retention.
- Whether the service is offered to people under 18.
- “Last updated” date on publication.

## LEGAL REVIEW
- Notice content and consent wording under the DPDP Act, 2023 and Rules; whether body measurements need any additional safeguards.
- Cross-border transfer of data to processors outside India.
- Breach notification process and timelines.
- Children’s data (verifiable parental consent) if under-18s may sign up.
- Retention of admin audit records that contain administrator emails.

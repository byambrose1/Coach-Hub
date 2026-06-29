# FitTrack - Solo Coach Dashboard

## Overview
A fitness trainer app designed for solo coaches managing in-person and online clients. Features authentication via Replit Auth, client management with health forms (PARQs), editable notes within client profiles, flexible payment options (block sessions and monthly billing), full invoice management (view/edit/download/send), configurable currency (£/$/€), UK date formats, HIPAA compliance options, notification settings, mass client email announcements, and calendar availability blocking.

## Landing Page
- Full marketing landing page (unauthenticated) with violet/orange gradient design
- Hero section: "Run your coaching business like a pro" + "5 clients included free" CTA
- Features grid (6 key features), stats bar, testimonials, pricing tiers, footer
- All CTAs link to `/api/login`

## Mass Email / Announcements
- "Send Announcement" button in Clients page header
- `BroadcastEmailDialog`: subject, message, recipient filter (active only / all)
- Shows live count of eligible recipients (clients with email addresses)
- Backend: POST `/api/emails/broadcast` → `sendBroadcastEmail()` in `server/email.ts`
- Sends via Brevo to all matching clients, returns `{ sent, failed }` counts

## Calendar Blocking
- "Block Time Off" button in Schedule header
- `BlockTimeDialog`: label (Holiday/Closed/Personal/etc.), from/to date range
- Creates sessions with `clientId: "__blocked__"` and `sessionType: "blocked"` for each day in range
- Month view: blocked days show grey background + ban icon strip
- Week view: blocked days show grey background + ban icon label
- Day view: shows grey "Unavailable" banner at top with "Remove" button
- DayDetailDialog: blocked sessions shown separately with a remove option
- No package deduction or email sent for blocked sessions (client lookup returns undefined → safe)

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect) via Passport.js
- **Routing**: wouter (frontend), Express (backend)
- **State**: TanStack React Query

## Project Structure
- `client/src/pages/` - Landing, Dashboard, Schedule, Clients, Payments, Settings, Admin, PlatformAdmin
- `client/src/components/` - AppSidebar, shadcn UI components
- `client/src/hooks/use-auth.ts` - Authentication hook (fetches /api/auth/user)
- `server/` - Express server, routes, storage layer, database connection
- `server/replit_integrations/auth/` - Replit Auth setup (passport, OIDC, session store)
- `shared/schema.ts` - Drizzle schema definitions

## Multi-User Architecture
- Every data table (clients, training_sessions, packages, session_notes, client_forms, invoices, referrals) has a `userId` column
- All API routes extract the authenticated user's ID from `req.user.claims.sub` and scope all queries to that userId
- Settings are stored per-user (id = userId in the settings table)
- Each coach who logs in sees only their own data - fully isolated
- The `users` table (from Replit Auth) tracks all registered coaches

## Platform Owner Admin
- URL: `/platform-admin` (hidden, not in sidebar)
- Protected server-side: only accessible if `req.user.claims.sub === process.env.OWNER_USER_ID`
- API endpoints: `GET /api/platform-admin/stats`, `GET /api/platform-admin/users`
- Shows: total coaches, new signups, active users, total clients/sessions/invoices/revenue platform-wide
- `OWNER_USER_ID` env var is set to the platform owner's Replit user ID

## Key Features
- **Auth**: Replit Auth (OIDC) login/logout, route protection via isAuthenticated middleware
- **Landing Page**: Split-screen design for unauthenticated users
- **Dashboard**: Today's schedule, stats (Active Clients is clickable → /clients), upcoming sessions, low session alerts. UK date format.
- **Schedule**: Month/Week/Day calendar views with toggle, day detail dialog, book sessions (1:1, group, online, outdoor), mark complete/cancel. UK date format.
- **Clients**: Client profiles with edit dialog (phone/email save fix), PARQ health forms tab, session history, editable packages (inline edit total/used sessions), full notes CRUD (create/edit/delete within profile with "edited" indicator)
- **Payments**: Revenue Overview card (week/month toggle, breakdown by monthly billing vs block bookings + session count), session packages (block & monthly billing) with edit sessions, full invoice management (view detail, edit, download PDF, send/mark sent, mark paid), Monthly Payments tab with GoCardless direct debit mandate management per client, configurable currency (£/$/€), summary stats
- **Settings**: Profile, cancellation policy (structured: notice hours + editable template), currency selector, payment settings, email notifications (stub), session reminders, HIPAA compliance, data retention, subscription plan display (shows current tier limits), account deletion
- **Admin**: Comprehensive admin overview page at /admin - account info, subscription status, client/session/invoice/revenue stats, system info (auth/email/payment providers)

## Subscription Tier System
- Free: 1-5 clients (no payment)
- Starter: 6-10 clients (£1.99/month)
- Professional: 11-20 clients (£4.99/month)
- Business: 21-50 clients (£7.99/month)
- POST /api/clients returns 402 with upgrade info when limit is hit
- Frontend shows UpgradePopup with payment link when 402 returned
- `subscriptionPlan` field in settings tracks current tier: "free" | "starter" | "professional" | "business"
- Platform owner manually upgrades coach plans in platform admin coach detail page

## Platform Config (Editable in Platform Admin)
- `platform_config` table stores tier limits, prices, and payment links
- All tier settings editable by owner in /platform-admin
- Payment links support any provider (Stripe, GoCardless, etc.)

## Platform Admin Features (/platform-admin)
- Platform stats overview
- Configurable tier limits and payment links
- Searchable coach list (clickable rows)
- Coach detail page at /platform-admin/coaches/:coachId - shows clients, stats, subscription plan management
- Coach impersonation: owner can view the app as any coach; amber banner shows while impersonating with exit button
- System status links (Brevo, GoCardless dashboards)

## Removed Features
- **Notes page**: Removed from sidebar. Notes now live within each client's profile (Notes tab).
- **Referrals page**: Removed entirely from sidebar and routes.

## Database Tables
- `clients` - name, email, phone, notes, sessionType, status, referredBy, referralCode
- `training_sessions` (NOT `sessions`) - clientId, title, date, startTime, endTime, sessionType, location, status, notes
- `sessions` - Auth session storage (connect-pg-simple)
- `packages` - clientId, name, totalSessions, usedSessions, price, status, billingType, monthlyRate, nextBillingDate
- `session_notes` - sessionId, clientId, content, date, updatedAt
- `settings` - trainerName, businessName, trainerEmail, trainerPhone, businessAddress, cancellationPolicy, paymentLink, acceptedPaymentMethods, invoicePrefix, lowSessionThreshold, enableEmailNotifications, enableSessionReminders, reminderHoursBefore, subscriptionStatus, subscriptionPlan, hipaaCompliant, dataRetentionDays, termsAccepted, **currency** (£/$/€)
- `client_forms` - clientId, formType, title, responses (JSON), status, date, updatedAt
- `referrals` - referrerClientId, referredClientId, referredName, referredEmail, referredPhone, status, rewardType, rewardApplied, date, notes
- `invoices` - clientId, packageId, invoiceNumber, amount, status, dueDate, sentDate, paidDate, notes, paymentMethod

## CRITICAL: Table Naming
- App training sessions use `training_sessions` table (Drizzle: `trainingSessions`)
- Auth sessions use `sessions` table (managed by connect-pg-simple)
- API routes use `/api/sessions` but map to `training_sessions` table

## API Routes (all prefixed with /api, all protected by isAuthenticated)
- Auth: GET /api/auth/user, GET /api/login, GET /api/logout, GET /api/callback
- GET/POST /clients, GET/PATCH/DELETE /clients/:id
- GET/POST /sessions, GET/PATCH/DELETE /sessions/:id
- GET/POST /packages, PATCH /packages/:id
- GET/POST /notes, PATCH/DELETE /notes/:id
- GET/PUT /settings
- GET/POST /forms, GET/PATCH/DELETE /forms/:id
- GET/POST /referrals, PATCH /referrals/:id
- GET/POST /invoices, PATCH /invoices/:id, POST /invoices/:id/send

## Running
- `npm run dev` starts both frontend and backend on port 5000
- `npm run db:push` pushes schema changes to database

## Date & Currency
- All dates displayed in UK format: DD/MM/YYYY (using date-fns `dd/MM/yyyy`)
- Currency configurable in Settings (default £, options: £/$/€)
- Currency stored in `settings.currency` field

## Email (Brevo)
- Invoice sending uses Brevo transactional email API (`@getbrevo/brevo` SDK)
- API key stored in `BREVO_API_KEY` environment secret
- Email service: `server/email.ts` - `sendInvoiceEmail()`, `sendBookingNotificationEmail()`, `sendSessionCancellationEmail()`, `sendSessionRescheduleEmail()`, `sendParqEmail()`
- Sender email comes from `settings.trainerEmail`; sender name from `settings.businessName` or `settings.trainerName`
- Important: The sender email must be a verified sender in your Brevo account
- POST `/api/invoices/:id/send` triggers email delivery and marks invoice as "sent"
- Booking notification emails fire automatically on POST /api/sessions if client has email
- Cancellation emails fire automatically on PATCH /api/sessions/:id when status changes to "cancelled"
- Reschedule emails fire automatically on PATCH /api/sessions/:id when date or startTime changes
- PAR-Q email: POST /api/parq/send-email sends the PAR-Q questions to the client via Brevo
- Low sessions notification: POST /api/packages/:id/notify-low-sessions - manually triggered from dashboard "Notify" button on each low session alert; sends email to client showing remaining sessions and package name

## GoCardless (Monthly Payments)
- `gocardless-nodejs` package installed; `server/payments.ts` with `createMandateLink()`
- Requires `GOCARDLESS_API_KEY` environment secret (not yet configured)
- "Set Up Monthly Payment" button in client profile generates a redirect link for direct debit mandate setup
- Uses `createRequire(import.meta.url)` to handle CJS package in ESM context
- Currently configured to use Sandbox environment
- POST `/api/payments/create-mandate-link` endpoint

## Terms & Conditions
- `hasAcceptedTerms` field in settings table
- `TermsModal` in `App.tsx` shown once on first login until accepted
- Accepts: checkbox + "Continue" button saves `hasAcceptedTerms: true` to settings
- Modal is non-dismissable until accepted (the `onOpenChange` does nothing)

## API Routes (additional)
- POST /api/payments/create-mandate-link
- POST /api/webhooks/gocardless

import { Link } from "wouter";
import type { ReactNode } from "react";
import { ArrowLeft, Dumbbell, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig, OWNER_INPUT_REQUIRED } from "@/config/site";

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-orange-500 text-white shadow-sm">
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-extrabold tracking-tight text-slate-950">FitTrack</span>
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-3">
          <Link href="/#pricing" className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:inline-flex">
            Pricing
          </Link>
          <Button asChild size="sm" className="rounded-full bg-violet-600 px-4 font-semibold hover:bg-violet-700">
            <a href="/api/login">Get started</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-white">FitTrack</p>
          <p className="mt-1 text-sm text-slate-400">Built for independent coaches in the UK.</p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/privacy" className="rounded underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Privacy</Link>
          <Link href="/terms" className="rounded underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Terms</Link>
          <Link href="/support" className="rounded underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Support</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-5 pb-7 text-xs text-slate-500 sm:px-6">
        {siteConfig.legalOperator !== OWNER_INPUT_REQUIRED ? siteConfig.legalOperator : OWNER_INPUT_REQUIRED}
      </div>
    </footer>
  );
}

function LegalLayout({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to FitTrack
        </Link>
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-orange-600">{eyebrow}</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
        <div className="prose prose-slate mt-10 max-w-none prose-headings:tracking-tight prose-a:text-violet-700">
          {children}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy" eyebrow="Privacy information">
      <div className="not-prose mb-8 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-950">
        <strong>Owner review required.</strong> This page is a plain-language product summary, not legal advice. Replace every {OWNER_INPUT_REQUIRED} item before launch.
      </div>
      <p><strong>Effective date:</strong> {siteConfig.effectiveDate}</p>
      <h2>What data FitTrack handles</h2>
      <p>Depending on the features you use, FitTrack stores coach account details, business and contact details, client names and contact details, bookings, notes, invoices, packages, and PARQ or other health-form responses that you choose to collect.</p>
      <h2>Why data is used</h2>
      <p>Data is used to provide the dashboard, organise coaching work, send requested emails, create invoices, support direct-debit setup through GoCardless, and keep the service secure. Do not enter information you do not need for your coaching workflow.</p>
      <h2>Health and PARQ information</h2>
      <p>PARQ responses can be sensitive health information. FitTrack provides storage and workflow tools; it does not assess medical suitability, provide medical advice, or replace your professional responsibilities. Only collect and share this information where you have an appropriate lawful basis and permission to do so.</p>
      <h2>Processors and payment providers</h2>
      <p>Current application integrations include {siteConfig.subprocessors}. GoCardless handles direct-debit payment setup when enabled. Confirm the complete processor list, data locations, contracts, and transfer arrangements before publishing this page.</p>
      <h2>Retention, export, and deletion</h2>
      <p>Coaches can export an individual client record from the client profile. Account deletion is available in Settings. The platform retention period is {siteConfig.retentionPolicy}; confirm how backups and residual copies are handled.</p>
      <h2>Your choices and rights</h2>
      <p>Requests about access, correction, export, deletion, or other data rights should be sent to {siteConfig.supportEmail}. The correct legal response process and identity checks must be confirmed by the owner.</p>
      <h2>Cookies, analytics, and security</h2>
      <p>FitTrack uses session cookies needed for authentication. No third-party analytics provider is configured in this codebase. The application restricts product API routes to authenticated users and avoids sending PARQ responses to activation telemetry. Confirm hosting, encryption, backup, audit-log, and cookie details before launch.</p>
      <h2>Contact</h2>
      <p>Privacy contact: {siteConfig.supportEmail}. Responsible operator: {siteConfig.legalOperator}. Contact address: {siteConfig.contactAddress}.</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms" eyebrow="Terms of use">
      <div className="not-prose mb-8 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-950">
        <strong>Owner review required.</strong> This draft contains {OWNER_INPUT_REQUIRED} placeholders and is not legal advice.
      </div>
      <p><strong>Operator:</strong> {siteConfig.legalOperator}<br /><strong>Contact:</strong> {siteConfig.supportEmail}<br /><strong>Governing law:</strong> {siteConfig.governingLaw}</p>
      <h2>Using FitTrack</h2>
      <p>FitTrack provides software tools for independent fitness coaches to manage client records, scheduling, forms, invoices, and payment workflows. You are responsible for your account, the accuracy of information you enter, and how you use client data.</p>
      <h2>Acceptable use</h2>
      <p>Use the service lawfully, respect client privacy, keep your sign-in details secure, and do not interfere with the service or use it to provide medical, legal, or financial advice.</p>
      <h2>Subscriptions and billing</h2>
      <p>The Free plan is available for up to five clients. Paid plans are shown monthly. VAT treatment, provider fees, cancellation terms, and any payment adjustments are {OWNER_INPUT_REQUIRED}. Plan access is subject to the limits shown in the application.</p>
      <h2>Cancellation and data</h2>
      <p>Cancellation and downgrade handling, including access to existing data after a limit is reached, must be confirmed by the owner before launch. Do not rely on this draft as a promise about retention.</p>
      <h2>Intellectual property and liability</h2>
      <p>FitTrack and its interfaces are operated by {siteConfig.legalOperator}. The owner must complete the intellectual-property, warranty, liability, and service-availability terms with qualified legal advice.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: {siteConfig.supportEmail}. Contact address: {siteConfig.contactAddress}.</p>
    </LegalLayout>
  );
}

export function SupportPage() {
  return (
    <LegalLayout title="Support" eyebrow="We’re here to help">
      <div className="not-prose grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Mail className="mb-3 h-6 w-6 text-violet-600" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-950">Email support</h2>
          <p className="mt-2 text-sm text-slate-600">Support email: {siteConfig.supportEmail}</p>
          {siteConfig.supportEmail === OWNER_INPUT_REQUIRED ? (
            <p className="mt-3 text-xs font-semibold text-orange-700">Add a real support address before launch.</p>
          ) : (
            <Button asChild className="mt-4 rounded-full bg-violet-600 hover:bg-violet-700"><a href={`mailto:${siteConfig.supportEmail}`}>Contact support</a></Button>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="mb-3 h-6 w-6 text-emerald-600" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-950">Before you contact us</h2>
          <p className="mt-2 text-sm text-slate-600">Please do not send PARQ answers, medical details, passwords, or payment credentials in a support message.</p>
        </div>
      </div>
      <h2>What support covers</h2>
      <p>We can help with account access, dashboard workflows, bookings, invoices, and payment setup. Expected response time: {siteConfig.paidPlanSupportResponse}.</p>
      <p className="not-prose mt-8 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">FitTrack provides software tools. It does not provide legal, medical, or financial advice.</p>
    </LegalLayout>
  );
}
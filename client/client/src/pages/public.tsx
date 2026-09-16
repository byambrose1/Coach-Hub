import { Link } from "wouter";
import type { ReactNode } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { siteConfig, OWNER_INPUT_REQUIRED } from "@/config/site";

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <BrandMark className="h-9 w-9" />
          <span className="font-extrabold tracking-tight text-slate-950">Practably</span>
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
          <p className="font-bold text-white">Practably</p>
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
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Practably
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
      <p><strong>Effective date:</strong> {siteConfig.effectiveDate}</p>
      <h2>What data Practably handles</h2>
      <p>Depending on the features you use, Practably stores coach account details, business and contact details, client names and contact details, bookings, notes, invoices, packages, and PARQ or other health-form responses that you choose to collect.</p>
      <h2>Why data is used</h2>
      <p>Data is used to provide the dashboard, organise coaching work, send requested emails, create invoices, support direct-debit setup through GoCardless, and keep the service secure. Do not enter information you do not need for your coaching workflow.</p>
      <h2>Health and PARQ information</h2>
      <p>PARQ responses can be sensitive health information. Practably provides storage and workflow tools; it does not assess medical suitability, provide medical advice, or replace your professional responsibilities. Only collect and share this information where you have an appropriate lawful basis and permission to do so.</p>
      <h2>Processors and payment providers</h2>
      <p>Current application integrations include {siteConfig.subprocessors}. GoCardless handles direct-debit payment setup when enabled.</p>
      <h2>Retention, export, and deletion</h2>
      <p>Coaches can export an individual client record from the client profile. Account deletion is available in Settings. Client data is retained for {siteConfig.retentionPolicy}.</p>
      <h2>Your choices and rights</h2>
      <p>Requests about access, correction, export, deletion, or other data rights should be sent to {siteConfig.supportEmail}.</p>
      <h2>Cookies, analytics, and security</h2>
      <p>Practably uses session cookies needed for authentication. No third-party analytics provider is configured in this codebase. The application restricts product API routes to authenticated users and avoids sending PARQ responses to activation telemetry. We don't currently publish detailed hosting, encryption, or audit-log documentation; if you need this for your own compliance requirements, contact us at {siteConfig.supportEmail}.</p>
      <h2>Contact</h2>
      <p>Privacy contact: {siteConfig.supportEmail}. Responsible operator: {siteConfig.legalOperator}. Contact address: {siteConfig.contactAddress}.</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms" eyebrow="Terms of use">
      <p><strong>Operator:</strong> {siteConfig.legalOperator}<br /><strong>Contact:</strong> {siteConfig.supportEmail}<br /><strong>Governing law:</strong> {siteConfig.governingLaw}</p>
      <h2>Using Practably</h2>
      <p>Practably provides software tools for independent coaches to manage client records, scheduling, forms, invoices, and payment workflows. You are responsible for your account, the accuracy of information you enter, and how you use client data.</p>
      <h2>Acceptable use</h2>
      <p>Use the service lawfully, respect client privacy, keep your sign-in details secure, and do not interfere with the service or use it to provide medical, legal, or financial advice.</p>
      <h2>Subscriptions and billing</h2>
      <p>The Free plan is available for up to five clients. Paid plans are shown monthly. {siteConfig.vatTreatment} {siteConfig.paymentProviderFees} Plan access is subject to the limits shown in the application.</p>
      <h2>Cancellation and data</h2>
      <p>You can cancel a paid plan any time from Settings. Cancellation takes effect at the end of your current billing period; there are no partial refunds for time already paid. If your client count exceeds a lower plan's limit, downgrading is blocked until you're within that plan's limit. Client data is retained for {siteConfig.retentionPolicy} after account closure.</p>
      <h2>Intellectual property and liability</h2>
      <p>Practably and its interfaces are operated by {siteConfig.legalOperator}, and remain our property. The service is provided on an "as is" and "as available" basis, without warranties of any kind, to the fullest extent permitted by law. To the fullest extent permitted by law, our liability for any claim relating to the service is limited to the amount you paid us in the 12 months before the claim arose.</p>
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
      <p className="not-prose mt-8 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Practably provides software tools. It does not provide legal, medical, or financial advice.</p>
    </LegalLayout>
  );
}
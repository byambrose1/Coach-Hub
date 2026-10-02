import { Link } from "wouter";
import type { ReactNode } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { siteConfig, OWNER_INPUT_REQUIRED } from "@/config/site";
import { Fragment } from "react";
import { publicSite, privacySections, termsSections } from "@shared/public-site";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <BrandMark className="h-9 w-9" />
          <span className="font-extrabold tracking-tight text-slate-950">{siteConfig.name}</span>
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-3">
          <Link href="/blog" className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:inline-flex">
            Blog
          </Link>
          <Link href="/#pricing" className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:inline-flex">
            Pricing
          </Link>
          <WaitlistDialog trigger={<Button size="sm" className="rounded-full bg-violet-600 px-4 font-semibold hover:bg-violet-700">Join the waitlist</Button>} />
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" variant="inverted" />
          <div>
            <p className="font-bold text-white">{siteConfig.name}</p>
            <p className="mt-1 text-sm text-slate-400">Built for independent coaches in the UK.</p>
          </div>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/blog" className="rounded underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Blog</Link>
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
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {siteConfig.name}
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
        <strong>Beta notice.</strong> {publicSite.betaNotice}
      </div>
      <p><strong>Effective date:</strong> {siteConfig.effectiveDate}</p>
      {privacySections.map(section => <Fragment key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</Fragment>)}
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms" eyebrow="Terms of use">
      <div className="not-prose mb-8 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-950">
        <strong>Beta notice.</strong> {publicSite.betaNotice}
      </div>
      <p><strong>Operator:</strong> {siteConfig.legalOperator}<br /><strong>Contact:</strong> {siteConfig.supportEmail}<br /><strong>Governing law:</strong> {siteConfig.governingLaw}</p>
      <p><strong>Effective date:</strong> {publicSite.effectiveDate}</p>
      {termsSections.map(section => <Fragment key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</Fragment>)}
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
      <p>We can help with account access, dashboard workflows, bookings, invoices, and payment records. Expected response time: {siteConfig.paidPlanSupportResponse}</p>
      <p className="not-prose mt-8 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">{siteConfig.name} provides software tools. It does not provide legal, medical, or financial advice.</p>
    </LegalLayout>
  );
}
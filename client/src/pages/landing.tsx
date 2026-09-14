import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, CreditCard,
  FileText, Menu, ShieldCheck, Sparkles, TrendingUp, Users, X, Zap,
} from "lucide-react";
import { Link } from "wouter";
import { BrandMark } from "@/components/brand-mark";
import { getPublicSiteUrl, pricingTiers, siteConfig } from "@/config/site";
import { trackActivationEvent } from "@/lib/activation";

const features = [
  { icon: Users, title: "Know every client at a glance", description: "Keep profiles, contact details, notes, packages, and session history together instead of scattered across documents." },
  { icon: CalendarDays, title: "Make the week easier to run", description: "Book sessions, manage your calendar, and keep availability visible without rebuilding a spreadsheet each week." },
  { icon: CreditCard, title: "Invoice and collect payments clearly", description: "Create invoices, see outstanding balances, and set up GoCardless direct debit workflows when your account is configured." },
  { icon: ClipboardCheck, title: "Collect PARQ forms in the workflow", description: "Create, store, and send PARQ forms from the client record, with the information your coaching process needs." },
  { icon: Zap, title: "Keep routine messages moving", description: "Use booking, cancellation, invoice, PARQ, and low-session email workflows without manually writing the same message every time." },
  { icon: TrendingUp, title: "See the business, not just the bookings", description: "Track revenue, packages, and invoices from a dashboard built around the decisions solo coaches make." },
];

const faqItems = [
  ["Who is Practably for?", "Practably is designed for independent coaches who want one place to manage a small client roster, sessions, forms, invoices, and payment workflows."],
  ["What is included in the Free plan?", "The Free plan supports up to five client records with scheduling, PARQ forms, basic invoicing, and client data export. It does not require a card to start."],
  ["How do client limits work?", "Each plan has a maximum number of client records. When you reach the limit, Practably shows an upgrade prompt before another client is added. A downgrade is blocked until the client count fits the target plan."],
  ["Do my clients need a Practably login?", "No. Coaches use Practably to manage their own workflow. Clients can receive emails and PARQ forms without a Practably dashboard login."],
  ["How do payments and GoCardless work?", "Practably can create a GoCardless direct-debit setup link when your account has GoCardless configured. GoCardless handles the payment mandate flow. Check your GoCardless account for its terms and fees."],
  ["How are PARQ and health details handled?", "PARQ responses are stored against the relevant client record so a coach can manage their workflow. Practably is software, not medical advice; collect and use health information only where appropriate for your practice."],
  ["Can I export or delete data?", "You can export an individual client record from that client's profile. Account deletion is available from Settings. The account retention and backup process is owner review required before launch."],
  ["What happens if I cancel or downgrade?", "The app prevents a downgrade if your current client count exceeds the new plan limit. Billing, access, and retention details after cancellation are owner review required before public launch."],
  ["Are VAT or payment-provider fees included?", `Prices are shown monthly. ${siteConfig.vatTreatment} ${siteConfig.paymentProviderFees}`],
  ["How do I contact support?", `Support contact: ${siteConfig.supportEmail}. Do not send health responses, passwords, or payment credentials in a support message.`],
];

function setMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function ProductPreview() {
  return (
    <div className="mx-auto mt-12 max-w-5xl rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-violet-200/50 sm:p-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 font-bold text-slate-950"><BrandMark className="h-7 w-7" />Practably</div>
          <div className="hidden items-center gap-2 sm:flex"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" /><span className="text-xs font-medium text-slate-500">Coach dashboard</span></div>
        </div>
        <div className="grid gap-3 p-3 sm:grid-cols-[1.1fr_.9fr] sm:p-5">
          <section aria-label="Illustrative weekly calendar" className="rounded-xl border border-slate-200 bg-white p-4 text-left">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">This week</p><p className="font-bold text-slate-950">Your coaching calendar</p></div><span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">3 upcoming</span></div>
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-semibold text-slate-500 sm:gap-2 sm:text-xs">
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => <div key={day} className={`rounded-lg py-1.5 ${index === 2 ? "bg-violet-600 text-white" : "bg-slate-100"}`}>{day}<span className="ml-1 opacity-70">{12 + index}</span></div>)}
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3 rounded-lg border-l-4 border-violet-500 bg-violet-50 p-2.5"><span className="text-xs font-bold text-violet-700">09:00</span><div><p className="text-xs font-bold text-slate-900">Session with Alex M.</p><p className="text-[11px] text-slate-500">Strength · Studio</p></div></div>
              <div className="flex items-center gap-3 rounded-lg border-l-4 border-orange-400 bg-orange-50 p-2.5"><span className="text-xs font-bold text-orange-700">17:30</span><div><p className="text-xs font-bold text-slate-900">Session with Sam T.</p><p className="text-[11px] text-slate-500">Online · 1:1</p></div></div>
            </div>
          </section>
          <div className="grid gap-3 text-left">
            <section aria-label="Illustrative client list" className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-slate-950">Clients</p><span className="text-xs font-semibold text-violet-700">5 / 5 free</span></div><div className="space-y-2">{[["Alex M.", "PARQ complete"], ["Sam T.", "PARQ to send"], ["Morgan K.", "Active package"]].map(([name, status], index) => <div key={name} className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white ${index === 1 ? "bg-orange-400" : "bg-violet-500"}`}>{name.split(" ").map((part) => part[0]).join("")}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{name}</p><p className={`text-[10px] ${index === 1 ? "text-orange-700" : "text-emerald-700"}`}>{status}</p></div></div>)}</div></section>
            <div className="grid grid-cols-2 gap-3"><section aria-label="Illustrative invoice status" className="rounded-xl bg-slate-950 p-3 text-white"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Outstanding</p><p className="mt-1 text-xl font-extrabold">£120</p><p className="mt-1 text-[10px] text-slate-400">1 invoice due</p></section><section aria-label="Illustrative onboarding status" className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Setup</p><p className="mt-1 text-xl font-extrabold text-emerald-900">4 / 6</p><p className="mt-1 text-[10px] text-emerald-700">steps complete</p></section></div>
          </div>
        </div>
        <p className="border-t border-slate-200 bg-white px-4 py-2 text-left text-[11px] text-slate-500">Illustrative dashboard preview using Practably workflows.</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const siteUrl = getPublicSiteUrl();
    document.title = "Practably | Business Software for Independent Coaches";
    setMeta("description", siteConfig.description);
    setMeta("og:title", "Practably | Business Software for Independent Coaches", "property");
    setMeta("og:description", siteConfig.description, "property");
    setMeta("og:type", "website", "property");
    setMeta("og:image", `${siteUrl}/practably-social.svg`, "property");
    setMeta("twitter:card", "summary");
    setMeta("twitter:title", "Practably | Business Software for Independent Coaches");
    setMeta("twitter:description", siteConfig.description);
    setMeta("twitter:image", `${siteUrl}/practably-social.svg`);
    let canonical = document.head.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = siteUrl;
  }, []);

  const startSignup = () => trackActivationEvent("signup_started");

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <a href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><BrandMark className="h-9 w-9" /><span className="font-extrabold tracking-tight">Practably</span></a>
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
            {["How it works", "Features", "Pricing", "FAQ"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">{item}</a>)}
          </nav>
          <div className="flex items-center gap-2"><Button asChild size="sm" className="hidden rounded-full bg-violet-600 px-5 font-semibold hover:bg-violet-700 sm:inline-flex"><a href="/api/login" onClick={startSignup}>Start free</a></Button><button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} className="grid h-10 w-10 place-items-center rounded-md text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 md:hidden" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="border-t border-slate-200 bg-white px-5 py-3 md:hidden"><div className="mx-auto flex max-w-6xl flex-col gap-1">{["How it works", "Features", "Pricing", "FAQ"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">{item}</a>)}<a href="/api/login" onClick={startSignup} className="mt-2 rounded-full bg-violet-600 px-4 py-2.5 text-center text-sm font-bold text-white">Start free with 5 clients</a></div></nav>}
      </header>

      <main>
        <section className="relative isolate overflow-hidden"><div className="absolute -right-40 -top-48 -z-10 h-[36rem] w-[36rem] rounded-full bg-violet-300/30 blur-3xl" /><div className="absolute -bottom-48 -left-40 -z-10 h-[32rem] w-[32rem] rounded-full bg-orange-200/50 blur-3xl" />
          <div className="mx-auto max-w-6xl px-5 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-20">
            <Badge className="mb-6 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1.5 font-semibold text-violet-800"><Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Free for your first 5 clients. No card required.</Badge>
            <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-950 sm:text-6xl">The simple business hub for <span className="bg-gradient-to-r from-violet-600 to-orange-500 bg-clip-text text-transparent">independent coaches.</span></h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-xl">Manage clients, bookings, PARQ forms, invoices, and payments in one place, without stitching together spreadsheets and five different apps.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"><Button asChild size="lg" className="w-full rounded-full bg-violet-600 px-7 py-6 text-base font-bold shadow-lg shadow-violet-200 hover:bg-violet-700 sm:w-auto"><a href="/api/login" onClick={startSignup}>Start free with 5 clients <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" /></a></Button><a href="#dashboard-preview" className="inline-flex min-h-12 items-center rounded-full border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">See the dashboard <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" /></a></div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-slate-600"><li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Up to 5 clients free</li><li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />No credit card required</li><li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Coach-sized plans</li></ul>
            <div id="dashboard-preview"><ProductPreview /></div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-slate-200 bg-slate-50"><div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">How it works</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Start with the workflow you already know.</h2></div><ol className="mt-10 grid gap-5 md:grid-cols-3">{[["01", "Add your clients", "Create a clear client record with contact details, notes, and the coaching context you need."], ["02", "Run bookings and forms", "Schedule sessions, manage packages, and collect PARQ forms from the same client workflow."], ["03", "Get paid and track revenue", "Create invoices, follow outstanding amounts, and use payment workflows when you are ready."]].map(([number, title, description]) => <li key={number} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><p className="text-sm font-extrabold text-violet-600">{number}</p><h3 className="mt-5 text-xl font-bold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p></li>)}</ol></div></section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-700">Designed for day-to-day coaching</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Less tool switching. More time with clients.</h2><p className="mt-4 text-lg text-slate-600">Practably brings the tasks that make a solo coaching business feel fragmented into one calm, focused dashboard.</p></div><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{features.map((feature) => <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-100 to-orange-100 text-violet-700"><feature.icon className="h-5 w-5" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-bold text-slate-950">{feature.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p></article>)}</div></section>

        <section className="bg-slate-950 text-white"><div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-300">Why coaches switch</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">A business hub built for the gap between spreadsheets and enterprise software.</h2><p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">Practably is for coaches who need client, booking, form, invoice, and direct-debit workflows to work together, but do not need a huge platform with a huge learning curve.</p></div><ul className="grid gap-3 sm:grid-cols-2">{["One client record, not multiple versions", "A faster start with a five-client free plan", "PARQ collection beside coaching work", "GoCardless direct-debit setup when configured", "Invoices and revenue in the same place", "Clear limits that fit a solo practice"].map((item) => <li key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-slate-100"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden="true" />{item}</li>)}</ul></div></section>

        <section className="border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-orange-50"><div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-700">Built around coach workflows</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">A practical workspace for the work behind every session.</h2><p className="mt-4 text-lg text-slate-600">Practably keeps the coach workflow front and centre: client records, scheduling, PARQ forms, invoices, packages, and payment setup, all in one place.</p></div></div></section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">Simple limits, clear starting point</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Choose the client limit that fits today.</h2><p className="mt-4 text-lg text-slate-600">Start with up to five clients for free. Plans are shown monthly; paid-plan checkout links are configured by the account owner.</p></div><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{pricingTiers.map((tier) => <article key={tier.name} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-bold text-slate-950">{tier.name}</h3><div className="mt-3 flex items-baseline gap-1"><span className="text-4xl font-extrabold tracking-tight">{tier.price}</span><span className="text-sm font-medium text-slate-500">{tier.period}</span></div><p className="mt-2 text-sm font-bold text-violet-700">{tier.clients}</p><p className="mt-3 min-h-12 text-sm leading-relaxed text-slate-600">{tier.description}</p><ul className="mt-5 flex-1 space-y-2.5">{tier.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{feature}</li>)}</ul><Button asChild variant={tier.name === "Free" ? "default" : "outline"} className={`mt-7 w-full rounded-full font-bold ${tier.name === "Free" ? "bg-violet-600 hover:bg-violet-700" : ""}`}><a href="/api/login" onClick={startSignup}>{tier.name === "Free" ? "Start free" : "Get started"}</a></Button></article>)}</div></section>

        <section aria-labelledby="security-heading" className="border-y border-slate-200 bg-slate-50"><div className="mx-auto max-w-6xl px-5 py-16 sm:px-6"><div className="grid gap-8 md:grid-cols-[.75fr_1.25fr]"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Security and privacy</p><h2 id="security-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Your client data, kept separate and in your control.</h2><p className="mt-4 text-slate-600">Every coach's clients, sessions, and records are private to their own account.</p></div><ul className="grid gap-3 sm:grid-cols-2">{[["Signed-in access", "Client, session, invoice, and form data all require an authenticated coach login."], ["Private by account", "Client details, sessions, notes, forms, packages, and invoices are only visible within your own account."], ["Export and deletion", "Export any individual client record from their profile, or delete your account any time from Settings."], ["Payment handling", "Direct debit setup for your clients is handled by GoCardless."]].map(([title, description]) => <li key={title} className="rounded-xl border border-slate-200 bg-white p-4"><ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-950">{title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p></li>)}</ul></div><p className="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">For full detail on data handling, retention, and processors, see our <Link href="/privacy" className="font-medium text-violet-700 underline">Privacy Policy</Link>. Practably provides software tools and does not provide legal, medical, or financial advice.</p></div></section>

        <section id="faq" className="mx-auto max-w-4xl px-5 py-16 sm:px-6 sm:py-20"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-700">FAQ</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Questions coaches ask before they start.</h2></div><Accordion type="single" collapsible className="mt-10 rounded-2xl border border-slate-200 bg-white px-5 sm:px-6">{faqItems.map(([question, answer], index) => <AccordionItem key={question} value={`faq-${index}`}><AccordionTrigger className="text-left text-base font-bold text-slate-900 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">{question}</AccordionTrigger><AccordionContent className="pr-8 text-sm leading-relaxed text-slate-600">{answer}</AccordionContent></AccordionItem>)}</Accordion></section>

        <section className="bg-gradient-to-r from-violet-700 via-violet-600 to-orange-500"><div className="mx-auto max-w-3xl px-5 py-16 text-center text-white sm:px-6 sm:py-20"><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Start with the admin work you want to stop chasing.</h2><p className="mt-4 text-lg text-white/85">Set up Practably for up to five clients at no cost, then grow only when your client list does.</p><Button asChild size="lg" className="mt-8 rounded-full bg-white px-7 py-6 text-base font-bold text-violet-700 shadow-xl hover:bg-slate-50"><a href="/api/login" onClick={startSignup}>Create your free account <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" /></a></Button><p className="mt-4 text-sm text-white/75">No credit card required for the Free plan.</p></div></section>
      </main>

      <footer className="bg-slate-950 text-slate-300"><div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-2"><BrandMark className="h-7 w-7" variant="inverted" /><span className="font-bold text-white">Practably</span></div><p className="text-sm text-slate-400">Built for independent coaches in the UK.</p><nav aria-label="Footer navigation" className="flex flex-wrap gap-5 text-sm font-medium"><Link href="/privacy" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Privacy</Link><Link href="/terms" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Terms</Link><Link href="/support" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Support</Link></nav></div></footer>
    </div>
  );
}
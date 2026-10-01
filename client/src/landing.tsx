import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, CreditCard,
  Menu, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { Link } from "wouter";
import { BrandMark } from "@/components/brand-mark";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { getPublicSiteUrl, pricingTiers, siteConfig } from "@/config/site";

const faqItems = [
  ["Who is Practably for?", "Practably is designed for independent coaches who want one place to manage a small client roster, sessions, forms, invoices, and payment workflows."],
  ["What is included in the Free plan?", "The Free plan supports up to five client records with scheduling, PARQ forms, basic invoicing, and client data export. It does not require a card to start."],
  ["How do client limits work?", "Each plan has a maximum number of client records. When you reach the limit, Practably shows an upgrade prompt before another client is added. A downgrade is blocked until the client count fits the target plan."],
  ["Do my clients need a Practably login?", "No. Coaches use Practably to manage their own workflow. Clients can receive emails and PARQ forms without a Practably dashboard login."],
  ["How do payments and GoCardless work?", "Practably can create a GoCardless direct-debit setup link when your account has GoCardless configured. GoCardless handles the payment mandate flow. Check your GoCardless account for its terms and fees."],
  ["How are PARQ and health details handled?", "PARQ responses are stored against the relevant client record so a coach can manage their workflow. Practably is software, not medical advice; collect and use health information only where appropriate for your practice."],
  ["Can I export or delete data?", `You can export an individual client record from that client's profile. ${siteConfig.retentionPolicy}`],
  ["What happens if I cancel or downgrade?", `The app prevents a downgrade if your current client count exceeds the new plan limit. ${siteConfig.cancellationTerms}`],
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

function Callout({ icon: Icon, label, className, tailClassName }: { icon: any; label: string; className: string; tailClassName: string }) {
  return (
    <div className={`pointer-events-none absolute z-10 hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-violet-700 shadow-lg sm:flex ${className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
      <span className={`absolute h-2.5 w-2.5 rotate-45 border-violet-200 bg-white ${tailClassName}`} aria-hidden="true" />
    </div>
  );
}

function MockupChrome({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-violet-200/50">
      <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 font-bold text-slate-950"><BrandMark className="h-6 w-6" />Practably</div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">{label}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CalendarMockup() {
  return (
    <MockupChrome label="Schedule">
      <div className="relative">
        <Callout icon={CalendarDays} label="Clashes blocked automatically" className="-top-8 right-0" tailClassName="-bottom-1 right-6 border-b border-r" />
        <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">This week</p><p className="font-bold text-slate-950">Your coaching calendar</p></div><span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">4 upcoming</span></div>
        <div className="grid grid-cols-5 gap-2 text-center text-xs font-semibold text-slate-500">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => <div key={day} className={`rounded-lg py-2 ${index === 2 ? "bg-violet-600 text-white" : "bg-slate-100"}`}>{day}<span className="ml-1 opacity-70">{12 + index}</span></div>)}
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3 rounded-lg border-l-4 border-violet-500 bg-violet-50 p-3"><span className="text-xs font-bold text-violet-700">09:00</span><div><p className="text-xs font-bold text-slate-900">Session with Alex M.</p><p className="text-[11px] text-slate-500">Strength · Studio</p></div></div>
          <div className="flex items-center gap-3 rounded-lg border-l-4 border-orange-400 bg-orange-50 p-3"><span className="text-xs font-bold text-orange-700">12:30</span><div><p className="text-xs font-bold text-slate-900">Group class</p><p className="text-[11px] text-slate-500">Outdoor · 6 spots</p></div></div>
          <div className="flex items-center gap-3 rounded-lg border-l-4 border-emerald-400 bg-emerald-50 p-3"><span className="text-xs font-bold text-emerald-700">17:30</span><div><p className="text-xs font-bold text-slate-900">Session with Sam T.</p><p className="text-[11px] text-slate-500">Online · 1:1</p></div></div>
        </div>
      </div>
    </MockupChrome>
  );
}

function ClientsMockup() {
  return (
    <MockupChrome label="Clients">
      <div className="relative">
        <Callout icon={ClipboardCheck} label="PARQ tracked per client" className="-top-3 right-0" tailClassName="-bottom-1 right-6 border-b border-r" />
        <div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-slate-950">Clients</p><span className="text-xs font-semibold text-violet-700">5 / 5 free</span></div>
        <div className="space-y-2.5">
          {[["Alex M.", "PARQ complete", "Package: 8 of 10 used", "bg-violet-500", "text-emerald-700"], ["Sam T.", "PARQ to send", "New client · online", "bg-orange-400", "text-orange-700"], ["Morgan K.", "PARQ complete", "Package: 3 of 5 used", "bg-emerald-500", "text-emerald-700"]].map(([name, parq, detail, color, parqColor]) => (
            <div key={name} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${color}`}>{name.split(" ").map((part) => part[0]).join("")}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{name}</p><p className="text-[11px] text-slate-500">{detail}</p></div>
              <span className={`shrink-0 text-[10px] font-bold ${parqColor}`}>{parq}</span>
            </div>
          ))}
        </div>
      </div>
    </MockupChrome>
  );
}

function InvoicingMockup() {
  return (
    <MockupChrome label="Invoices">
      <div className="relative">
        <Callout icon={CreditCard} label="Any payment method works" className="-top-8 right-0" tailClassName="-bottom-1 right-6 border-b border-r" />
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-950 p-3 text-white"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Outstanding</p><p className="mt-1 text-xl font-extrabold">£240</p><p className="mt-1 text-[10px] text-slate-400">2 invoices due</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Paid this month</p><p className="mt-1 text-xl font-extrabold text-emerald-900">£860</p><p className="mt-1 text-[10px] text-emerald-700">6 invoices</p></div>
        </div>
        <div className="space-y-2">
          {[["Alex M.", "£120", "Bank transfer", "text-orange-700", "bg-orange-50"], ["Sam T.", "£120", "Card machine", "text-orange-700", "bg-orange-50"], ["Morgan K.", "£90", "Paid · Stripe link", "text-emerald-700", "bg-emerald-50"]].map(([name, amount, method, color, bg]) => (
            <div key={name} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5">
              <div><p className="text-xs font-semibold text-slate-800">{name}</p><span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${color} ${bg}`}>{method}</span></div>
              <span className="text-xs font-bold text-slate-900">{amount}</span>
            </div>
          ))}
        </div>
      </div>
    </MockupChrome>
  );
}

const showcaseSlides = [
  {
    key: "schedule",
    tab: "Scheduling",
    headline: "Your whole week, without the spreadsheet",
    description: "Book sessions, see your week at a glance, and Practably checks for clashing times automatically - no more double-booked slots.",
    bullets: ["Weekly and daily views", "Automatic clash detection", "1:1, group, and online session types"],
    Mockup: CalendarMockup,
  },
  {
    key: "clients",
    tab: "Clients & PARQ",
    headline: "Every client, one record - health screening included",
    description: "Contact details, notes, package status, and PARQ health screening all live on the same client profile, so nothing gets left in a separate file.",
    bullets: ["PARQ forms built into onboarding", "Package and session history in one view", "Export a client's record any time"],
    Mockup: ClientsMockup,
  },
  {
    key: "invoicing",
    tab: "Invoicing & payments",
    headline: "Get paid without the awkward follow-up message",
    description: "See exactly who owes what, track whichever payment method each client actually uses, and send a proper invoice in seconds.",
    bullets: ["Outstanding balances at a glance", "Cash, card, bank transfer, PayPal, or your own Stripe link", "Automatic reminders when sessions run low"],
    Mockup: InvoicingMockup,
  },
];

function FeatureShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % showcaseSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = showcaseSlides[active];

  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-700">See it in action</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Less tool switching. More time with clients.</h2>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {showcaseSlides.map((s, index) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(index)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${active === index ? "bg-violet-600 text-white shadow-md shadow-violet-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            aria-pressed={active === index}
          >
            {s.tab}
          </button>
        ))}
      </div>
      <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
        <div className="order-2 text-left lg:order-1">
          <h3 className="text-2xl font-extrabold tracking-tight text-slate-950">{slide.headline}</h3>
          <p className="mt-3 text-base leading-relaxed text-slate-600">{slide.description}</p>
          <ul className="mt-5 space-y-2.5">
            {slide.bullets.map((bullet) => <li key={bullet} className="flex gap-2 text-sm font-medium text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{bullet}</li>)}
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <slide.Mockup />
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: configuredTiers } = useQuery<Array<{ name: string; label: string; max: number; price: string }>>({
    queryKey: ["/api/subscription/tiers"],
  });
  const fallbackTiersByName: Record<string, (typeof pricingTiers)[number]> = {
    free: pricingTiers[0],
    starter: pricingTiers[1],
    professional: pricingTiers[2],
    business: pricingTiers[3],
  };
  const displayedPricingTiers = configuredTiers
    ? configuredTiers.map((tier) => ({
        ...fallbackTiersByName[tier.name],
        name: tier.label,
        price: tier.price === "0" ? "£0" : `£${tier.price}`,
        period: tier.price === "0" ? "forever" : "/ month",
        clients: `Up to ${tier.max} clients`,
      }))
    : pricingTiers;

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

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <a href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><BrandMark className="h-9 w-9" /><span className="font-extrabold tracking-tight">Practably</span></a>
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
            {["How it works", "Features", "Pricing", "FAQ"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">{item}</a>)}
            <Link href="/blog" className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">Blog</Link>
          </nav>
          <div className="flex items-center gap-2">
            <WaitlistDialog trigger={<Button size="sm" className="hidden rounded-full bg-violet-600 px-5 font-semibold hover:bg-violet-700 sm:inline-flex">Join the waitlist</Button>} />
            <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} className="grid h-10 w-10 place-items-center rounded-md text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 md:hidden" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="border-t border-slate-200 bg-white px-5 py-3 md:hidden"><div className="mx-auto flex max-w-6xl flex-col gap-1">{["How it works", "Features", "Pricing", "FAQ"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">{item}</a>)}<Link href="/blog" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">Blog</Link><WaitlistDialog trigger={<button type="button" className="mt-2 rounded-full bg-violet-600 px-4 py-2.5 text-center text-sm font-bold text-white">Join the waitlist</button>} /></div></nav>}
      </header>

      <main>
        <section className="relative isolate overflow-hidden"><div className="absolute -right-40 -top-48 -z-10 h-[36rem] w-[36rem] rounded-full bg-violet-300/30 blur-3xl" /><div className="absolute -bottom-48 -left-40 -z-10 h-[32rem] w-[32rem] rounded-full bg-orange-200/50 blur-3xl" />
          <div className="mx-auto max-w-6xl px-5 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-20">
            <Badge className="mb-6 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1.5 font-semibold text-violet-800"><Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Beta - join the waitlist for early access.</Badge>
            <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-950 sm:text-6xl">The simple business hub for <span className="bg-gradient-to-r from-violet-600 to-orange-500 bg-clip-text text-transparent">independent coaches.</span></h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-xl">Manage clients, bookings, PARQ forms, invoices, and payments in one place, without stitching together spreadsheets and five different apps.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <WaitlistDialog trigger={<Button size="lg" className="w-full rounded-full bg-violet-600 px-7 py-6 text-base font-bold shadow-lg shadow-violet-200 hover:bg-violet-700 sm:w-auto">Join the waitlist <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" /></Button>} />
              <a href="#features" className="inline-flex min-h-12 items-center rounded-full border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">See the dashboard <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" /></a>
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-slate-600"><li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Free for your first 5 clients</li><li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />No credit card required</li><li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Coach-sized plans</li></ul>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-slate-200 bg-slate-50"><div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">How it works</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Start with the workflow you already know.</h2></div><ol className="mt-10 grid gap-5 md:grid-cols-3">{[["01", "Add your clients", "Create a clear client record with contact details, notes, and the coaching context you need."], ["02", "Run bookings and forms", "Schedule sessions, manage packages, and collect PARQ forms from the same client workflow."], ["03", "Get paid and track revenue", "Create invoices, follow outstanding amounts, and use payment workflows when you are ready."]].map(([number, title, description]) => <li key={number} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><p className="text-sm font-extrabold text-violet-600">{number}</p><h3 className="mt-5 text-xl font-bold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p></li>)}</ol></div></section>

        <FeatureShowcase />

        <section className="bg-slate-950 text-white"><div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-300">Why coaches switch</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">A business hub built for the gap between spreadsheets and enterprise software.</h2><p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">Practably is for coaches who need client, booking, form, invoice, and direct-debit workflows to work together, but do not need a huge platform with a huge learning curve.</p></div><ul className="grid gap-3 sm:grid-cols-2">{["One client record, not multiple versions", "A faster start with a five-client free plan", "PARQ collection beside coaching work", "GoCardless direct-debit setup when configured", "Invoices and revenue in the same place", "Clear limits that fit a solo practice"].map((item) => <li key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-slate-100"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden="true" />{item}</li>)}</ul></div></section>

        <section className="border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-orange-50"><div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-700">Built around coach workflows</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">A practical workspace for the work behind every session.</h2><p className="mt-4 text-lg text-slate-600">Practably keeps the coach workflow front and centre: client records, scheduling, PARQ forms, invoices, packages, and payment setup. No customer logos or performance claims. Just the product capabilities you can review.</p></div></div></section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">Simple limits, clear starting point</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Choose the client limit that fits today.</h2><p className="mt-4 text-lg text-slate-600">Start with up to five clients for free. Plans are shown monthly; paid-plan checkout links are configured by the account owner.</p></div><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{displayedPricingTiers.map((tier) => <article key={tier.name} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-bold text-slate-950">{tier.name}</h3><div className="mt-3 flex items-baseline gap-1"><span className="text-4xl font-extrabold tracking-tight">{tier.price}</span><span className="text-sm font-medium text-slate-500">{tier.period}</span></div><p className="mt-2 text-sm font-bold text-violet-700">{tier.clients}</p><p className="mt-3 min-h-12 text-sm leading-relaxed text-slate-600">{tier.description}</p><ul className="mt-5 flex-1 space-y-2.5">{tier.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{feature}</li>)}</ul><WaitlistDialog trigger={<Button variant={tier.name === "Free" ? "default" : "outline"} className={`mt-7 w-full rounded-full font-bold ${tier.name === "Free" ? "bg-violet-600 hover:bg-violet-700" : ""}`}>Join the waitlist</Button>} /></article>)}</div></section>

        <section aria-labelledby="security-heading" className="border-y border-slate-200 bg-slate-50"><div className="mx-auto max-w-6xl px-5 py-16 sm:px-6"><div className="grid gap-8 md:grid-cols-[.75fr_1.25fr]"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Security and privacy</p><h2 id="security-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Specific product controls, not broad promises.</h2><p className="mt-4 text-slate-600">Practably does not claim a compliance certification. These are the concrete product capabilities currently available.</p></div><ul className="grid gap-3 sm:grid-cols-2">{[["Signed-in access", "Product API routes for client, session, invoice, form, and settings data require an authenticated coach."], ["Client records", "Client details, sessions, notes, forms, packages, and invoices are scoped to the coach account."], ["Export and deletion", "An individual client record can be exported from the client profile, and account deletion is available from Settings."], ["Payment handling", "GoCardless direct-debit setup is initiated through GoCardless when the account has been configured."]].map(([title, description]) => <li key={title} className="rounded-xl border border-slate-200 bg-white p-4"><ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-950">{title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p></li>)}</ul></div></div></section>

        <section id="faq" className="mx-auto max-w-4xl px-5 py-16 sm:px-6 sm:py-20"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-700">FAQ</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Questions coaches ask before they start.</h2></div><Accordion type="single" collapsible className="mt-10 rounded-2xl border border-slate-200 bg-white px-5 sm:px-6">{faqItems.map(([question, answer], index) => <AccordionItem key={question} value={`faq-${index}`}><AccordionTrigger className="text-left text-base font-bold text-slate-900 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">{question}</AccordionTrigger><AccordionContent className="pr-8 text-sm leading-relaxed text-slate-600">{answer}</AccordionContent></AccordionItem>)}</Accordion></section>

        <section className="bg-gradient-to-r from-violet-700 via-violet-600 to-orange-500"><div className="mx-auto max-w-3xl px-5 py-16 text-center text-white sm:px-6 sm:py-20"><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Start with the admin work you want to stop chasing.</h2><p className="mt-4 text-lg text-white/85">Join the waitlist now, and we'll email you as soon as a beta spot opens up.</p><WaitlistDialog trigger={<Button size="lg" className="mt-8 rounded-full bg-white px-7 py-6 text-base font-bold text-violet-700 shadow-xl hover:bg-slate-50">Join the waitlist <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" /></Button>} /><p className="mt-4 text-sm text-white/75">No credit card required for the Free plan.</p></div></section>
      </main>

      <footer className="bg-slate-950 text-slate-300"><div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-2"><BrandMark className="h-7 w-7" variant="inverted" /><span className="font-bold text-white">Practably</span></div><p className="text-sm text-slate-400">Built for independent coaches in the UK.</p><nav aria-label="Footer navigation" className="flex flex-wrap gap-5 text-sm font-medium"><Link href="/blog" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Blog</Link><Link href="/privacy" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Privacy</Link><Link href="/terms" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Terms</Link><Link href="/support" className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Support</Link></nav></div></footer>
    </div>
  );
}
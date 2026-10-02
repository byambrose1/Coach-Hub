import { useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, CreditCard, Mail, Plus, Search, ShieldCheck,
  Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BrandMark } from "@/components/brand-mark";

const slides = [
  { label: "Overview", title: "A clearer view of the week.", detail: "The dashboard brings sessions, active clients, and low-session alerts into one practical starting point.", icon: CalendarDays },
  { label: "Clients", title: "Every client, in context.", detail: "Keep contact details, session history, coaching notes, packages, and forms together on one client record.", icon: Users },
  { label: "Scheduling", title: "Bookings that stay connected.", detail: "Book a session for a client, manage your schedule, and keep session type, time, and location visible.", icon: CalendarDays },
  { label: "PARQ forms", title: "Forms in the client workflow.", detail: "Send a PAR-Q email and keep completed health-screening forms with the corresponding client record.", icon: ClipboardCheck },
  { label: "Invoices & email", title: "Clear follow-through for both sides.", detail: "Create and email invoices, track their status, and send routine client emails for bookings, forms, or low session balances.", icon: CreditCard },
];

function AppFrame({ children, section }: { children: ReactNode; section: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#f7f8fb] text-left shadow-[0_24px_70px_-35px_rgba(28,25,55,.38)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><BrandMark className="h-7 w-7" />Practably</div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><span className="hidden sm:inline">Coach workspace</span><span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-800">DEMO</span></div>
      </div>
      <div className="grid min-h-[350px] sm:grid-cols-[150px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white p-3 sm:block">
          <p className="px-2 pb-3 pt-1 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Workspace</p>
          {[
            [CalendarDays, "Dashboard"], [Users, "Clients"], [CalendarDays, "Schedule"], [ClipboardCheck, "PARQ forms"], [CreditCard, "Invoices"],
          ].map(([Icon, label]: any) => <div key={label} className={`mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${section === label ? "bg-violet-50 text-violet-800" : "text-slate-500"}`}><Icon className="h-3.5 w-3.5" />{label}</div>)}
        </aside>
        <div className="min-w-0 p-3 sm:p-6">{children}</div>
      </div>
      <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-900 sm:px-5">
        Sample interface · fictional demo data only · no real client information or payment actions
      </div>
    </div>
  );
}

function DashboardSlide() {
  return <AppFrame section="Dashboard"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-500">Monday, 12 May</p><h3 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">Good morning, Jamie</h3><p className="mt-1 text-xs text-slate-500">Your practice at a glance.</p></div><span className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white"><Plus className="mr-1 inline h-3.5 w-3.5" />Quick book</span></div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Today’s sessions", "3"], ["Active clients", "18"], ["This week", "11"], ["Low sessions", "2"]].map(([k, v], i) => <div key={k} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-semibold text-slate-500 sm:text-xs">{k}</p><p className={`mt-2 text-2xl font-extrabold ${i === 3 ? "text-orange-600" : "text-slate-900"}`}>{v}</p></div>)}</div>
    <div className="mt-3 grid gap-3 sm:grid-cols-[1.2fr_.8fr]"><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h4 className="text-sm font-bold text-slate-900">Today’s schedule</h4><span className="text-[11px] font-semibold text-violet-700">View all</span></div>{[["09:00", "Taylor Reed", "1:1 · Studio"], ["11:30", "Casey Morgan", "Online · 1:1"], ["16:00", "Riley James", "Outdoor"]].map(([time, name, meta], i) => <div key={name} className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3"><span className={`w-11 text-xs font-bold ${i === 1 ? "text-orange-700" : "text-violet-700"}`}>{time}</span><div className={`h-8 w-1 rounded-full ${i === 1 ? "bg-orange-400" : "bg-violet-500"}`} /><div><p className="text-xs font-bold text-slate-800">{name}</p><p className="text-[10px] text-slate-500">{meta}</p></div></div>)}</div><div className="rounded-xl border border-slate-200 bg-white p-4"><h4 className="text-sm font-bold text-slate-900">Needs a look</h4><div className="mt-3 rounded-lg bg-orange-50 p-3"><p className="text-xs font-bold text-orange-900">Package running low</p><p className="mt-1 text-[11px] text-orange-800">Taylor Reed · 2 sessions remaining</p></div><div className="mt-2 rounded-lg bg-violet-50 p-3"><p className="text-xs font-bold text-violet-900">Invoice due soon</p><p className="mt-1 text-[11px] text-violet-800">INV-2048 · £68.00</p></div></div></div>
  </AppFrame>;
}

function ClientsSlide() {
  return <AppFrame section="Clients"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">Your practice</p><h3 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">Clients</h3><p className="mt-1 text-xs text-slate-500">A home for the details behind every session.</p></div><span className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white"><Plus className="mr-1 inline h-3.5 w-3.5" />Add client</span></div>
    <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400"><Search className="h-4 w-4" />Search clients</div>
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="hidden grid-cols-[1.25fr_1fr_.8fr_.7fr] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid"><span>Client</span><span>Next session</span><span>Package</span><span>Status</span></div>{[["TR", "Taylor Reed", "Wed, 14 May · 09:00", "Strength · 6 / 10", "Active"], ["CM", "Casey Morgan", "Thu, 15 May · 11:30", "1:1 · 3 / 8", "Active"], ["RJ", "Riley James", "Fri, 16 May · 16:00", "Monthly", "Active"]].map(([initials, name, when, pkg, status], i) => <div key={name} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 sm:grid-cols-[1.25fr_1fr_.8fr_.7fr]"><div className="flex items-center gap-2.5"><span className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold ${i === 1 ? "bg-orange-100 text-orange-800" : "bg-violet-100 text-violet-800"}`}>{initials}</span><span className="text-xs font-bold text-slate-900">{name}</span></div><span className="hidden text-xs text-slate-600 sm:block">{when}</span><span className="hidden text-xs text-slate-600 sm:block">{pkg}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">{status}</span><span className="text-[10px] text-slate-500 sm:hidden">{when} · {pkg}</span></div>)}</div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">{[["Client profile", "Contact details & notes"], ["Session history", "Past and upcoming work"], ["Packages & forms", "Progress in the same record"]].map(([title, sub]) => <div key={title} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-bold text-slate-800">{title}</p><p className="mt-1 text-[10px] text-slate-500">{sub}</p></div>)}</div>
  </AppFrame>;
}

function ScheduleSlide() {
  const rows = [["08:30", "Taylor Reed", "1:1", "Studio"], ["10:00", "Casey Morgan", "Online", "Video"], ["13:30", "Riley James", "1:1", "Park"], ["15:00", "Avery Quinn", "Group", "Studio"]];
  return <AppFrame section="Schedule"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-500">Monday · 12 May 2025</p><h3 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">Schedule</h3><p className="mt-1 text-xs text-slate-500">A week that works around your clients.</p></div><span className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white"><Plus className="mr-1 inline h-3.5 w-3.5" />Quick book</span></div>
    <div className="mt-5 grid grid-cols-7 gap-1 sm:gap-2">{["Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16", "Sat 17", "Sun 18"].map((d, i) => <div key={d} className={`rounded-lg px-1 py-2 text-center text-[9px] font-bold sm:px-2 sm:text-xs ${i === 0 ? "bg-violet-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{d}</div>)}</div>
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><h4 className="text-sm font-bold text-slate-900">Monday’s sessions</h4><span className="text-[11px] text-slate-500">4 scheduled</span></div>{rows.map(([time, name, type, location], i) => <div key={name} className="flex gap-3 border-b border-slate-100 py-3 last:border-0"><span className="w-12 pt-1 text-xs font-bold text-slate-500">{time}</span><div className={`w-1 rounded-full ${i === 2 ? "bg-orange-400" : "bg-violet-500"}`} /><div className="flex-1"><p className="text-xs font-bold text-slate-900">{name}</p><p className="mt-1 text-[10px] text-slate-500">{type} · {location}</p></div><span className="h-fit rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">Scheduled</span></div>)}</div>
  </AppFrame>;
}

function FormsSlide() {
  return <AppFrame section="PARQ forms"><div className="grid gap-4 md:grid-cols-[.9fr_1.1fr]"><div><p className="text-xs font-semibold text-slate-500">Client record · Taylor Reed</p><h3 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">PAR-Q health screening</h3><p className="mt-2 text-xs leading-relaxed text-slate-600">Keep the form workflow close to the client record. Email a form for a client to complete, then review its status here.</p><div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" />Completed · 12 May</div><div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 p-3 text-xs font-bold text-orange-900"><Mail className="h-4 w-4" />PAR-Q email ready to send</div><div className="mt-3 rounded-lg border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Client side</p><p className="mt-1 text-xs font-semibold text-slate-800">A clear email link to complete the form—no Practably dashboard login needed.</p></div></div><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 border-b border-slate-100 pb-3"><ClipboardCheck className="h-4 w-4 text-violet-700" /><p className="text-sm font-bold text-slate-900">PAR-Q questionnaire</p></div><p className="mt-3 text-[11px] leading-relaxed text-slate-600">Have you ever been told by a doctor that you have a heart condition?</p><div className="mt-2 flex gap-2"><span className="rounded-md bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">No</span><span className="rounded-md border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500">Yes</span></div><p className="mt-4 text-[11px] leading-relaxed text-slate-600">Do you feel pain in your chest when you do physical activity?</p><div className="mt-2 flex gap-2"><span className="rounded-md bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">No</span><span className="rounded-md border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500">Yes</span></div><div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5" />Illustrative form preview · not medical advice</div></div></div>
  </AppFrame>;
}

function InvoiceSlide() {
  return <AppFrame section="Invoices"><div className="grid gap-4 md:grid-cols-[1fr_1fr]"><div><p className="text-xs font-semibold text-slate-500">Payments workspace</p><h3 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">Invoices, without the chase.</h3><p className="mt-2 text-xs leading-relaxed text-slate-600">Create invoices, see what is pending or paid, and email the invoice from the client workflow.</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] text-slate-500">Outstanding</p><p className="mt-1 text-xl font-extrabold text-slate-900">£136.00</p></div><div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] text-slate-500">Paid this month</p><p className="mt-1 text-xl font-extrabold text-slate-900">£408.00</p></div></div><div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3"><p className="flex items-center gap-2 text-xs font-bold text-violet-950"><Mail className="h-4 w-4" />Client-facing follow-through</p><p className="mt-1 text-[11px] leading-relaxed text-violet-900">Booking and cancellation notices, invoice emails, PARQ links, and low-session reminders can help keep routine communication moving.</p></div></div><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 p-4"><h4 className="text-sm font-bold text-slate-900">Recent invoices</h4><span className="rounded-lg bg-violet-700 px-2.5 py-1.5 text-[10px] font-bold text-white">New invoice</span></div>{[["INV-2048", "Taylor Reed", "£68.00", "Pending"], ["INV-2047", "Casey Morgan", "£68.00", "Paid"], ["INV-2046", "Riley James", "£102.00", "Paid"]].map(([id, name, amount, status]) => <div key={id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 last:border-0"><div><p className="text-xs font-bold text-slate-900">{id} <span className="font-normal text-slate-500">· {name}</span></p><p className="mt-1 text-[10px] text-slate-500">Due 19 May</p></div><div className="text-right"><p className="text-xs font-bold text-slate-900">{amount}</p><span className={`text-[10px] font-bold ${status === "Paid" ? "text-emerald-700" : "text-orange-700"}`}>{status}</span></div></div>)}<div className="m-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600"><CreditCard className="h-4 w-4 shrink-0 text-violet-700" />Payment actions are not part of this demo. Direct-debit setup is available when the coach account is configured.</div></div></div>
  </AppFrame>;
}

const visualSlides = [DashboardSlide, ClientsSlide, ScheduleSlide, FormsSlide, InvoiceSlide];

export function ProductTour() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const CurrentSlide = visualSlides[active];
  const step = (n: number) => setActive((active + n + slides.length) % slides.length);
  const handleCarouselKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  };
  return <>
    <Button size="lg" variant="outline" onClick={() => setOpen(true)} className="min-h-12 rounded-full border-slate-300 bg-white px-6 text-sm font-bold text-slate-800 hover:border-violet-300 hover:text-violet-800 focus-visible:ring-violet-500">
      Take the product tour <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent onKeyDown={handleCarouselKeyDown} className="!flex !max-h-[96dvh] !w-[calc(100%-1rem)] !max-w-[min(96vw,1440px)] flex-col gap-0 overflow-hidden border-0 bg-[#f3f4f8] p-0 sm:!w-[calc(100%-2rem)] sm:rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Practably product tour</DialogTitle>
          <DialogDescription>Explore five illustrative coaching workflows using fictional sample data.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 pr-12 sm:px-6">
          <div className="flex items-center gap-2"><BrandMark className="h-7 w-7" /><span className="text-sm font-extrabold text-slate-900">Practably <span className="font-medium text-slate-500">/ Product tour</span></span></div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900">Fictional demo data</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[230px_1fr] lg:gap-8 lg:p-8">
            <section className="lg:pt-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-violet-700">A practical workspace</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">{slides[active].title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{slides[active].detail}</p>
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-950">Everything shown is illustrative sample data. No real client data is used, and no payment or email is sent from this tour.</p>
              <nav aria-label="Product tour slides" className="mt-5 grid grid-cols-5 gap-1.5 lg:grid-cols-1">
                {slides.map((slide, i) => <button key={slide.label} type="button" aria-current={active === i ? "step" : undefined} aria-label={`Show ${slide.label} slide`} onClick={() => setActive(i)} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-[10px] font-bold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 lg:justify-start lg:px-3 lg:text-xs ${active === i ? "bg-violet-700 text-white" : "bg-white text-slate-600 hover:bg-violet-50 hover:text-violet-800"}`}><slide.icon className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline lg:inline">{slide.label}</span><span className="sm:hidden">{i + 1}</span></button>)}
              </nav>
              <div className="mt-5 flex items-center justify-between gap-3 lg:justify-start">
                <button type="button" onClick={() => step(-1)} aria-label="Previous slide" className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-violet-400 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><ChevronLeft className="h-5 w-5" /></button>
                <p aria-live="polite" className="text-xs font-semibold tabular-nums text-slate-500">{active + 1} <span className="text-slate-300">/</span> {slides.length}</p>
                <button type="button" onClick={() => step(1)} aria-label="Next slide" className="grid h-10 w-10 place-items-center rounded-full bg-violet-700 text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><ChevronRight className="h-5 w-5" /></button>
              </div>
            </section>
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between px-1"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Inside Practably</p><p className="flex items-center gap-1 text-[10px] font-semibold text-slate-400"><Check className="h-3 w-3" />Illustrative only</p></div>
              <div key={active} className="animate-in fade-in slide-in-from-right-2 duration-300 motion-reduce:animate-none"><CurrentSlide /></div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <p className="hidden text-xs text-slate-500 sm:block">Made for independent coaches and easier to follow for clients.</p>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => step(-1)} aria-label="Previous tour step" className="rounded-full p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><ArrowLeft className="h-4 w-4" /></button>
            {active < slides.length - 1 ? <Button size="sm" onClick={() => step(1)} className="rounded-full bg-violet-700 px-4 font-bold hover:bg-violet-800">Next <ArrowRight className="ml-1.5 h-4 w-4" /></Button> : <Button size="sm" onClick={() => setOpen(false)} className="rounded-full bg-violet-700 px-4 font-bold hover:bg-violet-800">Done <X className="ml-1.5 h-4 w-4" /></Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

export function ProductShowcase() {
  const [active, setActive] = useState(0);
  const CurrentSlide = visualSlides[active];
  const step = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  };

  return (
    <section
      id="product-showcase"
      aria-label="Explore the Practably workspace"
      aria-roledescription="carousel"
      className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-6 sm:pb-20"
      data-testid="product-showcase-carousel"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[#f7f8fb] shadow-[0_24px_80px_-42px_rgba(28,25,55,.42)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.17em] text-violet-700">Inside the workspace</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">The work behind each session, in one place.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Explore the everyday flow, from client context and bookings to forms and invoices.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => step(-1)} aria-label="Previous workflow preview" className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:border-violet-400 hover:text-violet-800 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <p aria-live="polite" className="min-w-[3.5rem] text-center text-xs font-semibold tabular-nums text-slate-500">{active + 1} <span className="text-slate-300">/</span> {slides.length}</p>
            <button type="button" onClick={() => step(1)} aria-label="Next workflow preview" className="grid h-10 w-10 place-items-center rounded-full bg-violet-700 text-white transition-colors hover:bg-violet-800 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <nav aria-label="Choose a workflow preview" className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3 sm:px-8">
          {slides.map((slide, index) => (
            <button
              key={slide.label}
              type="button"
              aria-current={active === index ? "step" : undefined}
              aria-label={`Show ${slide.label} workflow preview`}
              onClick={() => setActive(index)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-bold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${active === index ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-800"}`}
            >
              <slide.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {slide.label}
            </button>
          ))}
        </nav>

        <div className="grid items-start gap-6 p-4 sm:p-7 lg:p-8">
          <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-violet-700">{slides[active].label}</p>
              <h3 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">{slides[active].title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{slides[active].detail}</p>
            </div>
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
              Fictional sample only. No real client details are shown, and this preview cannot send emails or take payments.
            </p>
          </div>
          <div className="min-w-0" data-testid="product-showcase-active-preview" aria-label={`${slides[active].label} sample interface`}>
            <div key={active} className="animate-in fade-in slide-in-from-right-2 duration-300 motion-reduce:animate-none">
              <CurrentSlide />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
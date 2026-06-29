import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Calendar, CreditCard, FileText, CheckCircle2, Zap,
  ClipboardCheck, Bell, TrendingUp, Star, ArrowRight, Dumbbell
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Client Management",
    desc: "Complete client profiles with health forms, session history, and detailed notes, all in one place.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    desc: "Month, week, and day views. Click any slot to instantly book. Block time off for holidays in seconds.",
  },
  {
    icon: CreditCard,
    title: "Payments & Invoices",
    desc: "Block packages, monthly billing, GoCardless direct debit, professional PDF invoices, all handled.",
  },
  {
    icon: ClipboardCheck,
    title: "Health & PARQ Forms",
    desc: "Digital health screening built-in. Send, collect, and store PAR-Q forms for every client.",
  },
  {
    icon: Bell,
    title: "Automated Emails",
    desc: "Booking confirmations, cancellation notices, low session alerts, sent automatically via Brevo.",
  },
  {
    icon: TrendingUp,
    title: "Revenue Dashboard",
    desc: "Track weekly and monthly revenue, package performance, and outstanding invoices at a glance.",
  },
];

const tiers = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    highlight: false,
    badge: null,
    clients: "Up to 5 clients",
    desc: "Everything you need to get started. No card required.",
    features: ["5 client profiles", "Session scheduling", "Block packages", "PARQ forms", "Basic invoicing"],
  },
  {
    name: "Starter",
    price: "£1.99",
    period: "/ month",
    highlight: false,
    badge: null,
    clients: "Up to 10 clients",
    desc: "For coaches just starting to grow.",
    features: ["10 client profiles", "All Free features", "Email notifications", "Direct debit setup", "Revenue tracking"],
  },
  {
    name: "Professional",
    price: "£4.99",
    period: "/ month",
    highlight: true,
    badge: "Most Popular",
    clients: "Up to 20 clients",
    desc: "For coaches running a serious business.",
    features: ["20 client profiles", "All Starter features", "Mass client emails", "Full invoice management", "HIPAA/GDPR tools"],
  },
  {
    name: "Business",
    price: "£7.99",
    period: "/ month",
    highlight: false,
    badge: null,
    clients: "Up to 50 clients",
    desc: "For large rosters and growing teams.",
    features: ["50 client profiles", "All Professional features", "Priority support", "Advanced analytics", "Custom branding"],
  },
];

const testimonials = [
  { name: "Sarah M.", role: "Personal Trainer, London", text: "FitTrack replaced 3 different apps I was using. Everything's in one place and my clients love the invoices." },
  { name: "James K.", role: "Strength Coach, Manchester", text: "Setting up direct debit with GoCardless through FitTrack took 5 minutes. I haven't chased a payment since." },
  { name: "Priya T.", role: "Online Coach, Birmingham", text: "The PARQ forms alone saved me hours every month. My onboarding is completely digital now." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #f97316)" }}>
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">FitTrack</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block transition-colors">Pricing</a>
            <Button asChild size="sm" className="font-semibold rounded-full px-5" style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)" }}>
              <a href="/api/login" data-testid="button-login-nav">Get started free</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #f97316 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center relative">
          <Badge className="mb-6 text-sm px-4 py-1.5 rounded-full font-medium border-0" style={{ background: "linear-gradient(135deg, #ede9fe, #ffedd5)", color: "#7c3aed" }}>
            🚀 Free for your first 5 clients - no credit card needed
          </Badge>

          <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight tracking-tight mb-6 max-w-3xl mx-auto" data-testid="text-landing-title">
            Run your coaching
            <br />
            <span style={{ background: "linear-gradient(135deg, #7c3aed, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              business like a pro
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            The all-in-one dashboard for solo fitness coaches. Manage clients, schedule sessions, send invoices, and get paid without the admin headache.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="font-bold text-base rounded-full px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105" style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)" }}>
              <a href="/api/login" data-testid="button-login-hero">
                Start free - 5 clients included
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
            <a href="#features" className="text-gray-500 hover:text-gray-800 text-sm font-medium transition-colors flex items-center gap-1">
              See what's included ↓
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-gray-500">
            {["No credit card", "Set up in 2 minutes", "UK-based & GDPR compliant", "Cancel anytime"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: "2 min", label: "to set up your account" },
            { value: "£0", label: "to manage 5 clients" },
            { value: "100%", label: "client data stays yours" },
            { value: "1 place", label: "for your whole business" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold" style={{ background: "linear-gradient(135deg, #7c3aed, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <Badge className="mb-4 text-sm px-4 py-1.5 rounded-full font-medium border-0" style={{ background: "#ede9fe", color: "#7c3aed" }}>
            <Zap className="w-3.5 h-3.5 inline mr-1" />
            Everything included from day one
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">One dashboard. Zero admin headaches.</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">Built by coaches, for coaches. Every feature you actually need, none of the bloat.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-100 p-6 hover:border-violet-200 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ background: "linear-gradient(135deg, #ede9fe, #ffedd5)" }}>
                <f.icon className="w-5 h-5" style={{ color: "#7c3aed" }} />
              </div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-gray-100 py-16" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #fff7ed 100%)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-gray-500 text-sm font-medium mb-8">Loved by coaches across the UK</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Grow at your own pace</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">Start completely free with 5 clients. Upgrade only when you're ready to grow.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-6 border transition-all ${tier.highlight
                ? "border-violet-400 shadow-xl shadow-violet-100 scale-105 relative"
                : "border-gray-100 hover:border-gray-200 hover:shadow-md"
              }`}
              style={tier.highlight ? { background: "linear-gradient(160deg, #faf5ff, #fff7ed)" } : {}}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="text-xs px-3 py-1 rounded-full font-semibold border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #7c3aed, #f97316)", color: "white" }}>
                    {tier.badge}
                  </Badge>
                </div>
              )}
              <h3 className="font-bold text-lg mb-1">{tier.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-extrabold">{tier.price}</span>
                <span className="text-gray-400 text-sm">{tier.period}</span>
              </div>
              <p className="text-xs font-semibold text-violet-600 mb-2">{tier.clients}</p>
              <p className="text-gray-500 text-sm mb-5">{tier.desc}</p>
              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={`w-full rounded-full font-semibold text-sm ${tier.highlight ? "shadow-md hover:shadow-lg" : ""}`}
                variant={tier.highlight ? "default" : "outline"}
                style={tier.highlight ? { background: "linear-gradient(135deg, #7c3aed, #9333ea)" } : {}}
              >
                <a href="/api/login" data-testid={`button-cta-${tier.name.toLowerCase()}`}>
                  {tier.price === "£0" ? "Start free" : "Get started"}
                </a>
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-400 text-sm mt-8">
          All plans include a free trial period. Upgrade or downgrade anytime. No contracts.
        </p>
      </section>

      {/* Final CTA */}
      <section className="py-20" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #f97316 100%)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Ready to run your coaching business smarter?</h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Join coaches who've ditched the spreadsheets. Start free with 5 clients - no card, no commitment.
          </p>
          <Button asChild size="lg" className="font-bold text-base rounded-full px-8 py-6 bg-white hover:bg-gray-50 transition-all hover:scale-105 shadow-xl" style={{ color: "#7c3aed" }}>
            <a href="/api/login" data-testid="button-login-cta">
              Create your free account
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
          <p className="text-white/60 text-sm mt-4">Free forever for up to 5 clients. No credit card required.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #f97316)" }}>
              <Dumbbell className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm">FitTrack</span>
          </div>
          <p className="text-gray-400 text-xs">© 2026 FitTrack. Built for solo coaches in the UK. GDPR compliant.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

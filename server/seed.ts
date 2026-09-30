import { storage } from "./storage";
import { logError } from "./safe-logging";

export async function seedDatabase() {
  // Sample data is intentionally disabled: each authenticated coach starts with
  // an isolated, empty workspace rather than production-like client records.
  return;
}

// Starter blog content for SEO, seeded once on startup (idempotent by slug -
// skips any slug that already exists, so it never overwrites edits made from
// Platform Admin > Blog). This is real published content, not sample/demo
// data, so it doesn't fall under the seedDatabase() restriction above.
const STARTER_POSTS: Array<{
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  seoTitle?: string;
  seoDescription?: string;
}> = [
  {
    slug: "practably-vs-pt-distinction-vs-truecoach",
    title: "Practably vs PT Distinction vs TrueCoach: which is right for a solo UK coach?",
    excerpt: "A straight comparison of price and features for coaches deciding between Practably, PT Distinction, and TrueCoach.",
    seoDescription: "Practably vs PT Distinction vs TrueCoach compared on price and features, for independent UK personal trainers choosing client management software.",
    contentMarkdown: `If you've searched for personal trainer software, you've probably landed on PT Distinction or TrueCoach. Both are solid, well-reviewed platforms - but both are priced and built for coaches running structured online coaching programmes with dozens of clients, not necessarily for someone managing a smaller in-person roster who mainly needs client records, bookings, PARQ forms, and invoicing sorted.

Here's an honest breakdown. Both platforms list prices in US dollars, so we've converted to approximate GBP too - prices correct as of late 2026, always check the current numbers (and live exchange rate) on each provider's own site before you commit, since software pricing changes often.

## Pricing at a glance

**PT Distinction**: Novice plan from $19.90/month (~£15, 3 clients), up to Master at $89.90/month (~£67, 50 clients), plus a per-extra-client fee on top.

**TrueCoach**: Starter from $29.98/month (~£22, 5 clients), up to Pro at $164.98/month (~£123, 50 clients).

**Practably**: Free for up to 5 clients, then £1.99/month (10 clients), £4.99/month (20 clients), £7.99/month (50 clients) - no per-client add-on fees, and priced in pounds to begin with.

For a coach with a small roster, that's a meaningful difference: getting to 20 clients costs roughly £45-55/month on PT Distinction or TrueCoach, versus £4.99/month on Practably.

## What you're actually paying for

PT Distinction and TrueCoach earn their price with genuinely deep feature sets: structured workout and nutrition programme builders, exercise video libraries, in-app messaging and check-ins, progress photo tracking, and (on higher tiers) a custom-branded mobile app with your own logo. If you deliver most of your coaching remotely through structured programmes, that's real value.

Practably is built for a different job: the day-to-day admin of running a coaching business - client records, session scheduling, PARQ (health screening) forms, invoicing, and tracking which payment methods each client uses - without the workout-programming layer. It doesn't try to replace how you actually coach; it keeps the business side organised around it.

## Who should pick what

**Pick PT Distinction or TrueCoach if**: you deliver structured online programmes, want built-in workout/nutrition tools and client messaging, and your client count (or budget) justifies $30-90+/month.

**Pick Practably if**: you're mostly coaching in person or already have your own way of programming workouts, you want simple, affordable client and business admin, and you don't want to pay enterprise pricing for a small roster.

Practably is currently in private beta - if the second one sounds like you, join the waitlist below and we'll email you when a spot opens up.`,
  },
  {
    slug: "best-personal-trainer-software-small-client-roster-2026",
    title: "Best personal trainer software for a small client roster (2026)",
    excerpt: "If you're coaching fewer than 20 clients, here's what actually matters when picking software - and what you probably don't need to pay for yet.",
    seoDescription: "The best personal trainer software for a small client roster in 2026, comparing Practably, PT Distinction, TrueCoach, and My PT Hub on price and features.",
    contentMarkdown: `Most "best personal trainer software" roundups are written for coaches running 50+ client online coaching businesses. If you're coaching a smaller roster - say, under 20 clients, a mix of in-person and online - a lot of that advice doesn't apply, and a lot of that pricing doesn't make sense yet.

Here's a straight look at four options, focused on what a smaller coaching business actually needs. Prices are correct as of late 2026 - check each provider's live pricing before switching. Three of these list prices in US dollars, so we've added approximate GBP for a UK reader; Practably is priced in pounds to begin with.

## Practably - simple client and business admin

**Price**: Free for up to 5 clients, then £1.99-£7.99/month up to 50 clients.

**Best for**: coaches who want client records, session scheduling, PARQ health forms, invoicing, and payment-method tracking in one place, without paying for workout-programming tools they don't use.

**Not included**: a built-in workout/nutrition programme builder or exercise video library - Practably assumes you already have your own way of programming sessions.

## PT Distinction - deep customisation for structured coaching

**Price**: From $19.90/month (~£15, 3 clients) to $89.90/month (~£67, 50 clients).

**Best for**: coaches running detailed, periodised programmes who want heavy customisation and automation (onboarding sequences, follow-ups) and are happy paying for it.

## TrueCoach - polished client experience

**Price**: From $29.98/month (~£22, 5 clients) to $164.98/month (~£123, 50 clients).

**Best for**: strength and conditioning or bodybuilding coaches who prioritise a slick client-facing app experience over price.

## My PT Hub - unlimited clients on one plan

**Price**: From $40/month (~£30, 3 clients); the mid-tier Premium plan ($105/month, ~£78) includes unlimited clients on a flat fee.

**Best for**: coaches who expect to scale past 50 clients quickly and want to avoid per-client pricing later, and don't mind paying more up front for that flexibility.

## The actual question to ask

Before comparing feature lists, ask: do you need software to help you *deliver* coaching (programme builders, video libraries, in-app messaging), or software to help you *run the business* around coaching you already know how to deliver (bookings, forms, invoices, payment tracking)?

If it's the second one and your roster is still small, you're likely better off starting with something priced for where you are now rather than where a 50-client business would be. Practably is currently in private beta, built specifically for that - join the waitlist to get early access.`,
  },
  {
    slug: "parq-form-template-personal-trainers-uk",
    title: "PAR-Q Form Template for Personal Trainers (UK): What to Include and How to Use It",
    excerpt: "What a PAR-Q health screening form needs to cover, the standard questions to include, and how to collect one without a stack of paper.",
    seoDescription: "A PAR-Q form template and guide for UK personal trainers: what questions to include, why it matters, and how to collect and store PAR-Q responses digitally.",
    contentMarkdown: `Before a new client's first session, most UK personal trainers use some version of a PAR-Q (Physical Activity Readiness Questionnaire) to screen for health risks. It's a standard part of a responsible onboarding process - not a medical assessment, but a way to flag anything that means a client should check with a doctor before starting an exercise programme.

This isn't medical or legal advice - if you're unsure whether a client needs medical clearance, that's a question for a doctor, not a form.

## Why a PAR-Q matters

A PAR-Q helps you spot risk factors before they become a problem in a session: an undiagnosed heart condition, a joint issue that a particular exercise could aggravate, or a medication that affects how someone responds to exercise. It's also part of showing you've taken reasonable care as a coach, which matters for your own liability and insurance.

## The standard questions

The original Physical Activity Readiness Questionnaire (PAR-Q, developed in Canada and widely used as a baseline in UK fitness qualifications) covers seven core questions. A typical PAR-Q form asks the client to confirm:

- Whether a doctor has ever said they have a heart condition and recommended only medically supervised physical activity
- Whether they feel chest pain during physical activity
- Whether they've had chest pain when not doing physical activity in the past month
- Whether they lose their balance because of dizziness, or ever lose consciousness
- Whether they have a bone or joint problem that could be made worse by a change in physical activity
- Whether a doctor is currently prescribing medication for blood pressure or a heart condition
- Whether they know of any other reason they should not do physical activity

A "yes" to any of these doesn't automatically mean you can't train someone - it means it's worth a conversation, and possibly a note from their GP, before you start.

## What else a good PAR-Q form should cover

Beyond the core seven questions, most coaches add:

- Contact details and emergency contact
- Current medications and allergies
- Previous injuries or surgeries
- Current activity level and exercise history
- Specific goals for training

## Paper form vs. digital

A paper PAR-Q works, but it's easy to lose, awkward to search back through, and not great if a client needs to update their answers later (a new diagnosis, a new medication). Collecting PAR-Q responses digitally against the client's own record means you can find them instantly, and they don't get left in a gym bag.

Practably includes PARQ form collection built into each client record, so responses are stored alongside bookings, notes, and invoices rather than in a separate paper file. Practably is currently in private beta - join the waitlist to get early access.`,
  },
];

export async function seedBlogPosts() {
  const existing = await storage.getAllBlogPosts();
  const existingSlugs = new Set(existing.map((p) => p.slug));
  for (const post of STARTER_POSTS) {
    if (existingSlugs.has(post.slug)) continue;
    try {
      await storage.createBlogPost({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        contentMarkdown: post.contentMarkdown,
        seoTitle: null,
        seoDescription: post.seoDescription || null,
        authorName: "The Practably Team",
        published: true,
      });
    } catch (err) {
      logError(`Failed to seed blog post "${post.slug}"`, err);
    }
  }
}
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

Here's an honest breakdown, prices correct as of late 2026 - always check the current numbers on each provider's own site before you commit, since software pricing changes often.

## Pricing at a glance

**PT Distinction**: Novice plan from $19.90/month (3 clients), up to Master at $89.90/month (50 clients), plus a per-extra-client fee on top.

**TrueCoach**: Starter from $29.98/month (5 clients), up to Pro at $164.98/month (50 clients).

**Practably**: Free for up to 5 clients, then £1.99/month (10 clients), £4.99/month (20 clients), £7.99/month (50 clients) - no per-client add-on fees.

For a coach with a small roster, that's a meaningful difference: getting to 20 clients costs roughly $60-70/month (around £50-55) on PT Distinction or TrueCoach, versus £4.99/month on Practably.

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

Here's a straight look at four options, focused on what a smaller coaching business actually needs. Prices are correct as of late 2026 - check each provider's live pricing before switching.

## Practably - simple client and business admin

**Price**: Free for up to 5 clients, then £1.99-£7.99/month up to 50 clients.

**Best for**: coaches who want client records, session scheduling, PARQ health forms, invoicing, and payment-method tracking in one place, without paying for workout-programming tools they don't use.

**Not included**: a built-in workout/nutrition programme builder or exercise video library - Practably assumes you already have your own way of programming sessions.

## PT Distinction - deep customisation for structured coaching

**Price**: From $19.90/month (3 clients) to $89.90/month (50 clients).

**Best for**: coaches running detailed, periodised programmes who want heavy customisation and automation (onboarding sequences, follow-ups) and are happy paying for it.

## TrueCoach - polished client experience

**Price**: From $29.98/month (5 clients) to $164.98/month (50 clients).

**Best for**: strength and conditioning or bodybuilding coaches who prioritise a slick client-facing app experience over price.

## My PT Hub - unlimited clients on one plan

**Price**: From $40/month (3 clients); the mid-tier Premium plan ($105/month) includes unlimited clients on a flat fee.

**Best for**: coaches who expect to scale past 50 clients quickly and want to avoid per-client pricing later, and don't mind paying more up front for that flexibility.

## The actual question to ask

Before comparing feature lists, ask: do you need software to help you *deliver* coaching (programme builders, video libraries, in-app messaging), or software to help you *run the business* around coaching you already know how to deliver (bookings, forms, invoices, payment tracking)?

If it's the second one and your roster is still small, you're likely better off starting with something priced for where you are now rather than where a 50-client business would be. Practably is currently in private beta, built specifically for that - join the waitlist to get early access.`,
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
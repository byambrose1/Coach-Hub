import { publicPlansFromConfig } from "@shared/public-site";
import { featureMinimumPlan, featureLabels, hasFeature, type FeatureName } from "@shared/subscription-features";
import { revenueReport } from "./revenue-report";
import { deleteSupabaseAccounts } from "./auth/identities";
import type { Express, Response } from "express";
import rateLimit from "express-rate-limit";
import { createServer, type Server } from "http";
import { storage as defaultStorage, type IStorage } from "./storage";
import { insertClientSchema, insertSessionSchema, insertPackageSchema, insertSessionNoteSchema, insertClientFormSchema, insertReferralSchema, insertInvoiceSchema, insertSettingsSchema, insertWaitlistSignupSchema, insertBlogPostSchema, type Session } from "@shared/schema";
import { isAuthenticated as defaultIsAuthenticated, authStorage } from "./replit_integrations/auth";
import {
  sendInvoiceEmail as defaultSendInvoiceEmail,
  sendBookingNotificationEmail as defaultSendBookingNotificationEmail,
  sendSessionCancellationEmail,
  sendSessionRescheduleEmail,
  sendParqEmail as defaultSendParqEmail,
  sendLowSessionsEmail as defaultSendLowSessionsEmail,
  sendBroadcastEmail as defaultSendBroadcastEmail,
  sendFeedbackEmail as defaultSendFeedbackEmail,
  sendWaitlistConfirmationEmail,
  sendWaitlistNotificationEmail,
} from "./email";
import type { RequestHandler } from "express";
import type Stripe from "stripe";
import { logError } from "./safe-logging";
import { withBillingCheckoutLock } from "./db";
import { cancelAndRefundSubscription, getSubscriptionRefundStatus, SubscriptionRefundError } from "./subscription-refunds";
import {
  getStripeClient,
  getPractablyCheckoutBranding,
  hasPractablyCheckoutBranding,
  getStripeMode,
  getStripePlanForPrice,
  getStripePriceId,
  getStripeWebhookSecret,
  StripeBillingConfigurationError,
  validateStripeModeForBilling,
  validateStripePrice,
} from "./stripe";

const EMAIL_PROVIDER_ERROR = {
  code: "EMAIL_PROVIDER_ERROR",
  message: "Unable to send the email. Please try again.",
} as const;

declare module "express-session" {
  interface SessionData {
    impersonatedUserId?: string;
    impersonatedUserName?: string;
  }
}

const PLAN_TIER: Record<string, number> = {
  free: 1,
  starter: 2,
  professional: 3,
  business: 4,
};

const ACTIVATION_EVENTS = new Set([
  "signup_started",
  "signup_completed",
  "first_client_created",
  "first_booking_created",
  "first_parq_form_sent",
  "first_invoice_created",
  "first_payment_initiated",
]);

function getPublicSiteUrl(req: any) {
  const configured = process.env.PUBLIC_SITE_URL || process.env.VITE_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("host");
  return `${req.protocol}://${host}`;
}

function getRouteParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function withoutOwnershipFields(body: any) {
  const { id: _id, userId: _userId, ...data } = body || {};
  return data;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

// Finds a scheduling conflict for a candidate session against the coach's
// existing sessions: an overlapping time on the same day. Cancelled sessions
// never conflict. Group sessions are exempt in both directions, since a coach
// running a group class legitimately has several bookings at the same time -
// this only guards against accidentally double-booking 1:1/online/outdoor slots,
// and against booking a real client into time the coach has blocked off.
function findSchedulingConflict(
  existingSessions: Session[],
  candidate: { date: string; startTime: string; endTime: string; sessionType?: string | null },
  excludeSessionId?: string,
): Session | null {
  // Blocking time off is a bulk, coach-only action with no specific client -
  // it should always succeed even on a day that already has sessions, exactly
  // like it does today. Only real client bookings get conflict-checked below.
  if (candidate.sessionType === "blocked") return null;

  const candidateStart = timeToMinutes(candidate.startTime);
  const candidateEnd = timeToMinutes(candidate.endTime);

  for (const existing of existingSessions) {
    if (excludeSessionId && existing.id === excludeSessionId) continue;
    if (existing.date !== candidate.date) continue;
    if (existing.status === "cancelled") continue;
    if (existing.sessionType === "group" || candidate.sessionType === "group") continue;

    const existingStart = timeToMinutes(existing.startTime);
    const existingEnd = timeToMinutes(existing.endTime);
    if (candidateStart < existingEnd && existingStart < candidateEnd) {
      return existing;
    }
  }
  return null;
}

function getRealUserId(req: any): string {
  return req.user?.claims?.sub || "";
}

function getUserId(req: any): string {
  return (req.session as any)?.impersonatedUserId || getRealUserId(req);
}

function stripeObjectId(value: string | { id: string } | null | undefined): string | undefined {
  if (typeof value === "string") return value;
  return value?.id;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const currentShape = (invoice as any).parent?.subscription_details?.subscription;
  return stripeObjectId(currentShape) || stripeObjectId((invoice as any).subscription);
}

class StripeBillingOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeBillingOwnershipError";
  }
}

function isOwner(req: any): boolean {
  const userId = getRealUserId(req);
  const ownerId = process.env.OWNER_USER_ID;
  return !!ownerId && userId === ownerId;
}

// Support staff: comma-separated Replit user IDs in SUPPORT_USER_IDS. They can
// view coach accounts and use impersonation to help troubleshoot, but cannot
// see or change platform pricing/tier configuration or a coach's billing plan.
// Configure this env var with the admin person's Replit user ID once you have it.
function isSupportStaff(req: any): boolean {
  const userId = getRealUserId(req);
  const supportIds = (process.env.SUPPORT_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return supportIds.includes(userId);
}

function isOwnerOrSupport(req: any): boolean {
  return isOwner(req) || isSupportStaff(req);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  dependencies: {
    storage?: IStorage;
    isAuthenticated?: RequestHandler;
    stripeClient?: Stripe;
    withBillingCheckoutLock?: typeof withBillingCheckoutLock;
    sendBookingNotificationEmail?: typeof defaultSendBookingNotificationEmail;
    sendInvoiceEmail?: typeof defaultSendInvoiceEmail;
    sendParqEmail?: typeof defaultSendParqEmail;
    sendLowSessionsEmail?: typeof defaultSendLowSessionsEmail;
    sendBroadcastEmail?: typeof defaultSendBroadcastEmail;
    sendFeedbackEmail?: typeof defaultSendFeedbackEmail;
    deleteAuthUser?: typeof authStorage.deleteUser;
  } = {},
): Promise<Server> {
  const storage = dependencies.storage ?? defaultStorage;
  const isAuthenticated = dependencies.isAuthenticated ?? defaultIsAuthenticated;
  const getBillingStripeClient = () => dependencies.stripeClient ?? getStripeClient();
  const lockBillingUser = dependencies.withBillingCheckoutLock ?? withBillingCheckoutLock;
  const deleteAuthUser = dependencies.deleteAuthUser ?? authStorage.deleteUser.bind(authStorage);
  const sendBookingNotificationEmail =
    dependencies.sendBookingNotificationEmail ?? defaultSendBookingNotificationEmail;
  const sendInvoiceEmail = dependencies.sendInvoiceEmail ?? defaultSendInvoiceEmail;
  const sendParqEmail = dependencies.sendParqEmail ?? defaultSendParqEmail;
  const sendLowSessionsEmail =
    dependencies.sendLowSessionsEmail ?? defaultSendLowSessionsEmail;
  const sendBroadcastEmail =
    dependencies.sendBroadcastEmail ?? defaultSendBroadcastEmail;
  const sendFeedbackEmail =
    dependencies.sendFeedbackEmail ?? defaultSendFeedbackEmail;
  async function requireFeature(res: Response, userId: string, feature: FeatureName): Promise<boolean> {
    try {
      if (hasFeature(await storage.getSettings(userId), feature)) return true;
      const requiredPlan = featureMinimumPlan[feature];
      res.status(403).json({
        code: "PLAN_UPGRADE_REQUIRED", feature, requiredPlan,
        message: `${featureLabels[feature]} requires the ${requiredPlan[0].toUpperCase() + requiredPlan.slice(1)} plan or above.`,
      });
    } catch {
      res.status(503).json({ code: "PLAN_STATUS_UNAVAILABLE", message: "Your plan could not be checked. Please try again." });
    }
    return false;
  }
  app.get("/robots.txt", (req, res) => {
    const siteUrl = getPublicSiteUrl(req);
    res.type("text/plain").send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /admin",
      "Disallow: /platform-admin",
      "Disallow: /settings",
      "Disallow: /clients",
      "Disallow: /schedule",
      "Disallow: /payments",
      `Sitemap: ${siteUrl}/sitemap.xml`,
      "",
    ].join("\n"));
  });

  app.get("/sitemap.xml", async (req, res) => {
    const siteUrl = getPublicSiteUrl(req);
    const publicPaths = ["/", "/pricing", "/privacy", "/terms", "/support", "/blog"];
    let blogUrls: string[] = [];
    try {
      const posts = await storage.getPublishedBlogPosts();
      blogUrls = posts.map((p) => `/blog/${p.slug}`);
    } catch (err) {
      logError("Failed to load blog posts for sitemap", err);
    }
    const urls = [...publicPaths, ...blogUrls]
      .map((pathname) => `  <url><loc>${siteUrl}${pathname}</loc></url>`)
      .join("\n");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  });

  // --- Waitlist (public, pre-launch signup capture) ---
  const waitlistLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many signups from this connection. Please try again later." },
  });

  app.post("/api/waitlist", waitlistLimiter, async (req, res) => {
    // Honeypot: a real visitor never fills this hidden field in; a bot filling
    // every field usually does. Pretend success so scrapers don't learn to skip it.
    if (req.body?.website) return res.status(200).json({ success: true });

    const parsed = insertWaitlistSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    try {
      const existing = await storage.getWaitlistSignupByEmail(parsed.data.email);
      if (existing) return res.status(200).json({ success: true });

      await storage.createWaitlistSignup(parsed.data);
      sendWaitlistConfirmationEmail({ email: parsed.data.email, name: parsed.data.name || undefined }).catch((err) =>
        logError("Waitlist confirmation email failed", err),
      );
      sendWaitlistNotificationEmail({
        email: parsed.data.email,
        name: parsed.data.name || undefined,
        coachingFocus: parsed.data.coachingFocus || undefined,
        howHeard: parsed.data.howHeard || undefined,
      }).catch((err) => logError("Waitlist notification email failed", err));
      res.status(200).json({ success: true });
    } catch (err) {
      logError("Failed to save waitlist signup", err);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get("/api/platform-admin/waitlist", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const signups = await storage.getWaitlistSignups();
      res.json(signups);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Blog (public read; owner-only write) ---
  app.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getPublishedBlogPosts();
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const post = await storage.getPublishedBlogPost(getRouteParam(req.params.slug));
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/platform-admin/blog", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/platform-admin/blog", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    const parsed = insertBlogPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Title, slug, and content are required." });
    try {
      const post = await storage.createBlogPost(parsed.data);
      res.status(201).json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message?.includes("unique") ? "That slug is already in use." : err.message });
    }
  });

  app.put("/api/platform-admin/blog/:id", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    const parsed = insertBlogPostSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid post data." });
    try {
      const post = await storage.updateBlogPost(getRouteParam(req.params.id), parsed.data);
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message?.includes("unique") ? "That slug is already in use." : err.message });
    }
  });

  app.delete("/api/platform-admin/blog/:id", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      await storage.deleteBlogPost(getRouteParam(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/activation-events", (req, res) => {
    const { event } = req.body || {};
    if (typeof event !== "string" || !ACTIVATION_EVENTS.has(event)) {
      return res.status(400).json({ message: "Unknown activation event" });
    }
    if (event !== "signup_started" && !req.isAuthenticated?.()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // No health, client, or payment details are accepted or logged here.
    console.log(`[activation] ${event}`);
    return res.status(204).send();
  });

  app.use("/api/clients", isAuthenticated);
  app.use("/api/sessions", isAuthenticated);
  app.use("/api/packages", isAuthenticated);
  app.use("/api/notes", isAuthenticated);
  app.use("/api/settings", isAuthenticated);
  app.use("/api/forms", isAuthenticated);
  app.use("/api/referrals", isAuthenticated);
  app.use("/api/invoices", isAuthenticated);

  const resolveStripePrice = async (plan: string): Promise<string> => {
    const priceId = getStripePriceId(plan);
    if (!priceId) {
      throw new StripeBillingConfigurationError(
        `The Stripe ${plan} price ID is missing. Configure its price before enabling this plan.`,
      );
    }
    const mode = validateStripeModeForBilling();
    const price = await getBillingStripeClient().prices.retrieve(priceId);
    validateStripePrice(price, plan, mode);
    return priceId;
  };

  const inspectStripeSubscription = async (subscriptionId: string) => {
    const stripe = getBillingStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price", "latest_invoice"],
    });
    const customerId = stripeObjectId(subscription.customer);
    if (!customerId) {
      throw new StripeBillingConfigurationError("Stripe returned a subscription without a customer.");
    }
    if (subscription.items.data.length !== 1 || subscription.items.data[0]?.quantity !== 1) {
      throw new StripeBillingConfigurationError(
        "The Stripe subscription does not match the supported single monthly plan.",
      );
    }
    const priceId = stripeObjectId(subscription.items.data[0]?.price);
    const plan = priceId ? getStripePlanForPrice(priceId) : undefined;
    if (!plan) {
      throw new StripeBillingConfigurationError(
        "The Stripe subscription uses a price that is not configured for this service.",
      );
    }
    await resolveStripePrice(plan);
    const rawLatestInvoice = subscription.latest_invoice;
    const latestInvoice =
      typeof rawLatestInvoice === "string"
        ? await stripe.invoices.retrieve(rawLatestInvoice)
        : rawLatestInvoice;
    const latestInvoiceId =
      typeof rawLatestInvoice === "string" ? rawLatestInvoice : rawLatestInvoice?.id;
    return {
      subscription,
      customerId,
      plan,
      latestInvoiceId,
      latestInvoicePaid:
        latestInvoice?.status === "paid" || (latestInvoice as any)?.paid === true,
      hasPendingUpdate: !!subscription.pending_update,
    };
  };

  const writeSubscriptionState = async (
    userId: string,
    settings: any,
    inspected: Awaited<ReturnType<typeof inspectStripeSubscription>>,
    customerId: string,
    checkoutPaymentVerified: boolean,
    noPaymentRequired: boolean,
    forcedStatus?: string,
  ) => {
    const { subscription, plan, latestInvoiceId, latestInvoicePaid, hasPendingUpdate } = inspected;
    const stripeIsEntitled = ["active", "trialing"].includes(subscription.status);
    const previousPlanWasVerified =
      settings?.stripeSubscriptionId === subscription.id &&
      settings?.subscriptionPlan === plan &&
      ["active", "trialing"].includes(settings?.subscriptionStatus || "");
    const currentPaymentVerified =
      latestInvoicePaid ||
      (checkoutPaymentVerified && noPaymentRequired && !latestInvoiceId);
    const pendingUpdateCanPreservePreviousPlan =
      hasPendingUpdate &&
      settings?.stripeSubscriptionId === subscription.id &&
      settings?.subscriptionPlan === plan &&
      ["active", "trialing"].includes(settings?.subscriptionStatus || "") &&
      ["starter", "professional", "business"].includes(settings?.subscriptionPlan || "");
    const entitled =
      stripeIsEntitled &&
      !forcedStatus &&
      !hasPendingUpdate &&
      (currentPaymentVerified || previousPlanWasVerified);
    const preservedPlan = pendingUpdateCanPreservePreviousPlan
      ? settings.subscriptionPlan
      : undefined;
    const status =
      forcedStatus ||
      (entitled
        ? subscription.status
        : preservedPlan
          ? subscription.status
        : stripeIsEntitled
          ? "pending_payment"
          : subscription.status);
    return storage.upsertSettings(userId, {
      ...(settings || {}),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionPlan: entitled ? plan : preservedPlan || "free",
      subscriptionStatus: status,
    });
  };

  const verifyStripeCustomerOwnership = async (customerId: string, userId: string) => {
    const customer = await getBillingStripeClient().customers.retrieve(customerId);
    if ("deleted" in customer || customer.metadata.userId !== userId) {
      throw new StripeBillingOwnershipError(
        "This Stripe customer is not connected to the authenticated account.",
      );
    }
    return customer;
  };

  const listOpenSubscriptionCheckoutSessions = async (customerId: string) => {
    const stripe = getBillingStripeClient();
    const sessions: Stripe.Checkout.Session[] = [];
    let startingAfter: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 100,
        expand: ["data.line_items"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      sessions.push(...result.data);
      if (!result.has_more || result.data.length === 0) break;
      startingAfter = result.data[result.data.length - 1].id;
    }
    return sessions.filter(
      (session) =>
        session.mode === "subscription" &&
        session.status === "open" &&
        stripeObjectId(session.customer) === customerId,
    );
  };

  const expireCheckoutSessions = async (sessions: Stripe.Checkout.Session[]) => {
    const stripe = getBillingStripeClient();
    for (const session of sessions) {
      await stripe.checkout.sessions.expire(session.id);
    }
  };

  app.get("/api/subscription/status", isAuthenticated, async (_req, res) => {
    const mode = getStripeMode();
    const livemode = mode === "live";
    const messages: string[] = [];
    if (mode === "unconfigured") messages.push("Stripe credentials are not configured.");
    else if (mode === "unknown") messages.push("Stripe credentials have an unrecognized mode.");
    else if (process.env.NODE_ENV === "production" && mode !== "live") {
      messages.push("Live Stripe credentials are required in production.");
    }
    if (!getStripeWebhookSecret() || process.env.STRIPE_WEBHOOK_CONFIGURED !== "true") {
      messages.push("The Stripe webhook signing secret has not been verified for this endpoint.");
    }
    if (!process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
      messages.push("The Stripe Billing Portal configuration has not been configured.");
    }

    if (mode === "live" || mode === "test") {
      try {
        const stripe = getBillingStripeClient();
        const modeForValidation = validateStripeModeForBilling();
        for (const plan of ["starter", "professional", "business"]) {
          const priceId = getStripePriceId(plan);
          if (!priceId) {
            messages.push(`The Stripe ${plan} price ID is not configured.`);
            continue;
          }
          validateStripePrice(await stripe.prices.retrieve(priceId), plan, modeForValidation);
        }
      } catch (err) {
        if (err instanceof StripeBillingConfigurationError) {
          messages.push(err.message);
        } else {
          logError("Stripe billing readiness check failed", err);
          messages.push("Stripe prices could not be verified. Check Stripe configuration and try again.");
        }
      }
    }

    return res.json({
      livemode,
      ready: messages.length === 0,
      ...(messages.length
        ? { message: messages.filter((message, index) => messages.indexOf(message) === index).join(" ") }
        : {}),
    });
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    const signature = req.header("stripe-signature");
    const webhookSecret = getStripeWebhookSecret();
    if (
      !signature ||
      !webhookSecret ||
      process.env.STRIPE_WEBHOOK_CONFIGURED !== "true" ||
      !req.rawBody
    ) {
      return res.status(503).json({ message: "Stripe webhook is not configured." });
    }

    let event: import("stripe").default.Event;
    try {
      event = getBillingStripeClient().webhooks.constructEvent(
        req.rawBody as Buffer,
        signature,
        webhookSecret,
      );
    } catch (err) {
      logError("Stripe webhook signature verification failed", err);
      return res.status(400).json({ message: "Invalid webhook signature." });
    }

    try {
      const mode = validateStripeModeForBilling();
      if (event.livemode !== (mode === "live")) {
        return res.status(400).json({ message: "Stripe webhook mode does not match the configured account." });
      }

      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded" ||
        event.type === "checkout.session.async_payment_failed"
      ) {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = stripeObjectId(session.customer);
        const subscriptionId = stripeObjectId(session.subscription);
        if (
          !userId ||
          !customerId ||
          !subscriptionId ||
          session.mode !== "subscription" ||
          session.status !== "complete"
        ) {
          return res.status(204).send();
        }
        await lockBillingUser(userId, async () => {
          const settings = await storage.getSettings(userId);
          if (!settings || settings.stripeCustomerId !== customerId) return;

          const inspected = await inspectStripeSubscription(subscriptionId);
          if (
            inspected.customerId !== customerId ||
            (inspected.subscription.metadata?.userId &&
              inspected.subscription.metadata.userId !== userId) ||
            (settings.stripeSubscriptionId &&
              settings.stripeSubscriptionId !== subscriptionId &&
              ["active", "trialing"].includes(settings.subscriptionStatus || ""))
          ) {
            return;
          }
          const failed = event.type === "checkout.session.async_payment_failed";
          const paymentVerified =
            !failed &&
            (event.type === "checkout.session.async_payment_succeeded" ||
              session.payment_status === "paid" ||
              session.payment_status === "no_payment_required");
          await writeSubscriptionState(
            userId,
            settings,
            inspected,
            customerId,
            paymentVerified,
            session.payment_status === "no_payment_required",
            failed ? "payment_failed" : undefined,
          );
        });
      } else if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const eventSubscription = event.data.object as Stripe.Subscription;
        const linkedSettings = await storage.getSettingsByStripeSubscriptionId(eventSubscription.id);
        if (!linkedSettings || linkedSettings.stripeSubscriptionId !== eventSubscription.id) {
          return res.status(204).send();
        }
        await lockBillingUser(linkedSettings.id, async () => {
          const settings = await storage.getSettingsByStripeSubscriptionId(eventSubscription.id);
          if (!settings || settings.stripeSubscriptionId !== eventSubscription.id) return;
          const inspected = await inspectStripeSubscription(eventSubscription.id);
          if (
            inspected.customerId !== settings.stripeCustomerId ||
            (inspected.subscription.metadata?.userId &&
              inspected.subscription.metadata.userId !== settings.id)
          ) {
            return;
          }
          await writeSubscriptionState(
            settings.id,
            settings,
            inspected,
            inspected.customerId,
            false,
            false,
          );
        });
      }

      if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (subscriptionId) {
          const linkedSettings = await storage.getSettingsByStripeSubscriptionId(subscriptionId);
          if (!linkedSettings || linkedSettings.stripeSubscriptionId !== subscriptionId) {
            return res.status(204).send();
          }
          await lockBillingUser(linkedSettings.id, async () => {
            const settings = await storage.getSettingsByStripeSubscriptionId(subscriptionId);
            if (!settings || settings.stripeSubscriptionId !== subscriptionId) return;
            const inspected = await inspectStripeSubscription(subscriptionId);
            const invoiceCustomerId = stripeObjectId(invoice.customer);
            if (
              inspected.customerId !== settings.stripeCustomerId ||
              (invoiceCustomerId && invoiceCustomerId !== settings.stripeCustomerId) ||
              (inspected.subscription.metadata?.userId &&
                inspected.subscription.metadata.userId !== settings.id)
            ) {
              return;
            }
            if (
              !invoice.id ||
              invoice.id !== inspected.latestInvoiceId ||
              (event.type === "invoice.paid" && !inspected.latestInvoicePaid) ||
              (event.type === "invoice.payment_failed" && inspected.latestInvoicePaid)
            ) {
              return;
            }
            const paymentFailed = event.type === "invoice.payment_failed";
            const hasPaidPlanToPreserve =
              inspected.hasPendingUpdate &&
              settings.subscriptionPlan === inspected.plan &&
              ["starter", "professional", "business"].includes(settings.subscriptionPlan || "") &&
              ["active", "trialing"].includes(settings.subscriptionStatus || "");
            await writeSubscriptionState(
              settings.id,
              settings,
              inspected,
              inspected.customerId,
              false,
              false,
              paymentFailed && !hasPaidPlanToPreserve ? "past_due" : undefined,
            );
          });
        }
      }

      return res.status(204).send();
    } catch (err) {
      logError("Stripe webhook processing failed", err);
      return res.status(500).json({ message: "Unable to process Stripe webhook." });
    }
  });

  app.post("/api/subscription/checkout", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    return lockBillingUser(userId, async () => {
    try {
      const { plan } = req.body || {};
      if (!["starter", "professional", "business"].includes(plan)) {
        return res.status(400).json({ message: "A paid plan is required." });
      }
      const priceId = await resolveStripePrice(plan);

      const current = await storage.getSettings(userId);
      if (
        !current?.stripeCustomerId &&
        (process.env.STRIPE_WEBHOOK_CONFIGURED !== "true" || !getStripeWebhookSecret())
      ) {
        return res.status(503).json({
          message: "Stripe billing is not ready because the webhook signing secret has not been verified for this endpoint.",
        });
      }
      const claims = (req as any).user?.claims || {};
      const stripe = getBillingStripeClient();
      const customer = current?.stripeCustomerId
        ? current.stripeCustomerId
        : await stripe.customers.create({
            email: claims.email,
            metadata: { userId },
          }).then((created) => created.id);

      if (!current?.stripeCustomerId) {
        await storage.upsertSettings(userId, {
          ...(current || {}),
          stripeCustomerId: customer,
        });
      }
      await verifyStripeCustomerOwnership(customer, userId);
      const openSessions = await listOpenSubscriptionCheckoutSessions(customer);

      const subscriptions = await stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
      });
      const existingSubscription =
        subscriptions.data.find(
          (subscription) =>
            subscription.status !== "canceled" && subscription.status !== "incomplete_expired",
        ) || null;
      if (existingSubscription) {
        await expireCheckoutSessions(openSessions);
        const linkedSettings = await storage.getSettings(userId);
        if (
          (existingSubscription.metadata?.userId &&
            existingSubscription.metadata.userId !== userId) ||
          (linkedSettings?.stripeSubscriptionId &&
            linkedSettings.stripeSubscriptionId !== existingSubscription.id &&
            ["active", "trialing"].includes(linkedSettings.subscriptionStatus || ""))
        ) {
          return res.status(409).json({
            message:
              "An active Stripe subscription already exists for this billing account. Manage it in the Billing Portal before starting another subscription.",
          });
        }
        if (
          existingSubscription.metadata?.userId === userId ||
          linkedSettings?.stripeSubscriptionId === existingSubscription.id
        ) {
          const portalConfig = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
          if (!portalConfig) {
            return res.status(503).json({
              message: "Stripe Billing Portal is not configured. Contact support to manage this subscription.",
            });
          }
          const commonPortalParams: Stripe.BillingPortal.SessionCreateParams = {
            customer,
            configuration: portalConfig,
            return_url: `${getPublicSiteUrl(req)}/settings`,
          };
          if (
            !["active", "trialing"].includes(existingSubscription.status) ||
            existingSubscription.items.data.length !== 1
          ) {
            const portal = await stripe.billingPortal.sessions.create(commonPortalParams);
            return res.json({ url: portal.url, billingPortal: true });
          }
          try {
            const portal = await stripe.billingPortal.sessions.create({
              ...commonPortalParams,
              flow_data: {
                type: "subscription_update_confirm",
                subscription_update_confirm: {
                  subscription: existingSubscription.id,
                  items: [
                    {
                      id: existingSubscription.items.data[0].id,
                      price: priceId,
                      quantity: 1,
                    },
                  ],
                },
              },
            });
            return res.json({ url: portal.url, billingPortal: true });
          } catch (portalFlowError) {
            logError("Targeted Stripe subscription update portal was unavailable", portalFlowError);
            const portal = await stripe.billingPortal.sessions.create(commonPortalParams);
            return res.json({ url: portal.url, billingPortal: true });
          }
        }
        return res.status(409).json({
          message:
            "An active Stripe subscription already exists for this billing account. Manage it in the Billing Portal before starting another subscription.",
        });
      }

      if (!process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
        return res.status(503).json({
          message: "Stripe Billing Portal is not configured. Subscription management is unavailable.",
        });
      }
      if (process.env.STRIPE_WEBHOOK_CONFIGURED !== "true" || !getStripeWebhookSecret()) {
        await expireCheckoutSessions(openSessions);
        return res.status(503).json({
          message: "Stripe billing is not ready because the webhook signing secret has not been verified for this endpoint.",
        });
      }

      const siteUrl = getPublicSiteUrl(req);
      const checkoutBranding = getPractablyCheckoutBranding(siteUrl);
      let reusableSession: Stripe.Checkout.Session | undefined;
      const sessionsToExpire: Stripe.Checkout.Session[] = [];
      for (const openSession of openSessions) {
        const lineItems = (openSession as any).line_items?.data || [];
        const openPriceId =
          lineItems.length === 1 ? stripeObjectId(lineItems[0]?.price) : undefined;
        const openPlan = openPriceId ? getStripePlanForPrice(openPriceId) : undefined;
        const sessionBelongsToUser = openSession.metadata?.userId === userId;
        const notExpired =
          typeof openSession.expires_at === "number" && openSession.expires_at * 1000 > Date.now();
        if (sessionBelongsToUser && openPlan === plan && notExpired && openSession.url &&
          hasPractablyCheckoutBranding(openSession, checkoutBranding)) {
          if (!reusableSession) reusableSession = openSession;
          else sessionsToExpire.push(openSession);
        } else {
          sessionsToExpire.push(openSession);
        }
      }
      await expireCheckoutSessions(sessionsToExpire);
      if (reusableSession?.url) return res.json({ url: reusableSession.url });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        branding_settings: checkoutBranding,
        customer,
        ...(process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true"
          ? {
              automatic_tax: { enabled: true },
              customer_update: { address: "auto" as const, name: "auto" as const },
            }
          : {}),
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${siteUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/settings?billing=cancelled`,
        metadata: { userId, plan },
        subscription_data: { metadata: { userId, plan } },
        allow_promotion_codes: true,
      }, {
        idempotencyKey: `coach-subscription-${userId}-${plan}-${Math.floor(Date.now() / 1000)}`,
      });

      if (!session.url) {
        return res.status(502).json({ message: "Stripe did not return a Checkout URL. Please try again." });
      }
      return res.json({ url: session.url });
    } catch (err) {
      logError("Failed to create Stripe checkout session", err);
      if (err instanceof StripeBillingOwnershipError) {
        return res.status(403).json({ message: err.message });
      }
      if (err instanceof StripeBillingConfigurationError) {
        return res.status(503).json({ message: err.message });
      }
      return res.status(502).json({
        code: "PAYMENT_PROVIDER_ERROR",
        message: "Stripe could not start this subscription. Check billing configuration or try again.",
      });
    }
    });
  });

  app.post("/api/subscription/confirm", isAuthenticated, async (req, res) => {
    const candidateSessionId = req.body?.sessionId ?? req.body?.session_id;
    const sessionId = typeof candidateSessionId === "string" ? candidateSessionId : "";
    if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      return res.status(400).json({ message: "A valid Stripe Checkout session_id is required." });
    }
    const userId = getUserId(req);
    return lockBillingUser(userId, async () => {
    try {
      const stripe = getBillingStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (
        session.mode !== "subscription" ||
        session.status !== "complete" ||
        session.metadata?.userId !== userId
      ) {
        return res.status(403).json({ message: "This Checkout session does not belong to your account." });
      }
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        return res.status(409).json({
          message: "Stripe has not confirmed payment for this subscription yet. Please wait and refresh billing status.",
        });
      }
      const subscriptionId = stripeObjectId(session.subscription);
      const customerId = stripeObjectId(session.customer);
      if (!subscriptionId || !customerId) {
        return res.status(409).json({ message: "Stripe has not attached a subscription to this Checkout session." });
      }
      const settings = await storage.getSettings(userId);
      if (!settings || settings.stripeCustomerId !== customerId) {
        return res.status(403).json({ message: "This Checkout session is not linked to your billing account." });
      }
      await verifyStripeCustomerOwnership(customerId, userId);
      if (
        settings.stripeSubscriptionId &&
        settings.stripeSubscriptionId !== subscriptionId &&
        ["active", "trialing"].includes(settings.subscriptionStatus || "")
      ) {
        return res.status(409).json({
          message: "A different active subscription is already linked to your account.",
        });
      }
      const inspected = await inspectStripeSubscription(subscriptionId);
      if (
        inspected.customerId !== customerId ||
        (inspected.subscription.metadata?.userId &&
          inspected.subscription.metadata.userId !== userId)
      ) {
        return res.status(403).json({ message: "The Stripe subscription does not belong to your billing account." });
      }
      if (!["active", "trialing"].includes(inspected.subscription.status)) {
        return res.status(409).json({
          message: "The Checkout payment is confirmed, but the subscription is not active yet.",
        });
      }
      const synchronized = await writeSubscriptionState(
        userId,
        settings,
        inspected,
        customerId,
        true,
        session.payment_status === "no_payment_required",
      );
      if (
        synchronized.subscriptionPlan !== inspected.plan ||
        !["active", "trialing"].includes(synchronized.subscriptionStatus || "")
      ) {
        return res.status(409).json({
          message: "The latest subscription invoice or pending plan update is not yet confirmed as paid.",
        });
      }
      return res.json({
        verified: true,
        subscriptionPlan: inspected.plan,
        subscriptionStatus: inspected.subscription.status,
      });
    } catch (err) {
      logError("Stripe Checkout confirmation failed", err);
      if (err instanceof StripeBillingConfigurationError) {
        return res.status(503).json({ message: err.message });
      }
      if (err instanceof StripeBillingOwnershipError) {
        return res.status(403).json({ message: err.message });
      }
      return res.status(502).json({
        message: "Stripe could not verify this Checkout session. Please try again shortly.",
      });
    }
    });
  });

  app.get("/api/subscription/refund", isAuthenticated, async (req, res) => {
    try {
      return res.json(await getSubscriptionRefundStatus(getUserId(req), {
        stripe: getBillingStripeClient(),
        storage,
      }));
    } catch (err) {
      logError("Subscription refund eligibility check failed", err);
      if (err instanceof SubscriptionRefundError) {
        return res.status(err.status).json({ code: err.code, message: err.message });
      }
      if (err instanceof StripeBillingConfigurationError) {
        return res.status(503).json({ message: err.message });
      }
      return res.status(502).json({ message: "Refund eligibility could not be checked. Please try again." });
    }
  });

  app.post("/api/subscription/refund", isAuthenticated, async (req, res) => {
    if (req.session?.impersonatedUserId) {
      return res.status(403).json({ message: "Refunds cannot be requested while impersonating another coach." });
    }
    if (req.body?.confirm !== true || Object.keys(req.body).some(key => key !== "confirm")) {
      return res.status(400).json({ message: "Confirm cancellation and refund without supplying payment or account identifiers." });
    }
    try {
      return res.json(await lockBillingUser(getRealUserId(req), () => cancelAndRefundSubscription(getRealUserId(req), {
        stripe: getBillingStripeClient(),
        storage,
      })));
    } catch (err) {
      logError("Subscription cancellation and refund failed", err);
      if (err instanceof SubscriptionRefundError) {
        return res.status(err.status).json({ code: err.code, message: err.message });
      }
      if (err instanceof StripeBillingConfigurationError) {
        return res.status(503).json({ message: err.message });
      }
      return res.status(502).json({ message: "The refund and cancellation could not both be confirmed. Please refresh refund status and retry to finish. Do not submit another payment." });
    }
  });

  app.post("/api/subscription/portal", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const settings = await storage.getSettings(userId);
      if (!settings?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe billing account is connected yet." });
      }
      const portalConfiguration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
      if (!portalConfiguration) {
        return res.status(503).json({
          message: "Stripe Billing Portal is not configured. Contact support to manage your subscription.",
        });
      }
      validateStripeModeForBilling();
      await verifyStripeCustomerOwnership(settings.stripeCustomerId, userId);
      const portal = await getBillingStripeClient().billingPortal.sessions.create({
        customer: settings.stripeCustomerId,
        configuration: portalConfiguration,
        return_url: `${getPublicSiteUrl(req)}/settings`,
      });
      return res.json({ url: portal.url });
    } catch (err) {
      logError("Failed to create Stripe customer portal session", err);
      if (err instanceof StripeBillingOwnershipError) {
        return res.status(403).json({ message: err.message });
      }
      if (err instanceof StripeBillingConfigurationError) {
        return res.status(503).json({ message: err.message });
      }
      return res.status(502).json({
        code: "PAYMENT_PROVIDER_ERROR",
        message: "Stripe could not open the Billing Portal. Please try again.",
      });
    }
  });

  // --- PARQ Email ---
  app.post("/api/parq/send-email", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { clientId } = req.body;
      const client = await storage.getClient(userId, clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.email) return res.status(400).json({ message: "Client has no email address" });
      const s = await storage.getSettings(userId);
      await sendParqEmail({
        clientName: client.name,
        clientEmail: client.email,
        trainerName: s?.trainerName || "Coach",
        businessName: s?.businessName || "",
        trainerEmail: s?.trainerEmail || undefined,
      });
      res.json({ message: "PAR-Q email sent successfully" });
    } catch (err) {
      logError("Failed to send PAR-Q email", err);
      res.status(502).json(EMAIL_PROVIDER_ERROR);
    }
  });

  // --- Broadcast Email ---
  // Tighter limit than the general API guard: this fans out to every client
  // on the account, so it's the one endpoint that turns abuse or a stolen
  // session into a spam/cost problem outside the app itself.
  const broadcastEmailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many broadcast emails sent. Please try again later." },
  });

  app.post("/api/emails/broadcast", isAuthenticated, broadcastEmailLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await requireFeature(res, userId, "broadcastEmails")) return;
      const { subject, message, recipientFilter } = req.body;
      if (!subject?.trim()) return res.status(400).json({ message: "Subject is required" });
      if (!message?.trim()) return res.status(400).json({ message: "Message is required" });

      const allClients = await storage.getClients(userId);
      const s = await storage.getSettings(userId);

      const eligible = allClients.filter((c) => {
        if (!c.email) return false;
        if (recipientFilter === "active") return c.status === "active";
        return true;
      });

      if (eligible.length === 0) {
        return res.status(400).json({ message: "No clients with email addresses found" });
      }

      const recipients = eligible.map((c) => ({ name: c.name, email: c.email! }));
      const result = await sendBroadcastEmail({
        subject,
        message,
        recipients,
        trainerName: s?.trainerName || "Coach",
        businessName: s?.businessName || undefined,
        trainerEmail: s?.trainerEmail || undefined,
      });

      res.json(result);
    } catch (err) {
      logError("Failed to send broadcast email", err);
      res.status(502).json(EMAIL_PROVIDER_ERROR);
    }
  });

  // --- Feedback / feature requests ---
  const FEEDBACK_TYPES = new Set(["bug", "feature", "general"]);
  const feedbackLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too much feedback sent. Please try again later." },
  });

  app.post("/api/feedback", isAuthenticated, feedbackLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { type, message } = req.body || {};
      if (!message?.trim()) return res.status(400).json({ message: "Message is required" });
      const feedbackType = FEEDBACK_TYPES.has(type) ? type : "general";

      const s = await storage.getSettings(userId);
      const claims = (req as any).user?.claims || {};
      await sendFeedbackEmail({
        coachName: s?.trainerName || claims.email || "A coach",
        coachEmail: s?.trainerEmail || claims.email || undefined,
        businessName: s?.businessName || undefined,
        type: feedbackType,
        message: message.trim(),
      });
      res.json({ success: true });
    } catch (err) {
      logError("Failed to send feedback email", err);
      res.status(502).json(EMAIL_PROVIDER_ERROR);
    }
  });

  // --- Coach-level admin (per-user stats) ---
  app.get("/api/admin/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const [clientList, sessions, packages, invoices, notes, forms] = await Promise.all([
        storage.getClients(userId),
        storage.getSessions(userId),
        storage.getPackages(userId),
        storage.getInvoices(userId),
        storage.getNotes(userId),
        storage.getClientForms(userId),
      ]);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];

      res.json({
        totalClients: clientList.length,
        activeClients: clientList.filter(c => c.status === "active").length,
        totalSessions: sessions.length,
        sessionsThisWeek: sessions.filter(s => s.date >= weekAgoStr && s.date <= todayStr).length,
        sessionsThisMonth: sessions.filter(s => s.date >= monthStartStr && s.date <= todayStr).length,
        totalInvoices: invoices.length,
        pendingInvoices: invoices.filter(i => i.status === "pending").length,
        paidInvoicesThisMonth: invoices.filter(i => i.status === "paid" && i.paidDate && i.paidDate >= monthStartStr).length,
        totalRevenue: invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
        monthlyRevenue: invoices.filter(i => i.status === "paid" && i.paidDate && i.paidDate >= monthStartStr).reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
        activePackages: packages.filter(p => p.status === "active").length,
        monthlySubscribers: packages.filter(p => p.billingType === "monthly" && p.status === "active").length,
        totalNotes: notes.length,
        totalForms: forms.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Platform Owner Admin ---
  app.get("/api/platform-admin/role", isAuthenticated, async (req, res) => {
    if (!isOwnerOrSupport(req)) return res.status(403).json({ message: "Forbidden" });
    res.json({ role: isOwner(req) ? "owner" : "support" });
  });

  app.get("/api/platform-admin/stats", isAuthenticated, async (req, res) => {
    if (!isOwnerOrSupport(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/platform-admin/users", isAuthenticated, async (req, res) => {
    if (!isOwnerOrSupport(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/platform-admin/config", isAuthenticated, async (req, res) => {
    if (!isOwnerOrSupport(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const config = await storage.getPlatformConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/platform-admin/config", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const config = await storage.upsertPlatformConfig(req.body);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/platform-admin/coaches/:coachId", isAuthenticated, async (req, res) => {
    if (!isOwnerOrSupport(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const detail = await storage.getCoachDetail(getRouteParam(req.params.coachId));
      if (!detail) return res.status(404).json({ message: "Coach not found" });
      res.json(detail);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/platform-admin/coaches/:coachId/plan", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { plan } = req.body;
      if (!["free", "starter", "professional", "business"].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      await storage.updateCoachPlan(getRouteParam(req.params.coachId), plan);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/platform-admin/impersonate/:userId", isAuthenticated, async (req, res) => {
    if (!isOwnerOrSupport(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const targetUserId = getRouteParam(req.params.userId);
      if (targetUserId === getRealUserId(req)) {
        return res.status(400).json({ message: "Cannot impersonate yourself" });
      }
      const detail = await storage.getCoachDetail(targetUserId);
      if (!detail) return res.status(404).json({ message: "Coach not found" });
      (req.session as any).impersonatedUserId = targetUserId;
      (req.session as any).impersonatedUserName = detail.coach.firstName || detail.coach.email || "Coach";
      res.json({ success: true, name: (req.session as any).impersonatedUserName });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/platform-admin/stop-impersonate", isAuthenticated, async (req, res) => {
    delete (req.session as any).impersonatedUserId;
    delete (req.session as any).impersonatedUserName;
    res.json({ success: true });
  });

  // --- Subscription tiers (public, authenticated coaches) ---
  app.get("/api/subscription/tiers", async (_req, res) => {
    try {
      const config = await storage.getPlatformConfig();
      res.json(publicPlansFromConfig(config));
    } catch (err) {
      logError("Unable to load public pricing", err);
      res.status(503).json({ message: "Pricing is temporarily unavailable. Please try again shortly." });
    }
  });

  app.patch("/api/settings/plan", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { plan } = req.body;
      if (!["free", "starter", "professional", "business"].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      if (plan !== "free") {
        return res.status(402).json({
          code: "CHECKOUT_REQUIRED",
          message: "Paid plan changes must be completed through Stripe Checkout.",
        });
      }
      const [config, existingClients, currentSettings] = await Promise.all([
        storage.getPlatformConfig(),
        storage.getClients(userId),
        storage.getSettings(userId),
      ]);
      const tierMaxMap: Record<string, number> = {
        free: config.tier1MaxClients ?? 5,
        starter: config.tier2MaxClients ?? 10,
        professional: config.tier3MaxClients ?? 20,
        business: config.tier4MaxClients ?? 50,
      };
      const targetMax = tierMaxMap[plan];
      const currentPlan = currentSettings?.subscriptionPlan || "free";
      const isDowngrade = PLAN_TIER[plan] < PLAN_TIER[currentPlan];
      if (currentSettings?.stripeSubscriptionId) {
        if (!currentSettings.stripeCustomerId) {
          return res.status(409).json({
            code: "BILLING_ACCOUNT_INCOMPLETE",
            message: "This Stripe subscription needs support before the local plan can be changed.",
          });
        }
        const portalConfiguration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
        if (!portalConfiguration) {
          return res.status(503).json({
            code: "BILLING_PORTAL_UNAVAILABLE",
            message: "Stripe Billing Portal is not configured. Contact support to manage or cancel your subscription.",
          });
        }
        validateStripeModeForBilling();
        await verifyStripeCustomerOwnership(currentSettings.stripeCustomerId, userId);
        const portal = await getBillingStripeClient().billingPortal.sessions.create({
          customer: currentSettings.stripeCustomerId,
          configuration: portalConfiguration,
          return_url: `${getPublicSiteUrl(req)}/settings`,
        });
        return res.status(409).json({
          code: "BILLING_PORTAL_REQUIRED",
          message: "Manage or cancel your Stripe subscription through the Stripe Billing Portal.",
          portalUrl: portal.url,
        });
      }
      if (isDowngrade && existingClients.length > targetMax) {
        return res.status(400).json({
          message: `You have ${existingClients.length} clients. The ${plan} plan only allows ${targetMax}. Remove ${existingClients.length - targetMax} client(s) first.`,
          currentCount: existingClients.length,
          targetMax,
        });
      }
      const updated = await storage.upsertSettings(userId, {
        ...currentSettings,
        subscriptionPlan: plan,
        subscriptionStatus: plan === "free" ? "trial" : "active",
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof StripeBillingOwnershipError) {
        return res.status(403).json({ message: err.message });
      }
      if (err instanceof StripeBillingConfigurationError) {
        return res.status(503).json({ message: err.message });
      }
      logError("Failed to update coach subscription plan", err);
      res.status(502).json({ message: "Unable to update the plan. Please try again." });
    }
  });

  // --- Clients ---
  app.get("/api/clients", async (req, res) => {
    const userId = getUserId(req);
    const clientList = await storage.getClients(userId);
    res.json(clientList);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(getUserId(req), req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    // Enforce tier limits
    try {
      const [existingClients, coachSettings, config] = await Promise.all([
        storage.getClients(userId),
        storage.getSettings(userId),
        storage.getPlatformConfig(),
      ]);
      const plan = coachSettings?.subscriptionPlan || "free";
      const tier = PLAN_TIER[plan] || 1;
      const tierMaxMap: Record<number, number> = {
        1: config.tier1MaxClients ?? 5,
        2: config.tier2MaxClients ?? 10,
        3: config.tier3MaxClients ?? 20,
        4: config.tier4MaxClients ?? 50,
      };
      const currentMax = tierMaxMap[tier];
      if (existingClients.length >= currentMax) {
        const nextTier = Math.min(tier + 1, 4);
        const nextTierMax = tierMaxMap[nextTier];
        const tierPriceMap: Record<number, string> = {
          1: config.tier1Price ?? "0",
          2: config.tier2Price ?? "1.99",
          3: config.tier3Price ?? "4.99",
          4: config.tier4Price ?? "7.99",
        };
        const tierLinkMap: Record<number, string> = {
          1: config.tier1PaymentLink ?? "",
          2: config.tier2PaymentLink ?? "",
          3: config.tier3PaymentLink ?? "",
          4: config.tier4PaymentLink ?? "",
        };
        const planNames: Record<number, string> = { 1: "free", 2: "starter", 3: "professional", 4: "business" };
        return res.status(402).json({
          code: "CLIENT_LIMIT_EXCEEDED",
          currentCount: existingClients.length,
          currentPlan: plan,
          currentMax,
          nextTier,
          nextTierMax,
          nextTierPrice: tierPriceMap[nextTier],
          nextTierPlan: planNames[nextTier],
          paymentLink: tierLinkMap[nextTier],
        });
      }
    } catch (err) {
      logError("Tier check error", err);
    }

    const client = await storage.createClient(userId, parsed.data);
    res.status(201).json(client);
  });

  app.patch("/api/clients/:id", async (req, res) => {
    const client = await storage.updateClient(getUserId(req), req.params.id, withoutOwnershipFields(req.body));
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.delete("/api/clients/:id", async (req, res) => {
    const userId = getUserId(req);
    const client = await storage.getClient(userId, req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    await storage.deleteClient(userId, req.params.id);
    res.status(204).send();
  });

  app.get("/api/clients/:id/export", async (req, res) => {
    const userId = getUserId(req);
    const client = await storage.getClient(userId, req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const sessions = await storage.getSessions(userId);
    const clientSessions = sessions.filter(s => s.clientId === client.id);
    const pkgs = await storage.getPackages(userId);
    const clientPackages = pkgs.filter(p => p.clientId === client.id);
    const notes = await storage.getNotes(userId);
    const clientNotes = notes.filter(n => n.clientId === client.id);
    const forms = await storage.getClientForms(userId);
    const clientForms = forms.filter(f => f.clientId === client.id);
    const invoices = await storage.getInvoices(userId);
    const clientInvoices = invoices.filter(i => i.clientId === client.id);
    res.json({ client, sessions: clientSessions, packages: clientPackages, notes: clientNotes, forms: clientForms, invoices: clientInvoices });
  });

  // --- Sessions ---
  app.get("/api/sessions", async (req, res) => {
    const userId = getUserId(req);
    const sessions = await storage.getSessions(userId);
    res.json(sessions);
  });

  app.get("/api/sessions/:id", async (req, res) => {
    const session = await storage.getSession(getUserId(req), req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  app.post("/api/sessions", async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const existingSessions = await storage.getSessions(userId);
    const conflict = findSchedulingConflict(existingSessions, parsed.data);
    if (conflict) {
      const isBlocked = conflict.clientId === "__blocked__";
      return res.status(409).json({
        message: isBlocked
          ? `That time overlaps with time you've blocked off (${conflict.startTime}-${conflict.endTime}).`
          : `That time overlaps with another session (${conflict.startTime}-${conflict.endTime}). Pick a different time or reschedule the existing one first.`,
        conflictingSessionId: conflict.id,
      });
    }

    const session = await storage.createSession(userId, parsed.data);

    // Deduct 1 session from the client's active block package when booked
    try {
      const pkgs = await storage.getPackages(userId);
      const activePackage = pkgs.find(
        (p) => p.clientId === session.clientId && p.status === "active" && p.billingType === "block" && (p.totalSessions - (p.usedSessions || 0)) > 0
      );
      if (activePackage) {
        await storage.updatePackage(userId, activePackage.id, {
          usedSessions: (activePackage.usedSessions || 0) + 1,
        });
      }
    } catch (err) {
      logError("Package deduction error", err);
    }

    try {
      const client = await storage.getClient(userId, session.clientId);
      const s = await storage.getSettings(userId);
      if (client?.email && s?.enableEmailNotifications && hasFeature(s, "emailNotifications")) {
        await sendBookingNotificationEmail({
          clientName: client.name,
          clientEmail: client.email,
          sessionDate: session.date,
          sessionTime: session.startTime,
          trainerName: s?.trainerName || "Coach",
          businessName: s?.businessName || "",
          trainerEmail: s?.trainerEmail || undefined,
        });
      }
    } catch (err) {
      logError("Notification error", err);
    }

    res.status(201).json(session);
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    const userId = getUserId(req);
    const existing = await storage.getSession(userId, req.params.id);
    if (!existing) return res.status(404).json({ message: "Session not found" });

    const isReschedule = req.body.date !== undefined || req.body.startTime !== undefined || req.body.endTime !== undefined;
    if (isReschedule) {
      const candidate = {
        date: req.body.date ?? existing.date,
        startTime: req.body.startTime ?? existing.startTime,
        endTime: req.body.endTime ?? existing.endTime,
        sessionType: req.body.sessionType ?? existing.sessionType,
      };
      const existingSessions = await storage.getSessions(userId);
      const conflict = findSchedulingConflict(existingSessions, candidate, existing.id);
      if (conflict) {
        const isBlocked = conflict.clientId === "__blocked__";
        return res.status(409).json({
          message: isBlocked
            ? `That time overlaps with time you've blocked off (${conflict.startTime}-${conflict.endTime}).`
            : `That time overlaps with another session (${conflict.startTime}-${conflict.endTime}). Pick a different time or reschedule the existing one first.`,
          conflictingSessionId: conflict.id,
        });
      }
    }

    const session = await storage.updateSession(userId, req.params.id, withoutOwnershipFields(req.body));
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Handle session count on cancellation
    if (req.body.status === "cancelled" && existing?.status !== "cancelled") {
      const userId = session.userId || "";
      const pkgs = await storage.getPackages(userId);
      const activePackage = pkgs.find(
        (p) => p.clientId === session.clientId && p.status === "active" && p.billingType === "block"
      );
      // If deductSession is true, coach chose to keep deduction (late cancel penalty)
      // Otherwise restore the session back to the package
      if (!req.body.deductSession && activePackage && (activePackage.usedSessions || 0) > 0) {
        await storage.updatePackage(userId, activePackage.id, {
          usedSessions: (activePackage.usedSessions || 0) - 1,
        });
      }
    }

    try {
      const client = await storage.getClient(userId, session.clientId);
      const s = await storage.getSettings(userId);
      if (client?.email && existing && s?.enableEmailNotifications && hasFeature(s, "emailNotifications")) {
        const emailData = {
          clientName: client.name,
          clientEmail: client.email,
          trainerName: s?.trainerName || "Coach",
          businessName: s?.businessName || "",
          trainerEmail: s?.trainerEmail || undefined,
        };

        if (req.body.status === "cancelled" && existing.status !== "cancelled") {
          await sendSessionCancellationEmail({
            ...emailData,
            sessionDate: session.date,
            sessionTime: session.startTime,
          });
        } else if ((req.body.date && req.body.date !== existing.date) || (req.body.startTime && req.body.startTime !== existing.startTime)) {
          await sendSessionRescheduleEmail({
            ...emailData,
            newDate: session.date,
            newTime: session.startTime,
            oldDate: existing.date,
            oldTime: existing.startTime,
          });
        }
      }
    } catch (err) {
      logError("Notification error", err);
    }

    res.json(session);
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    const userId = getUserId(req);
    const session = await storage.getSession(userId, req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    await storage.deleteSession(userId, req.params.id);
    res.status(204).send();
  });

  // --- Packages ---
  app.get("/api/packages", async (req, res) => {
    const userId = getUserId(req);
    const pkgs = await storage.getPackages(userId);
    res.json(pkgs);
  });

  app.post("/api/packages", async (req, res) => {
    const userId = getUserId(req);
    if ((req.body.billingType === "monthly" || req.body.monthlyRate || req.body.nextBillingDate) &&
        !await requireFeature(res, userId, "paymentTracking")) return;
    const parsed = insertPackageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const pkg = await storage.createPackage(userId, parsed.data);
    res.status(201).json(pkg);
  });

  app.patch("/api/packages/:id", async (req, res) => {
    const userId = getUserId(req);
    if ((req.body.billingType === "monthly" || req.body.monthlyRate || req.body.nextBillingDate) &&
        !await requireFeature(res, userId, "paymentTracking")) return;
    const pkg = await storage.updatePackage(userId, req.params.id, withoutOwnershipFields(req.body));
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    if (req.body.billingType === "monthly" && !req.body.nextBillingDate && !pkg.nextBillingDate) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      await storage.updatePackage(userId, req.params.id, {
        nextBillingDate: nextMonth.toISOString().split("T")[0],
      });
    }
    res.json(pkg);
  });

  app.post("/api/packages/:id/notify-low-sessions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await requireFeature(res, userId, "emailNotifications")) return;
      const pkg = await storage.getPackage(userId, getRouteParam(req.params.id));
      if (!pkg) return res.status(404).json({ message: "Package not found" });
      const client = await storage.getClient(userId, pkg.clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.email) return res.status(400).json({ message: "Client has no email address" });
      const settings = await storage.getSettings(userId);
      const remaining = pkg.totalSessions - (pkg.usedSessions || 0);
      await sendLowSessionsEmail({
        clientName: client.name,
        clientEmail: client.email,
        packageName: pkg.name,
        remainingSessions: remaining,
        trainerName: settings?.trainerName || "Your Trainer",
        businessName: settings?.businessName || undefined,
        trainerEmail: settings?.trainerEmail || undefined,
        paymentMethods: settings,
      });
      res.json({ success: true });
    } catch (err) {
      logError("Failed to send low sessions notification", err);
      res.status(502).json(EMAIL_PROVIDER_ERROR);
    }
  });

  // --- Notes ---
  app.get("/api/notes", async (req, res) => {
    const userId = getUserId(req);
    const notes = await storage.getNotes(userId);
    res.json(notes);
  });

  app.get("/api/notes/:id", async (req, res) => {
    const note = await storage.getNote(getUserId(req), req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json(note);
  });

  app.post("/api/notes", async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertSessionNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const note = await storage.createNote(userId, parsed.data);
    res.status(201).json(note);
  });

  app.patch("/api/notes/:id", async (req, res) => {
    const note = await storage.updateNote(getUserId(req), req.params.id, withoutOwnershipFields(req.body));
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json(note);
  });

  app.delete("/api/notes/:id", async (req, res) => {
    const userId = getUserId(req);
    const note = await storage.getNote(userId, req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    await storage.deleteNote(userId, req.params.id);
    res.status(204).send();
  });

  // --- Settings ---
  app.get("/api/settings", async (req, res) => {
    const userId = getUserId(req);
    let s = await storage.getSettings(userId);
    if (!s) {
      s = await storage.upsertSettings(userId, {
        trainerName: "Coach",
        cancellationPolicy: "",
        paymentLink: "",
        businessName: "",
        lowSessionThreshold: 2,
      });
    }
    res.json(s);
  });

  app.put("/api/settings", async (req, res) => {
    const userId = getUserId(req);
    const settingsInput = { ...(req.body || {}) };
    delete settingsInput.stripeCustomerId;
    delete settingsInput.stripeSubscriptionId;
    delete settingsInput.subscriptionPlan;
    delete settingsInput.subscriptionStatus;
    const parsed = insertSettingsSchema.partial().safeParse(settingsInput);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    let existing;
    try { existing = await storage.getSettings(userId); }
    catch { return res.status(503).json({ message: "Your current settings could not be checked. Please try again." }); }
    const businessChanged = (["businessName", "businessAddress"] as const).some(key =>
      Object.hasOwn(parsed.data, key) && (parsed.data[key] || "") !== (existing?.[key] || ""),
    );
    if (businessChanged && !await requireFeature(res, userId, "customBusinessDetails")) return;
    if (parsed.data.enableEmailNotifications === true && existing?.enableEmailNotifications !== true &&
        !await requireFeature(res, userId, "emailNotifications")) return;
    if (parsed.data.enableSessionReminders === true && existing?.enableSessionReminders !== true) {
      return res.status(503).json({ code: "REMINDERS_UNAVAILABLE", message: "Scheduled session reminders are not available yet." });
    }
    const s = await storage.upsertSettings(userId, parsed.data);
    res.json(s);
  });

  // --- Client Forms ---
  app.get("/api/forms", async (req, res) => {
    const userId = getUserId(req);
    const forms = await storage.getClientForms(userId);
    res.json(forms);
  });

  app.get("/api/forms/:id", async (req, res) => {
    const form = await storage.getClientForm(getUserId(req), req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });
    res.json(form);
  });

  app.post("/api/forms", async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertClientFormSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const form = await storage.createClientForm(userId, parsed.data);
    res.status(201).json(form);
  });

  app.patch("/api/forms/:id", async (req, res) => {
    const form = await storage.updateClientForm(getUserId(req), req.params.id, withoutOwnershipFields(req.body));
    if (!form) return res.status(404).json({ message: "Form not found" });
    res.json(form);
  });

  app.delete("/api/forms/:id", async (req, res) => {
    const userId = getUserId(req);
    const form = await storage.getClientForm(userId, req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });
    await storage.deleteClientForm(userId, req.params.id);
    res.status(204).send();
  });

  // --- Referrals ---
  app.get("/api/referrals", async (req, res) => {
    const userId = getUserId(req);
    const refs = await storage.getReferrals(userId);
    res.json(refs);
  });

  app.post("/api/referrals", async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertReferralSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const ref = await storage.createReferral(userId, parsed.data);
    res.status(201).json(ref);
  });

  app.patch("/api/referrals/:id", async (req, res) => {
    const ref = await storage.updateReferral(getUserId(req), req.params.id, withoutOwnershipFields(req.body));
    if (!ref) return res.status(404).json({ message: "Referral not found" });
    res.json(ref);
  });

  // Reports are a paid operation; fetching one's own invoices for a PDF or
  // export stays available on Free and is not a reporting entitlement.
  app.get("/api/revenue", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!await requireFeature(res, userId, "revenueTracking")) return;
    const { from: requestedFrom, to: requestedTo, clientId, period = "month" } = req.query;
    const advancedRequest = requestedFrom !== undefined || requestedTo !== undefined || clientId !== undefined;
    if (advancedRequest && !await requireFeature(res, userId, "advancedRevenue")) return;
    if (!["week", "month"].includes(String(period)) ||
        (clientId !== undefined && typeof clientId !== "string")) {
      return res.status(400).json({ message: "Invalid revenue filters" });
    }
    const validDate = (value: unknown): value is string => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    if (period === "week") {
      start.setTime(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
      end.setTime(start.getTime());
      end.setUTCDate(end.getUTCDate() + 6);
    }
    let from = start.toISOString().slice(0, 10), to = end.toISOString().slice(0, 10);
    if (requestedFrom !== undefined || requestedTo !== undefined) {
      if (!validDate(requestedFrom) || !validDate(requestedTo) || requestedFrom > requestedTo) {
        return res.status(400).json({ message: "Supply a valid start and end date, in date order." });
      }
      from = requestedFrom; to = requestedTo;
    }
    try {
      const [current, invoices, packages, clients] = await Promise.all([
        storage.getSettings(userId), storage.getInvoices(userId),
        storage.getPackages(userId), storage.getClients(userId),
      ]);
      // Recheck after reads so a concurrent downgrade cannot grant a report.
      if (!hasFeature(current, "revenueTracking") ||
          (advancedRequest && !hasFeature(current, "advancedRevenue"))) {
        return res.status(403).json({ code: "PLAN_UPGRADE_REQUIRED", message: "Your plan changed. Please refresh." });
      }
      if (clientId && !clients.some(client => client.id === clientId)) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(revenueReport(invoices, packages, clients, from, to,
        hasFeature(current, "advancedRevenue"), clientId as string | undefined));
    } catch {
      res.status(503).json({ message: "Revenue could not be calculated. Please retry or check the invoice amounts." });
    }
  });

  // --- Invoices ---
  app.get("/api/invoices", async (req, res) => {
    const userId = getUserId(req);
    const invs = await storage.getInvoices(userId);
    res.json(invs);
  });

  app.post("/api/invoices", async (req, res) => {
    const userId = getUserId(req);
    if (!["pending", "paid", "sent", "overdue"].includes(req.body.status || "pending")) {
      return res.status(400).json({ message: "Invalid invoice status" });
    }
    if ((req.body.status === "sent" || req.body.sentDate) &&
        !await requireFeature(res, userId, "invoiceManagement")) return;
    if ((["paid", "overdue"].includes(req.body.status) || req.body.paymentMethod || req.body.paidDate) &&
        !await requireFeature(res, userId, "paymentTracking")) return;
    const parsed = insertInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const inv = await storage.createInvoice(userId, parsed.data);
    res.status(201).json(inv);
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    const userId = getUserId(req);
    const existing = await storage.getInvoice(userId, req.params.id);
    if (!existing) return res.status(404).json({ message: "Invoice not found" });
    const details = ["invoiceNumber", "amount", "dueDate", "notes", "clientId", "packageId", "sentDate"];
    const feature = details.some(key => Object.hasOwn(req.body, key)) || req.body.status === "sent"
      ? "invoiceManagement" : "paymentTracking";
    if (!await requireFeature(res, userId, feature)) return;
    if (req.body.status !== undefined && !["pending", "paid", "sent", "overdue"].includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid invoice status" });
    }
    const inv = await storage.updateInvoice(userId, req.params.id, withoutOwnershipFields(req.body));
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json(inv);
  });

  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      const userId = getUserId(req);
      const inv = await storage.getInvoice(userId, req.params.id);
      if (!inv) return res.status(404).json({ message: "Invoice not found" });
      if (!await requireFeature(res, userId, "invoiceManagement")) return;
      const client = await storage.getClient(userId, inv.clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.email) return res.status(400).json({ message: "Client has no email address" });
      const s = await storage.getSettings(userId);
      const currency = s?.currency || "£";

      await sendInvoiceEmail({
        clientName: client.name,
        clientEmail: client.email,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        currency,
        dueDate: inv.dueDate,
        notes: inv.notes || undefined,
        trainerName: s?.trainerName || "Coach",
        businessName: s?.businessName || "",
        businessAddress: s?.businessAddress || undefined,
        trainerEmail: s?.trainerEmail || undefined,
        paymentMethods: s,
      });

      const updated = await storage.updateInvoice(userId, req.params.id, {
        status: "sent",
        sentDate: new Date().toISOString().split("T")[0],
      });

      res.json(updated);
    } catch (err) {
      logError("Error sending invoice email", err);
      res.status(502).json(EMAIL_PROVIDER_ERROR);
    }
  });

  // --- Account deletion (self-service) ---
  app.delete("/api/account", isAuthenticated, async (req, res) => {
    if ((req.session as any)?.impersonatedUserId) {
      return res.status(400).json({ message: "Stop impersonating before deleting an account." });
    }
    if (isOwner(req)) {
      return res.status(403).json({ message: "The platform owner account can't be deleted from here. Contact support." });
    }

    const userId = getRealUserId(req);
    try {
      const currentSettings = await storage.getSettings(userId);
      if (currentSettings?.stripeSubscriptionId) {
        try {
          validateStripeModeForBilling();
          const subscription = await getBillingStripeClient().subscriptions.retrieve(currentSettings.stripeSubscriptionId);
          if (subscription.metadata.userId !== userId || subscription.customer !== currentSettings.stripeCustomerId) {
            return res.status(403).json({ message: "This billing account is not connected to your account. Contact support before deleting." });
          }
          if (subscription.status !== "canceled") {
            const cancelled = await getBillingStripeClient().subscriptions.cancel(currentSettings.stripeSubscriptionId, { invoice_now: false, prorate: false });
            if (cancelled.status !== "canceled") throw new Error("Subscription cancellation is not confirmed");
          }
        } catch (err) {
          logError("Failed to cancel Stripe subscription during account deletion", err);
          return res.status(502).json({ message: "Subscription cancellation could not be confirmed. Your account and client data have been kept. Please retry deletion or contact support." });
        }
      }

      if (!dependencies.deleteAuthUser) {
        try { await deleteSupabaseAccounts(userId); }
        catch (error) {
          logError("Unable to delete authentication provider account", error);
          return res.status(502).json({ message: "Unable to remove your sign-in account. Your client data has been kept. Please retry or contact support." });
        }
      }
      await storage.deleteAccountData(userId);
      await deleteAuthUser(userId);
    } catch (err) {
      logError("Failed to delete account", err);
      return res.status(500).json({ message: "Unable to delete your account. Please try again or contact support." });
    }

    req.logout(() => {
      req.session.destroy(() => {
        res.status(200).json({ success: true, stripeCancelFailed: false });
      });
    });
  });

  return httpServer;
}

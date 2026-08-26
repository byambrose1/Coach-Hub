import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertSessionSchema, insertPackageSchema, insertSessionNoteSchema, insertClientFormSchema, insertReferralSchema, insertInvoiceSchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import { sendInvoiceEmail, sendBookingNotificationEmail, sendSessionCancellationEmail, sendSessionRescheduleEmail, sendParqEmail, sendLowSessionsEmail, sendBroadcastEmail } from "./email";
import { createMandateLink } from "./payments";

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

function getRealUserId(req: any): string {
  return req.user?.claims?.sub || "";
}

function getUserId(req: any): string {
  return (req.session as any)?.impersonatedUserId || getRealUserId(req);
}

function isOwner(req: any): boolean {
  const userId = getRealUserId(req);
  const ownerId = process.env.OWNER_USER_ID;
  return !!ownerId && userId === ownerId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

  app.get("/sitemap.xml", (req, res) => {
    const siteUrl = getPublicSiteUrl(req);
    const publicPaths = ["/", "/pricing", "/privacy", "/terms", "/support"];
    const urls = publicPaths.map((pathname) => `  <url><loc>${siteUrl}${pathname}</loc></url>`).join("\n");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
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

  // --- GoCardless & Payments ---
  app.post("/api/payments/create-mandate-link", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.body;
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.email) return res.status(400).json({ message: "Client has no email" });
      const link = await createMandateLink(clientId, client.name, client.email);
      res.json({ link });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/webhooks/gocardless", async (req, res) => {
    console.log("GoCardless webhook received:", req.body);
    res.status(204).send();
  });

  // --- PARQ Email ---
  app.post("/api/parq/send-email", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { clientId } = req.body;
      const client = await storage.getClient(clientId);
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
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Broadcast Email ---
  app.post("/api/emails/broadcast", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
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
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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
  app.get("/api/platform-admin/stats", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/platform-admin/users", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/platform-admin/config", isAuthenticated, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
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
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
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
    if (!isOwner(req)) return res.status(403).json({ message: "Forbidden" });
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
  app.get("/api/subscription/tiers", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.getPlatformConfig();
      res.json([
        { name: "free", label: "Free", max: config.tier1MaxClients ?? 5, price: config.tier1Price ?? "0", paymentLink: config.tier1PaymentLink ?? "" },
        { name: "starter", label: "Starter", max: config.tier2MaxClients ?? 10, price: config.tier2Price ?? "1.99", paymentLink: config.tier2PaymentLink ?? "" },
        { name: "professional", label: "Professional", max: config.tier3MaxClients ?? 20, price: config.tier3Price ?? "4.99", paymentLink: config.tier3PaymentLink ?? "" },
        { name: "business", label: "Business", max: config.tier4MaxClients ?? 50, price: config.tier4Price ?? "7.99", paymentLink: config.tier4PaymentLink ?? "" },
      ]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/settings/plan", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { plan } = req.body;
      if (!["free", "starter", "professional", "business"].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan" });
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
      res.status(500).json({ message: err.message });
    }
  });

  // --- Clients ---
  app.get("/api/clients", async (req, res) => {
    const userId = getUserId(req);
    const clientList = await storage.getClients(userId);
    res.json(clientList);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(req.params.id);
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
      console.error("Tier check error:", err);
    }

    const client = await storage.createClient(userId, parsed.data);
    res.status(201).json(client);
  });

  app.patch("/api/clients/:id", async (req, res) => {
    const client = await storage.updateClient(req.params.id, req.body);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.delete("/api/clients/:id", async (req, res) => {
    await storage.deleteClient(req.params.id);
    res.status(204).send();
  });

  app.get("/api/clients/:id/export", async (req, res) => {
    const userId = getUserId(req);
    const client = await storage.getClient(req.params.id);
    if (!client || client.userId !== userId) return res.status(404).json({ message: "Client not found" });
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
    const session = await storage.getSession(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  app.post("/api/sessions", async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const session = await storage.createSession(userId, parsed.data);

    // Deduct 1 session from the client's active block package when booked
    try {
      const pkgs = await storage.getPackages(userId);
      const activePackage = pkgs.find(
        (p) => p.clientId === session.clientId && p.status === "active" && p.billingType === "block" && (p.totalSessions - (p.usedSessions || 0)) > 0
      );
      if (activePackage) {
        await storage.updatePackage(activePackage.id, {
          usedSessions: (activePackage.usedSessions || 0) + 1,
        });
      }
    } catch (err) {
      console.error("Package deduction error:", err);
    }

    try {
      const client = await storage.getClient(session.clientId);
      const s = await storage.getSettings(userId);
      if (client?.email) {
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
      console.error("Notification error:", err);
    }

    res.status(201).json(session);
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    const existing = await storage.getSession(req.params.id);
    const session = await storage.updateSession(req.params.id, req.body);
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
        await storage.updatePackage(activePackage.id, {
          usedSessions: (activePackage.usedSessions || 0) - 1,
        });
      }
    }

    try {
      const client = await storage.getClient(session.clientId);
      const s = await storage.getSettings(session.userId || "");
      if (client?.email && existing) {
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
      console.error("Notification error:", err);
    }

    res.json(session);
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    await storage.deleteSession(req.params.id);
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
    const parsed = insertPackageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const pkg = await storage.createPackage(userId, parsed.data);
    res.status(201).json(pkg);
  });

  app.patch("/api/packages/:id", async (req, res) => {
    const pkg = await storage.updatePackage(req.params.id, req.body);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    if (req.body.billingType === "monthly" && !req.body.nextBillingDate && !pkg.nextBillingDate) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      await storage.updatePackage(req.params.id, {
        nextBillingDate: nextMonth.toISOString().split("T")[0],
      });
    }
    res.json(pkg);
  });

  app.post("/api/packages/:id/notify-low-sessions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const pkg = await storage.getPackage(getRouteParam(req.params.id));
      if (!pkg) return res.status(404).json({ message: "Package not found" });
      const client = await storage.getClient(pkg.clientId);
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
        paymentLink: settings?.paymentLink || undefined,
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to send low sessions notification:", err);
      res.status(500).json({ message: err.message || "Failed to send notification" });
    }
  });

  // --- Notes ---
  app.get("/api/notes", async (req, res) => {
    const userId = getUserId(req);
    const notes = await storage.getNotes(userId);
    res.json(notes);
  });

  app.get("/api/notes/:id", async (req, res) => {
    const note = await storage.getNote(req.params.id);
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
    const note = await storage.updateNote(req.params.id, req.body);
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json(note);
  });

  app.delete("/api/notes/:id", async (req, res) => {
    await storage.deleteNote(req.params.id);
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
    const s = await storage.upsertSettings(userId, req.body);
    res.json(s);
  });

  // --- Client Forms ---
  app.get("/api/forms", async (req, res) => {
    const userId = getUserId(req);
    const forms = await storage.getClientForms(userId);
    res.json(forms);
  });

  app.get("/api/forms/:id", async (req, res) => {
    const form = await storage.getClientForm(req.params.id);
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
    const form = await storage.updateClientForm(req.params.id, req.body);
    if (!form) return res.status(404).json({ message: "Form not found" });
    res.json(form);
  });

  app.delete("/api/forms/:id", async (req, res) => {
    await storage.deleteClientForm(req.params.id);
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
    const ref = await storage.updateReferral(req.params.id, req.body);
    if (!ref) return res.status(404).json({ message: "Referral not found" });
    res.json(ref);
  });

  // --- Invoices ---
  app.get("/api/invoices", async (req, res) => {
    const userId = getUserId(req);
    const invs = await storage.getInvoices(userId);
    res.json(invs);
  });

  app.post("/api/invoices", async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const inv = await storage.createInvoice(userId, parsed.data);
    res.status(201).json(inv);
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    const inv = await storage.updateInvoice(req.params.id, req.body);
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json(inv);
  });

  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      const inv = await storage.getInvoice(req.params.id);
      if (!inv) return res.status(404).json({ message: "Invoice not found" });
      const client = await storage.getClient(inv.clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.email) return res.status(400).json({ message: "Client has no email address" });
      const s = await storage.getSettings(inv.userId || "");
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
        paymentLink: s?.paymentLink || undefined,
      });

      const updated = await storage.updateInvoice(req.params.id, {
        status: "sent",
        sentDate: new Date().toISOString().split("T")[0],
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Error sending invoice email:", err);
      res.status(500).json({ message: err.message || "Failed to send invoice email" });
    }
  });

  return httpServer;
}

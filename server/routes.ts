import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertSessionSchema, insertPackageSchema, insertSessionNoteSchema, insertClientFormSchema, insertReferralSchema, insertInvoiceSchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import { sendInvoiceEmail, sendBookingNotificationEmail, sendSessionCancellationEmail, sendSessionRescheduleEmail, sendParqEmail } from "./email";
import { createMandateLink } from "./payments";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api/clients", isAuthenticated);
  app.use("/api/sessions", isAuthenticated);
  app.use("/api/packages", isAuthenticated);
  app.use("/api/notes", isAuthenticated);
  app.use("/api/settings", isAuthenticated);
  app.use("/api/forms", isAuthenticated);
  app.use("/api/referrals", isAuthenticated);
  app.use("/api/invoices", isAuthenticated);

  // --- GoCardless & Payments ---
  app.post("/api/payments/create-mandate-link", async (req, res) => {
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
      const { clientId } = req.body;
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.email) return res.status(400).json({ message: "Client has no email address" });
      const s = await storage.getSettings();
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

  // --- Admin ---
  app.get("/api/admin/stats", isAuthenticated, async (_req, res) => {
    try {
      const [clients, sessions, packages, invoices, notes, forms] = await Promise.all([
        storage.getClients(),
        storage.getSessions(),
        storage.getPackages(),
        storage.getInvoices(),
        storage.getNotes(),
        storage.getClientForms(),
      ]);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];

      const stats = {
        totalClients: clients.length,
        activeClients: clients.filter(c => c.status === "active").length,
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
      };
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Clients ---
  app.get("/api/clients", async (_req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const client = await storage.createClient(parsed.data);
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

  // --- Sessions ---
  app.get("/api/sessions", async (_req, res) => {
    const sessions = await storage.getSessions();
    res.json(sessions);
  });

  app.get("/api/sessions/:id", async (req, res) => {
    const session = await storage.getSession(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  app.post("/api/sessions", async (req, res) => {
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const session = await storage.createSession(parsed.data);
    
    // Trigger notification
    try {
      const client = await storage.getClient(session.clientId);
      const s = await storage.getSettings();
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

    if (req.body.status === "completed") {
      const pkgs = await storage.getPackages();
      const activePackage = pkgs.find(
        (p) => p.clientId === session.clientId && p.status === "active" && (p.totalSessions - (p.usedSessions || 0)) > 0
      );
      if (activePackage) {
        await storage.updatePackage(activePackage.id, {
          usedSessions: (activePackage.usedSessions || 0) + 1,
        });
      }
    }

    // Send email notifications for cancellations and reschedules
    try {
      const client = await storage.getClient(session.clientId);
      const s = await storage.getSettings();
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
  app.get("/api/packages", async (_req, res) => {
    const packages = await storage.getPackages();
    res.json(packages);
  });

  app.post("/api/packages", async (req, res) => {
    const parsed = insertPackageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const pkg = await storage.createPackage(parsed.data);
    res.status(201).json(pkg);
  });

  app.patch("/api/packages/:id", async (req, res) => {
    const pkg = await storage.updatePackage(req.params.id, req.body);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    
    // If billing type changed to monthly, ensure we have a next billing date if not provided
    if (req.body.billingType === "monthly" && !req.body.nextBillingDate && !pkg.nextBillingDate) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      await storage.updatePackage(req.params.id, { 
        nextBillingDate: nextMonth.toISOString().split("T")[0] 
      });
    }
    
    res.json(pkg);
  });

  // --- Notes ---
  app.get("/api/notes", async (_req, res) => {
    const notes = await storage.getNotes();
    res.json(notes);
  });

  app.get("/api/notes/:id", async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json(note);
  });

  app.post("/api/notes", async (req, res) => {
    const parsed = insertSessionNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const note = await storage.createNote(parsed.data);
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
  app.get("/api/settings", async (_req, res) => {
    let s = await storage.getSettings();
    if (!s) {
      s = await storage.upsertSettings({
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
    const s = await storage.upsertSettings(req.body);
    res.json(s);
  });

  // --- Client Forms ---
  app.get("/api/forms", async (_req, res) => {
    const forms = await storage.getClientForms();
    res.json(forms);
  });

  app.get("/api/forms/:id", async (req, res) => {
    const form = await storage.getClientForm(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });
    res.json(form);
  });

  app.post("/api/forms", async (req, res) => {
    const parsed = insertClientFormSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const form = await storage.createClientForm(parsed.data);
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
  app.get("/api/referrals", async (_req, res) => {
    const refs = await storage.getReferrals();
    res.json(refs);
  });

  app.post("/api/referrals", async (req, res) => {
    const parsed = insertReferralSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const ref = await storage.createReferral(parsed.data);
    res.status(201).json(ref);
  });

  app.patch("/api/referrals/:id", async (req, res) => {
    const ref = await storage.updateReferral(req.params.id, req.body);
    if (!ref) return res.status(404).json({ message: "Referral not found" });
    res.json(ref);
  });

  // --- Invoices ---
  app.get("/api/invoices", async (_req, res) => {
    const invs = await storage.getInvoices();
    res.json(invs);
  });

  app.post("/api/invoices", async (req, res) => {
    const parsed = insertInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const inv = await storage.createInvoice(parsed.data);
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

      const s = await storage.getSettings();
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

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertSessionSchema, insertPackageSchema, insertSessionNoteSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
    res.status(201).json(session);
  });

  app.patch("/api/sessions/:id", async (req, res) => {
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
    res.json(pkg);
  });

  // --- Notes ---
  app.get("/api/notes", async (_req, res) => {
    const notes = await storage.getNotes();
    res.json(notes);
  });

  app.post("/api/notes", async (req, res) => {
    const parsed = insertSessionNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const note = await storage.createNote(parsed.data);
    res.status(201).json(note);
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

  return httpServer;
}

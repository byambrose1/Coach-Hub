import { createHash, randomBytes } from "node:crypto";
import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { templateInputSchema, answersInputSchema } from "@shared/custom-forms";
import { customFormStorage, InvalidFormAnswers, type CustomFormStorage, type RequestRow, type TemplateRow } from "./custom-form-storage";
import type { IStorage } from "./storage";
import { logError } from "./safe-logging";
import { registerFormDocumentRoutes } from "./form-document-routes";
import { FormDocumentError } from "./form-document-validation";
import type { FormDocumentStorage } from "./form-document-storage";

export const hashFormToken = (token: string) => createHash("sha256").update(token).digest("hex");
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const requestSchema = z.object({ templateId: z.string().min(1).max(100), clientId: z.string().min(1).max(100) }).strict();
const publicInputSchema = z.object({ token: tokenSchema }).strict();
const submitSchema = z.object({ token: tokenSchema, answers: answersInputSchema }).strict();
const completionSchema = z.object({ answers: answersInputSchema }).strict();
export const safeTemplate = ({ userId: _owner, ...template }: TemplateRow) => template;
export const safeRequest = ({ userId: _owner, tokenHash: _token, ...request }: RequestRow) => request;

export function registerCustomFormRoutes(app: Express, deps: {
  storage: Pick<IStorage, "getClient">; isAuthenticated: RequestHandler;
  getUserId: (request: any) => string; forms?: CustomFormStorage; documents?: FormDocumentStorage;
}) {
  const forms = deps.forms || customFormStorage;
  const { isAuthenticated, getUserId } = deps;
  const unavailable = (res: any) => res.status(404).json({ message: "This form link is unavailable or has already been completed." });
  const protect: RequestHandler = (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  };
  const handle = (operation: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await operation(req, res, next); }
    catch (error) {
      if (error instanceof InvalidFormAnswers) { res.status(400).json({ message: error.message }); return; }
      if (error instanceof FormDocumentError) { res.status(error.status).json({ message: error.message }); return; }
      logError("Custom form request failed", error);
      res.status(500).json({ message: "Unable to save or load this form. Please try again." });
    }
  };
  app.use("/api/form-templates", protect, isAuthenticated);
  app.use("/f", protect);
  app.use("/api/form-requests", protect, isAuthenticated);
  const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false });
  app.use("/api/public-forms", protect, publicLimiter);
  registerFormDocumentRoutes(app, { forms, documents: deps.documents, isAuthenticated, getUserId, protect });

  app.get("/api/form-templates", handle(async (req, res) => { res.json((await forms.templates(getUserId(req))).map(safeTemplate)); }));
  app.post("/api/form-templates", handle(async (req, res) => {
    const parsed = templateInputSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Check your title, questions and choice options." }); return; }
    res.status(201).json(safeTemplate(await forms.createTemplate(getUserId(req), parsed.data)));
  }));
  app.patch("/api/form-templates/:id", handle(async (req, res) => {
    const parsed = templateInputSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Check your title, questions and choice options." }); return; }
    const template = await forms.updateTemplate(getUserId(req), String(req.params.id), parsed.data);
    if (!template) { res.status(404).json({ message: "Form template not found." }); return; }
    res.json(safeTemplate(template));
  }));
  app.delete("/api/form-templates/:id", handle(async (req, res) => {
    if (!await forms.deleteTemplate(getUserId(req), String(req.params.id))) { res.status(404).json({ message: "Form template not found." }); return; }
    res.sendStatus(204);
  }));
  app.get("/api/form-requests", handle(async (req, res) => {
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
    const userId = getUserId(req);
    if (!clientId || !await deps.storage.getClient(userId, clientId)) { res.status(404).json({ message: "Client not found." }); return; }
    res.json((await forms.requests(userId, clientId)).map(safeRequest));
  }));
  app.post("/api/form-requests", handle(async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Choose a client and form template." }); return; }
    const userId = getUserId(req);
    const template = await forms.template(userId, parsed.data.templateId);
    if (!template || !await deps.storage.getClient(userId, parsed.data.clientId)) { res.status(404).json({ message: "Client or form template not found." }); return; }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const request = await forms.createRequest(userId, template, parsed.data.clientId, hashFormToken(token), expiresAt);
    res.status(201).json({ request: safeRequest(request), token });
  }));
  app.post("/api/form-requests/:id/revoke", handle(async (req, res) => {
    const request = await forms.revoke(getUserId(req), String(req.params.id));
    if (!request) { res.status(404).json({ message: "Pending form request not found." }); return; }
    res.json(safeRequest(request));
  }));
  app.post("/api/form-requests/:id/complete", handle(async (req, res) => {
    const parsed = completionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Check your answers." }); return; }
    const completed = await forms.complete({ userId: getUserId(req), id: String(req.params.id) }, parsed.data.answers);
    if (!completed) { res.status(404).json({ message: "Pending form request not found." }); return; }
    res.json({ request: safeRequest(completed.request), form: completed.form });
  }));
  app.post("/api/public-forms/load", handle(async (req, res) => {
    const parsed = publicInputSchema.safeParse(req.body);
    if (!parsed.success) { unavailable(res); return; }
    const request = await forms.publicRequest(hashFormToken(parsed.data.token));
    if (!request) { unavailable(res); return; }
    res.json({ title: request.title, description: request.description, questions: request.questions, expiresAt: request.expiresAt });
  }));
  app.post("/api/public-forms/submit", handle(async (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Check your form link and answers." }); return; }
    const completed = await forms.complete({ tokenHash: hashFormToken(parsed.data.token) }, parsed.data.answers);
    if (!completed) { unavailable(res); return; }
    res.json({ message: "Form submitted." });
  }));
}
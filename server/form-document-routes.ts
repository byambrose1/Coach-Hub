import express, { type Express, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { createHash } from "node:crypto";
import { z } from "zod";
import { MAX_DOCUMENT_BYTES } from "@shared/form-documents";
import type { CustomFormStorage } from "./custom-form-storage";
import { formDocumentStorage, type FormDocumentStorage, type DocumentSelector } from "./form-document-storage";
import { FormDocumentError, validateDocument } from "./form-document-validation";
import { logError } from "./safe-logging";

export function registerFormDocumentRoutes(app: Express, deps: {
  forms: CustomFormStorage; documents?: FormDocumentStorage; isAuthenticated: RequestHandler;
  getUserId: (request: any) => string; protect: RequestHandler;
  // Uploaded documents are validated (type, size, signature) but not
  // malware-scanned, which isn't safe to expose to the public internet yet.
  // Defaults to enabled so existing callers/tests are unaffected; the real
  // production wiring in routes.ts passes false until scanning exists.
  documentUploadsEnabled?: boolean;
}) {
  const documents = deps.documents || formDocumentStorage;
  if (deps.documentUploadsEnabled === false) {
    const disabled: RequestHandler = (_req, res) => {
      res.status(503).json({ message: "Document uploads are temporarily unavailable. Please try again later." });
    };
    app.post("/api/public-forms/documents", disabled);
    app.delete("/api/public-forms/documents/:documentId", disabled);
    app.post("/api/form-requests/:id/documents", disabled);
    app.delete("/api/form-requests/:id/documents/:documentId", disabled);
    app.get("/api/form-documents/:documentId/download", disabled);
    return;
  }
  const handle = (operation: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await operation(req, res, next); }
    catch (error) {
      if (error instanceof FormDocumentError) { res.status(error.status).json({ message: error.message }); return; }
      logError("Private form document request failed", error);
      res.status(500).json({ message: "Unable to save or load this document. Please try again." });
    }
  };
  const noImpersonation: RequestHandler = (req, res, next) => {
    if ((req as any).session?.impersonatedUserId) {
      res.status(403).json({ message: "Stop impersonating before accessing client documents." }); return;
    }
    next();
  };
  const publicSelector = (req: express.Request): DocumentSelector => {
    const token = req.get("x-form-token");
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new FormDocumentError(404, "This form link is unavailable or has already been completed.");
    return { tokenHash: createHash("sha256").update(token).digest("hex") };
  };
  const coachSelector = (req: express.Request): DocumentSelector => ({ userId: deps.getUserId(req), id: String(req.params.id) });
  const resolvePending = (isPublic: boolean): RequestHandler => handle(async (req, res, next) => {
    const selector = isPublic ? publicSelector(req) : coachSelector(req);
    const request = "tokenHash" in selector ? await deps.forms.publicRequest(selector.tokenHash) : await deps.forms.request(selector.userId, selector.id);
    if (!request || request.status !== "pending" || Date.parse(request.expiresAt) <= Date.now()) {
      throw new FormDocumentError(404, "This form link is unavailable or has already been completed.");
    }
    if (req.method === "POST") {
      if (!req.is("application/octet-stream")) throw new FormDocumentError(415, "Upload the document as a file, not as a JSON or form-data request.");
      if (!request.questions.some(q => q.id === req.get("x-question-id") && q.type === "file")) {
        throw new FormDocumentError(400, "Choose a document-upload question on this form.");
      }
    }
    res.locals.documentSelector = selector;
    next();
  });
  const raw = express.raw({ type: "application/octet-stream", limit: MAX_DOCUMENT_BYTES });
  const readBody: RequestHandler = (req, res, next) => raw(req, res, error => {
    if (error) { res.status((error as { status?: number }).status === 413 ? 413 : 400).json({ message: "Documents must be non-empty and 5 MB or smaller." }); return; }
    next();
  });
  const upload = handle(async (req, res) => {
    let fileName: string;
    try { fileName = decodeURIComponent(req.get("x-file-name") || ""); }
    catch { throw new FormDocumentError(400, "Use a valid document file name."); }
    const file = validateDocument(fileName, req.body);
    res.status(201).json(await documents.save(res.locals.documentSelector, req.get("x-question-id")!, file));
  });
  const remove = handle(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.documentId).success ||
      !await documents.remove(res.locals.documentSelector, String(req.params.documentId))) {
      res.status(404).json({ message: "Document not found." }); return;
    }
    res.sendStatus(204);
  });
  const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7",
    legacyHeaders: false, message: { message: "Too many document uploads. Please wait before trying again." } });
  app.post("/api/public-forms/documents", resolvePending(true), uploadLimiter, readBody, upload);
  app.delete("/api/public-forms/documents/:documentId", resolvePending(true), remove);
  app.post("/api/form-requests/:id/documents", noImpersonation, resolvePending(false), uploadLimiter, readBody, upload);
  app.delete("/api/form-requests/:id/documents/:documentId", noImpersonation, resolvePending(false), remove);
  app.use("/api/form-documents", deps.protect, deps.isAuthenticated, noImpersonation);
  app.get("/api/form-documents/:documentId/download", handle(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.documentId).success) { res.status(404).json({ message: "Document not found." }); return; }
    const document = await documents.download(deps.getUserId(req), String(req.params.documentId));
    if (!document) { res.status(404).json({ message: "Document not found." }); return; }
    const encoded = encodeURIComponent(document.fileName).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="document${document.fileName.match(/\.[a-z0-9]+$/i)?.[0] || ""}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Length": String(document.byteSize), "Cache-Control": "private, no-store",
    });
    res.send(document.content);
  }));
}

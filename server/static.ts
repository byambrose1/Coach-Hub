import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { renderPublicDocument } from "./public-pages";
import { storage } from "./storage";
import { logError } from "./safe-logging";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf8");
      const page = await renderPublicDocument(template, req.originalUrl, storage);
      res.setHeader("Cache-Control", "no-cache");
      res.status(page.status).type("html").send(page.html);
    } catch (error) {
      logError("Public page rendering failed", error);
      res.status(503).setHeader("Retry-After", "60");
      res.type("html").send("<!doctype html><html><head><title>Temporarily unavailable | Practably</title><meta name=\"robots\" content=\"noindex\"></head><body><h1>Temporarily unavailable</h1><p>Please try again shortly.</p></body></html>");
    }
  });
}

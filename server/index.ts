import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { ensureCustomFormsSchema } from "./custom-form-schema";
import { serveStatic } from "./static";
import { createServer } from "http";
import { createApiRequestLogger, logError } from "./safe-logging";
import { securityHeaders } from "./security-headers";

const app = express();
app.disable("x-powered-by");
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(securityHeaders());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use(createApiRequestLogger(log));

// Blanket abuse guard on every API and auth route: generous enough for normal
// use, low enough to blunt scripted brute-forcing/scraping during beta
// testing. Individual endpoints (e.g. broadcast email) add tighter limits
// of their own on top of this.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again shortly." },
  }),
);

(async () => {
  const { setupAuth, registerAuthRoutes } = await import("./replit_integrations/auth");
  try {
    await setupAuth(app);
  } catch (error) {
    // setupAuth already handles the expected "sign-in provider unreachable"
    // case internally and returns instead of throwing. This catch is a last
    // line of defense against anything else unexpected during auth startup -
    // the rest of the app (routes, static assets) should still come up.
    logError("Unexpected error during auth setup", error);
  }
  registerAuthRoutes(app);

  const { seedDatabase, seedBlogPosts } = await import("./seed");
  await seedDatabase();
  await seedBlogPosts();
  await ensureCustomFormsSchema();
  await registerRoutes(httpServer, app);
  app.use("/api", (_req, res) => res.status(404).json({ message: "Endpoint not found." }));

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logError("Internal Server Error", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

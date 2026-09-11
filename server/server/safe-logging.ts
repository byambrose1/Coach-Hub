import type { RequestHandler } from "express";

type ErrorSummary = {
  name: string;
  code?: string | number;
  status?: number;
};

function getSafeErrorSummary(error: unknown): ErrorSummary {
  if (!(error instanceof Error)) {
    return { name: "UnknownError" };
  }

  const candidate = error as Error & {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  const summary: ErrorSummary = { name: error.name || "Error" };

  if (typeof candidate.code === "string" || typeof candidate.code === "number") {
    summary.code = candidate.code;
  }

  const status = candidate.status ?? candidate.statusCode;
  if (typeof status === "number") {
    summary.status = status;
  }

  return summary;
}

export function logError(context: string, error: unknown): void {
  console.error(`${context}:`, getSafeErrorSummary(error));
}

export function createApiRequestLogger(
  writeLog: (message: string) => void,
): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      if (path.startsWith("/api")) {
        const duration = Date.now() - start;
        writeLog(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    });

    next();
  };
}
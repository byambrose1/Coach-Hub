import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { logError } from "../../safe-logging";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Public session status prevents expected signed-out visits from surfacing as
  // browser-console 401 errors on the marketing pages. The protected user route
  // below remains unchanged for authenticated product calls.
  app.get("/api/auth/status", async (req: any, res) => {
    const user = req.user as any;
    if (!req.isAuthenticated?.() || !user?.expires_at) {
      return res.json(null);
    }

    try {
      const account = await authStorage.getUser(user.claims.sub);
      return res.json(account);
    } catch (error) {
      logError("Error fetching auth status", error);
      return res.status(500).json({ message: "Failed to fetch auth status" });
    }
  });

  // Get current authenticated user (includes impersonation status)
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      let impersonatedUserId = (req.session as any)?.impersonatedUserId;
      let impersonatedUserName = (req.session as any)?.impersonatedUserName;
      // Auto-clear self-impersonation
      if (impersonatedUserId === userId) {
        delete (req.session as any).impersonatedUserId;
        delete (req.session as any).impersonatedUserName;
        impersonatedUserId = undefined;
        impersonatedUserName = undefined;
      }
      res.json({
        ...user,
        isImpersonating: !!impersonatedUserId,
        impersonatedUserId: impersonatedUserId || null,
        impersonatedUserName: impersonatedUserName || null,
      });
    } catch (error) {
      logError("Error fetching user", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

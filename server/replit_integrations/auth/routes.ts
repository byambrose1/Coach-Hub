import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
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
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

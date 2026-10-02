export { setupAuthentication as setupAuth } from "../../auth/supabase";
export { isAuthenticated, getSession } from "./replitAuth";
export { authStorage, type IAuthStorage } from "./storage";
export { registerAuthRoutes } from "./routes";

import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import type { Request } from "express";
import WebSocket from "ws";

// ws is SDK-compatible at runtime; its overloaded Node typings differ from
// the SDK's minimal constructor interface. Node 20 has no native WebSocket.
const transport = WebSocket as unknown as NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"];

export function supabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

export function supabaseOrigin() {
  const url = new URL(process.env.SUPABASE_URL || "");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid authentication configuration");
  }
  return url.origin;
}

export function identityKey(subject: string) {
  return `supabase:${new URL(supabaseOrigin()).hostname}:${subject}`;
}

// Each request gets its own SDK client. Never share user sessions between coaches.
export function supabaseClient(req?: Request) {
  const storage = {
    getItem(key: string) { return (req?.session as any)?.supabasePkce?.[key] ?? null; },
    setItem(key: string, value: string) {
      if (req?.session) {
        const session = req.session as any;
        session.supabasePkce ||= {};
        session.supabasePkce[key] = value;
      }
    },
    removeItem(key: string) {
      if (req?.session) delete (req.session as any).supabasePkce?.[key];
    },
  };
  return createClient(supabaseOrigin(), process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { flowType: "pkce", autoRefreshToken: false, persistSession: !!req, detectSessionInUrl: false, storage },
    realtime: { transport },
  });
}

export function supabaseAdmin() {
  if (!process.env.SUPABASE_SECRET_KEY) throw new Error("Account deletion is not configured");
  return createClient(supabaseOrigin(), process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport },
  });
}

export async function getAuthProviders(fetcher = fetch) {
  const response = await fetcher(`${supabaseOrigin()}/auth/v1/settings`, {
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY! },
  });
  if (!response.ok) throw new Error("Authentication availability cannot be checked");
  const settings = await response.json();
  if (!settings.external || typeof settings.external !== "object") throw new Error("Invalid authentication settings");
  return { github: settings.external.github === true, email: settings.external.email === true };
}
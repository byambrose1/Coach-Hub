import { eq, sql } from "drizzle-orm";
import { users, authIdentities } from "@shared/models/auth";
import { db } from "../db";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { identityKey, supabaseAdmin, supabaseConfigured } from "./supabase-client";

// Additive and idempotent: no existing users, client records or billing IDs change.
export async function ensureIdentityTable() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS auth_identities (
    identity varchar PRIMARY KEY,
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now()
  )`);
}

export class AccountLinkError extends Error {
  constructor(public code: "link_required" | "already_linked" | "account_required") { super(code); }
}

export async function resolveCoach(
  providerUser: SupabaseUser,
  verifiedLegacyId?: string,
  { allowCreate = false }: { allowCreate?: boolean } = {},
) {
  const identity = identityKey(providerUser.id);
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))`);
    const [mapping] = await tx.select().from(authIdentities).where(eq(authIdentities.identity, identity));
    if (mapping) {
      if (verifiedLegacyId && mapping.userId !== verifiedLegacyId) throw new AccountLinkError("already_linked");
      const [coach] = await tx.select().from(users).where(eq(users.id, mapping.userId));
      if (!coach) throw new Error("Account mapping is unavailable");
      return coach;
    }
    let coach;
    if (verifiedLegacyId) {
      [coach] = await tx.select().from(users).where(eq(users.id, verifiedLegacyId));
      if (!coach) throw new Error("Original account is unavailable");
    } else {
      if (providerUser.email) {
        const [existing] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = lower(${providerUser.email})`);
        // Email alone is not proof of ownership of a legacy account.
        if (existing) throw new AccountLinkError("link_required");
      }
      if (!allowCreate) throw new AccountLinkError("account_required");
      const metadata = providerUser.user_metadata || {};
      [coach] = await tx.insert(users).values({
        id: identity, email: providerUser.email || null,
        firstName: typeof metadata.full_name === "string" ? metadata.full_name.slice(0, 120) : null,
        profileImageUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
      }).returning();
    }
    await tx.insert(authIdentities).values({ identity, userId: coach.id });
    return coach;
  });
}

export async function mappedCoach(subject: string) {
  const [mapping] = await db.select().from(authIdentities).where(eq(authIdentities.identity, identityKey(subject)));
  return mapping?.userId;
}

export async function deleteSupabaseAccounts(userId: string) {
  if (!supabaseConfigured()) return;
  const identities = await db.select().from(authIdentities).where(eq(authIdentities.userId, userId));
  const prefix = identityKey("");
  if (!identities.some(mapping => mapping.identity.startsWith(prefix))) return;
  const admin = supabaseAdmin();
  for (const mapping of identities) {
    if (!mapping.identity.startsWith(prefix)) continue;
    const subject = mapping.identity.slice(prefix.length);
    const { error } = await admin.auth.admin.deleteUser(subject);
    // A retried deletion may find the provider account already gone.
    if (error && error.status !== 404) throw new Error("Authentication account deletion failed");
  }
}
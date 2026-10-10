import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  clients, trainingSessions, packages, sessionNotes, settings, clientForms, referrals, invoices, users, platformConfig,
  waitlistSignups, blogPosts, formRequests, formTemplates,
  insertClientSchema, insertSessionSchema, insertPackageSchema, insertSessionNoteSchema,
  insertClientFormSchema, insertReferralSchema, insertInvoiceSchema,
  type Client, type InsertClient,
  type Session, type InsertSession,
  type Package, type InsertPackage,
  type SessionNote, type InsertSessionNote,
  type Settings, type InsertSettings,
  type ClientForm, type InsertClientForm,
  type Referral, type InsertReferral,
  type Invoice, type InsertInvoice,
  type User, type PlatformConfig,
  type WaitlistSignup, type InsertWaitlistSignup,
  type BlogPost, type InsertBlogPost,
} from "@shared/schema";

// Settings fields that are safe and meaningful to carry between accounts -
// never billing/auth/internal state (subscriptionPlan, stripe ids, terms
// acceptance, onboarding progress, etc).
export const PORTABLE_SETTINGS_FIELDS = [
  "trainerName", "cancellationPolicy", "businessName", "lowSessionThreshold",
  "trainerEmail", "trainerPhone", "businessAddress",
  "acceptsCash", "acceptsCardMachine", "acceptsBankTransfer", "bankTransferDetails",
  "acceptsPaypal", "paypalLink", "acceptsStripeLink", "stripePaymentLink",
  "acceptsOtherPayment", "otherPaymentDetails", "invoicePrefix",
  "enableEmailNotifications", "enableSessionReminders", "reminderHoursBefore",
  "currency", "cancellationNoticeHours", "timezone",
] as const satisfies readonly (keyof Settings)[];
type PortableSettings = Pick<Settings, typeof PORTABLE_SETTINGS_FIELDS[number]>;

function pickPortableSettings(source: Record<string, unknown>): Partial<PortableSettings> {
  const out: Record<string, unknown> = {};
  for (const key of PORTABLE_SETTINGS_FIELDS) if (key in source) out[key] = (source as any)[key];
  return out as Partial<PortableSettings>;
}

export type AccountExport = {
  formatVersion: 1;
  exportedAt: string;
  settings: Partial<PortableSettings> | null;
  clients: Client[];
  packages: Package[];
  sessions: Session[];
  invoices: Invoice[];
  sessionNotes: SessionNote[];
  clientForms: ClientForm[];
  referrals: Referral[];
  formTemplates: { title: string; description: string; questions: unknown }[];
};

const importId = z.string().min(1).max(200);
const importClientSchema = insertClientSchema.omit({ userId: true }).extend({ id: importId });
const importPackageSchema = insertPackageSchema.omit({ userId: true }).extend({ id: importId });
const importSessionSchema = insertSessionSchema.omit({ userId: true }).extend({ id: importId });
const importInvoiceSchema = insertInvoiceSchema.omit({ userId: true }).extend({ id: importId });
const importSessionNoteSchema = insertSessionNoteSchema.omit({ userId: true }).extend({ id: importId });
const importClientFormSchema = insertClientFormSchema.omit({ userId: true }).extend({ id: importId });
const importReferralSchema = insertReferralSchema.omit({ userId: true }).extend({ id: importId });

export const accountImportSchema = z.object({
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  clients: z.array(importClientSchema).max(500).default([]),
  packages: z.array(importPackageSchema).max(2000).default([]),
  sessions: z.array(importSessionSchema).max(5000).default([]),
  invoices: z.array(importInvoiceSchema).max(5000).default([]),
  sessionNotes: z.array(importSessionNoteSchema).max(5000).default([]),
  clientForms: z.array(importClientFormSchema).max(5000).default([]),
  referrals: z.array(importReferralSchema).max(2000).default([]),
});
export type AccountImportPayload = z.infer<typeof accountImportSchema>;

export type AccountImportSummary = {
  clients: number; packages: number; sessions: number; invoices: number;
  sessionNotes: number; clientForms: number; referrals: number;
};

export interface IStorage {
  // User-scoped operations (all require userId)
  getClients(userId: string): Promise<Client[]>;
  getClient(userId: string, id: string): Promise<Client | undefined>;
  createClient(userId: string, data: InsertClient): Promise<Client>;
  updateClient(userId: string, id: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(userId: string, id: string): Promise<void>;

  getSessions(userId: string): Promise<Session[]>;
  getSession(userId: string, id: string): Promise<Session | undefined>;
  createSession(userId: string, data: InsertSession): Promise<Session>;
  updateSession(userId: string, id: string, data: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(userId: string, id: string): Promise<void>;

  getPackages(userId: string): Promise<Package[]>;
  getPackage(userId: string, id: string): Promise<Package | undefined>;
  createPackage(userId: string, data: InsertPackage): Promise<Package>;
  updatePackage(userId: string, id: string, data: Partial<InsertPackage>): Promise<Package | undefined>;

  getNotes(userId: string): Promise<SessionNote[]>;
  getNote(userId: string, id: string): Promise<SessionNote | undefined>;
  createNote(userId: string, data: InsertSessionNote): Promise<SessionNote>;
  updateNote(userId: string, id: string, data: Partial<InsertSessionNote>): Promise<SessionNote | undefined>;
  deleteNote(userId: string, id: string): Promise<void>;

  getSettings(userId: string): Promise<Settings | undefined>;
  getSettingsByStripeSubscriptionId(subscriptionId: string): Promise<Settings | undefined>;
  upsertSettings(userId: string, data: InsertSettings): Promise<Settings>;

  getClientForms(userId: string): Promise<ClientForm[]>;
  getClientForm(userId: string, id: string): Promise<ClientForm | undefined>;
  createClientForm(userId: string, data: InsertClientForm): Promise<ClientForm>;
  updateClientForm(userId: string, id: string, data: Partial<InsertClientForm>): Promise<ClientForm | undefined>;
  deleteClientForm(userId: string, id: string): Promise<void>;

  getReferrals(userId: string): Promise<Referral[]>;
  createReferral(userId: string, data: InsertReferral): Promise<Referral>;
  updateReferral(userId: string, id: string, data: Partial<InsertReferral>): Promise<Referral | undefined>;

  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(userId: string, id: string): Promise<Invoice | undefined>;
  createInvoice(userId: string, data: InsertInvoice): Promise<Invoice>;
  updateInvoice(userId: string, id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;

  // Permanently removes every row this coach owns (clients and everything
  // under them, settings). Does not touch the auth user record - that's a
  // separate concern owned by IAuthStorage.
  deleteAccountData(userId: string): Promise<void>;

  // A full, portable snapshot of this coach's own data - clients and
  // everything under them, plus the business-profile parts of settings.
  // Never includes billing/auth/internal state.
  exportAccountData(userId: string): Promise<AccountExport>;
  // Re-creates records from a previous export under this coach's own
  // account, with fresh ids - never trusts incoming ids or userId. Foreign
  // keys (clientId, packageId, sessionId, referral client ids) are remapped
  // to the newly created rows; a reference to something outside this import
  // is skipped rather than guessed at.
  importAccountData(userId: string, payload: AccountImportPayload): Promise<AccountImportSummary>;

  // Platform admin (owner only)
  getAllUsers(): Promise<User[]>;
  getPlatformStats(): Promise<PlatformStats>;
  getPlatformConfig(): Promise<PlatformConfig>;
  upsertPlatformConfig(data: Partial<PlatformConfig>): Promise<PlatformConfig>;
  getCoachDetail(coachId: string): Promise<CoachDetail | undefined>;
  updateCoachPlan(coachId: string, plan: string, expiresAt?: Date | null): Promise<void>;
  clearBillingReference(coachId: string): Promise<void>;

  // Waitlist signups
  createWaitlistSignup(data: InsertWaitlistSignup): Promise<WaitlistSignup>;
  getWaitlistSignupByEmail(email: string): Promise<WaitlistSignup | undefined>;
  getWaitlistSignups(): Promise<WaitlistSignup[]>;

  // Blog (owner-authored posts for SEO/content marketing)
  getPublishedBlogPosts(): Promise<BlogPost[]>;
  getPublishedBlogPost(slug: string): Promise<BlogPost | undefined>;
  getAllBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: string): Promise<BlogPost | undefined>;
  createBlogPost(data: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: string): Promise<void>;
}

export interface CoachDetail {
  coach: User;
  clients: Client[];
  stats: {
    totalClients: number;
    totalSessions: number;
    totalRevenue: number;
  };
  plan: string;
  planGrantedManually: boolean;
  manualPlanExpiresAt: string | null;
  stripeCustomerId: string | null;
}

export interface PlatformStats {
  totalUsers: number;
  totalClients: number;
  totalSessions: number;
  totalInvoices: number;
  totalRevenue: number;
  newUsersThisMonth: number;
  activeUsersThisMonth: number;
}

function withoutOwnershipFields<T>(data: T): T {
  const { id: _id, userId: _userId, ...safeData } = data as any;
  return safeData as T;
}

export class DatabaseStorage implements IStorage {
  async getClients(userId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.userId, userId));
  }

  async getClient(userId: string, id: string): Promise<Client | undefined> {
    const rows = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
    return rows[0];
  }

  async createClient(userId: string, data: InsertClient): Promise<Client> {
    const rows = await db.insert(clients).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateClient(userId: string, id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const rows = await db.update(clients).set(withoutOwnershipFields(data)).where(and(eq(clients.id, id), eq(clients.userId, userId))).returning();
    return rows[0];
  }

  async deleteClient(userId: string, id: string): Promise<void> {
    const client = await this.getClient(userId, id);
    if (!client) return;
    await db.delete(invoices).where(eq(invoices.clientId, id));
    await db.delete(sessionNotes).where(eq(sessionNotes.clientId, id));
    await db.delete(clientForms).where(eq(clientForms.clientId, id));
    await db.delete(packages).where(eq(packages.clientId, id));
    await db.delete(trainingSessions).where(eq(trainingSessions.clientId, id));
    await db.delete(referrals).where(eq(referrals.referrerClientId, id));
    await db.delete(referrals).where(eq(referrals.referredClientId, id));
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getSessions(userId: string): Promise<Session[]> {
    return db.select().from(trainingSessions).where(eq(trainingSessions.userId, userId));
  }

  async getSession(userId: string, id: string): Promise<Session | undefined> {
    const rows = await db.select().from(trainingSessions).where(and(eq(trainingSessions.id, id), eq(trainingSessions.userId, userId)));
    return rows[0];
  }

  async createSession(userId: string, data: InsertSession): Promise<Session> {
    const rows = await db.insert(trainingSessions).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateSession(userId: string, id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    const rows = await db.update(trainingSessions).set(withoutOwnershipFields(data)).where(and(eq(trainingSessions.id, id), eq(trainingSessions.userId, userId))).returning();
    return rows[0];
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    await db.delete(trainingSessions).where(and(eq(trainingSessions.id, id), eq(trainingSessions.userId, userId)));
  }

  async getPackages(userId: string): Promise<Package[]> {
    return db.select().from(packages).where(eq(packages.userId, userId));
  }

  async getPackage(userId: string, id: string): Promise<Package | undefined> {
    const rows = await db.select().from(packages).where(and(eq(packages.id, id), eq(packages.userId, userId)));
    return rows[0];
  }

  async createPackage(userId: string, data: InsertPackage): Promise<Package> {
    const rows = await db.insert(packages).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updatePackage(userId: string, id: string, data: Partial<InsertPackage>): Promise<Package | undefined> {
    const rows = await db.update(packages).set(withoutOwnershipFields(data)).where(and(eq(packages.id, id), eq(packages.userId, userId))).returning();
    return rows[0];
  }

  async getNotes(userId: string): Promise<SessionNote[]> {
    return db.select().from(sessionNotes).where(eq(sessionNotes.userId, userId));
  }

  async getNote(userId: string, id: string): Promise<SessionNote | undefined> {
    const rows = await db.select().from(sessionNotes).where(and(eq(sessionNotes.id, id), eq(sessionNotes.userId, userId)));
    return rows[0];
  }

  async createNote(userId: string, data: InsertSessionNote): Promise<SessionNote> {
    const rows = await db.insert(sessionNotes).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateNote(userId: string, id: string, data: Partial<InsertSessionNote>): Promise<SessionNote | undefined> {
    const rows = await db.update(sessionNotes).set(withoutOwnershipFields(data)).where(and(eq(sessionNotes.id, id), eq(sessionNotes.userId, userId))).returning();
    return rows[0];
  }

  async deleteNote(userId: string, id: string): Promise<void> {
    await db.delete(sessionNotes).where(and(eq(sessionNotes.id, id), eq(sessionNotes.userId, userId)));
  }

  async getSettings(userId: string): Promise<Settings | undefined> {
    const rows = await db.select().from(settings).where(eq(settings.id, userId));
    const row = rows[0];
    // A manually-granted plan with a past expiry reverts to Free the next
    // time anything reads this coach's settings - no cron job needed, and
    // every caller (this coach's own app, platform admin, Stripe checks)
    // sees the reverted state consistently from here on.
    if (row?.planGrantedManually && row.manualPlanExpiresAt && row.manualPlanExpiresAt.getTime() <= Date.now()) {
      const [reverted] = await db.update(settings).set({
        subscriptionPlan: "free",
        subscriptionStatus: "trial",
        planGrantedManually: false,
        manualPlanExpiresAt: null,
      }).where(eq(settings.id, userId)).returning();
      return reverted;
    }
    return row;
  }

  async getSettingsByStripeSubscriptionId(subscriptionId: string): Promise<Settings | undefined> {
    const rows = await db.select().from(settings).where(eq(settings.stripeSubscriptionId, subscriptionId));
    return rows[0];
  }

  async upsertSettings(userId: string, data: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings(userId);
    if (existing) {
      const rows = await db.update(settings).set(data).where(eq(settings.id, userId)).returning();
      return rows[0];
    }
    const rows = await db.insert(settings).values({ ...data, id: userId }).returning();
    return rows[0];
  }

  async getClientForms(userId: string): Promise<ClientForm[]> {
    return db.select().from(clientForms).where(eq(clientForms.userId, userId));
  }

  async getClientForm(userId: string, id: string): Promise<ClientForm | undefined> {
    const rows = await db.select().from(clientForms).where(and(eq(clientForms.id, id), eq(clientForms.userId, userId)));
    return rows[0];
  }

  async createClientForm(userId: string, data: InsertClientForm): Promise<ClientForm> {
    const rows = await db.insert(clientForms).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateClientForm(userId: string, id: string, data: Partial<InsertClientForm>): Promise<ClientForm | undefined> {
    const rows = await db.update(clientForms).set(withoutOwnershipFields(data)).where(and(eq(clientForms.id, id), eq(clientForms.userId, userId))).returning();
    return rows[0];
  }

  async deleteClientForm(userId: string, id: string): Promise<void> {
    await db.delete(clientForms).where(and(eq(clientForms.id, id), eq(clientForms.userId, userId)));
  }

  async getReferrals(userId: string): Promise<Referral[]> {
    return db.select().from(referrals).where(eq(referrals.userId, userId));
  }

  async createReferral(userId: string, data: InsertReferral): Promise<Referral> {
    const rows = await db.insert(referrals).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateReferral(userId: string, id: string, data: Partial<InsertReferral>): Promise<Referral | undefined> {
    const rows = await db.update(referrals).set(withoutOwnershipFields(data)).where(and(eq(referrals.id, id), eq(referrals.userId, userId))).returning();
    return rows[0];
  }

  async getInvoices(userId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.userId, userId));
  }

  async getInvoice(userId: string, id: string): Promise<Invoice | undefined> {
    const rows = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
    return rows[0];
  }

  async createInvoice(userId: string, data: InsertInvoice): Promise<Invoice> {
    const rows = await db.insert(invoices).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateInvoice(userId: string, id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const rows = await db.update(invoices).set(withoutOwnershipFields(data)).where(and(eq(invoices.id, id), eq(invoices.userId, userId))).returning();
    return rows[0];
  }

  async deleteAccountData(userId: string): Promise<void> {
    await db.transaction(async tx => {
      await tx.delete(formRequests).where(eq(formRequests.userId, userId));
      await tx.delete(formTemplates).where(eq(formTemplates.userId, userId));
      await tx.delete(invoices).where(eq(invoices.userId, userId));
      await tx.delete(sessionNotes).where(eq(sessionNotes.userId, userId));
      await tx.delete(clientForms).where(eq(clientForms.userId, userId));
      await tx.delete(packages).where(eq(packages.userId, userId));
      await tx.delete(trainingSessions).where(eq(trainingSessions.userId, userId));
      await tx.delete(referrals).where(eq(referrals.userId, userId));
      await tx.delete(clients).where(eq(clients.userId, userId));
      await tx.delete(settings).where(eq(settings.id, userId));
    });
  }

  async exportAccountData(userId: string): Promise<AccountExport> {
    const [clientRows, packageRows, sessionRows, invoiceRows, noteRows, formRows, referralRows, settingsRow, templateRows] = await Promise.all([
      this.getClients(userId),
      this.getPackages(userId),
      this.getSessions(userId),
      this.getInvoices(userId),
      this.getNotes(userId),
      this.getClientForms(userId),
      this.getReferrals(userId),
      this.getSettings(userId),
      db.select().from(formTemplates).where(eq(formTemplates.userId, userId)),
    ]);
    return {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: settingsRow ? pickPortableSettings(settingsRow) : null,
      clients: clientRows,
      packages: packageRows,
      sessions: sessionRows,
      invoices: invoiceRows,
      sessionNotes: noteRows,
      clientForms: formRows,
      referrals: referralRows,
      formTemplates: templateRows.map(t => ({ title: t.title, description: t.description, questions: t.questions })),
    };
  }

  async importAccountData(userId: string, payload: AccountImportPayload): Promise<AccountImportSummary> {
    return db.transaction(async tx => {
      const clientIdMap = new Map<string, string>();
      const packageIdMap = new Map<string, string>();
      const sessionIdMap = new Map<string, string>();
      const summary: AccountImportSummary = {
        clients: 0, packages: 0, sessions: 0, invoices: 0, sessionNotes: 0, clientForms: 0, referrals: 0,
      };

      for (const item of payload.clients) {
        const { id: oldId, ...values } = item;
        const [row] = await tx.insert(clients).values({ ...values, userId }).returning();
        clientIdMap.set(oldId, row.id);
        summary.clients += 1;
      }
      for (const item of payload.packages) {
        const { id: oldId, clientId: oldClientId, ...values } = item;
        const newClientId = clientIdMap.get(oldClientId);
        if (!newClientId) continue;
        const [row] = await tx.insert(packages).values({ ...values, userId, clientId: newClientId }).returning();
        packageIdMap.set(oldId, row.id);
        summary.packages += 1;
      }
      for (const item of payload.sessions) {
        const { id: oldId, clientId: oldClientId, ...values } = item;
        const newClientId = clientIdMap.get(oldClientId);
        if (!newClientId) continue;
        const [row] = await tx.insert(trainingSessions).values({ ...values, userId, clientId: newClientId }).returning();
        sessionIdMap.set(oldId, row.id);
        summary.sessions += 1;
      }
      for (const item of payload.invoices) {
        const { id: _oldId, clientId: oldClientId, packageId: oldPackageId, ...values } = item;
        const newClientId = clientIdMap.get(oldClientId);
        if (!newClientId) continue;
        const newPackageId = oldPackageId ? packageIdMap.get(oldPackageId) ?? null : null;
        await tx.insert(invoices).values({ ...values, userId, clientId: newClientId, packageId: newPackageId });
        summary.invoices += 1;
      }
      for (const item of payload.sessionNotes) {
        const { id: _oldId, clientId: oldClientId, sessionId: oldSessionId, ...values } = item;
        const newClientId = clientIdMap.get(oldClientId);
        if (!newClientId) continue;
        const newSessionId = oldSessionId ? sessionIdMap.get(oldSessionId) ?? null : null;
        await tx.insert(sessionNotes).values({ ...values, userId, clientId: newClientId, sessionId: newSessionId });
        summary.sessionNotes += 1;
      }
      for (const item of payload.clientForms) {
        const { id: _oldId, clientId: oldClientId, ...values } = item;
        const newClientId = clientIdMap.get(oldClientId);
        if (!newClientId) continue;
        await tx.insert(clientForms).values({ ...values, userId, clientId: newClientId });
        summary.clientForms += 1;
      }
      for (const item of payload.referrals) {
        const { id: _oldId, referrerClientId: oldReferrer, referredClientId: oldReferred, ...values } = item;
        const newReferrer = clientIdMap.get(oldReferrer);
        if (!newReferrer) continue;
        const newReferred = oldReferred ? clientIdMap.get(oldReferred) ?? null : null;
        await tx.insert(referrals).values({ ...values, userId, referrerClientId: newReferrer, referredClientId: newReferred });
        summary.referrals += 1;
      }
      if (payload.settings) {
        const filtered = pickPortableSettings(payload.settings);
        if (Object.keys(filtered).length) {
          await tx.update(settings).set(filtered).where(eq(settings.id, userId));
        }
      }
      return summary;
    });
  }

  // Platform admin
  async getAllUsers(): Promise<User[]> {
    const rows = await db.select({ user: users, businessName: settings.businessName })
      .from(users).leftJoin(settings, eq(settings.id, users.id)).orderBy(users.createdAt);
    return rows.map(({ user, businessName }) => ({ ...user, businessName }));
  }

  async getPlatformConfig(): Promise<PlatformConfig> {
    const rows = await db.select().from(platformConfig).where(eq(platformConfig.id, "default"));
    if (rows[0]) return rows[0];
    const created = await db.insert(platformConfig).values({ id: "default" }).returning();
    return created[0];
  }

  async upsertPlatformConfig(data: Partial<PlatformConfig>): Promise<PlatformConfig> {
    const existing = await db.select().from(platformConfig).where(eq(platformConfig.id, "default"));
    if (existing[0]) {
      const rows = await db.update(platformConfig).set(data).where(eq(platformConfig.id, "default")).returning();
      return rows[0];
    }
    const rows = await db.insert(platformConfig).values({ id: "default", ...data }).returning();
    return rows[0];
  }

  async getCoachDetail(coachId: string): Promise<CoachDetail | undefined> {
    const [allUsers, coachClients, coachSessions, coachInvoices, coachSettings] = await Promise.all([
      db.select().from(users).where(eq(users.id, coachId)),
      db.select().from(clients).where(eq(clients.userId, coachId)),
      db.select().from(trainingSessions).where(eq(trainingSessions.userId, coachId)),
      db.select().from(invoices).where(eq(invoices.userId, coachId)),
      db.select().from(settings).where(eq(settings.id, coachId)),
    ]);
    const coach = allUsers[0];
    if (!coach) return undefined;
    const totalRevenue = coachInvoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    return {
      coach,
      clients: coachClients,
      stats: { totalClients: coachClients.length, totalSessions: coachSessions.length, totalRevenue },
      plan: coachSettings[0]?.subscriptionPlan || "free",
      planGrantedManually: coachSettings[0]?.planGrantedManually || false,
      manualPlanExpiresAt: coachSettings[0]?.manualPlanExpiresAt?.toISOString() || null,
      stripeCustomerId: coachSettings[0]?.stripeCustomerId || null,
    };
  }

  async updateCoachPlan(coachId: string, plan: string, expiresAt?: Date | null): Promise<void> {
    const existing = await db.select().from(settings).where(eq(settings.id, coachId));
    const fields = {
      subscriptionPlan: plan,
      subscriptionStatus: plan === "free" ? "trial" : "active",
      planGrantedManually: true,
      manualPlanExpiresAt: expiresAt ?? null,
    };
    if (existing[0]) {
      await db.update(settings).set(fields).where(eq(settings.id, coachId));
    } else {
      await db.insert(settings).values({ id: coachId, trainerName: "Coach", ...fields });
    }
  }

  async clearBillingReference(coachId: string): Promise<void> {
    await db.update(settings).set({ stripeCustomerId: null, stripeSubscriptionId: null }).where(eq(settings.id, coachId));
  }

  async getPlatformStats(): Promise<PlatformStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    const [allUsers, allClients, allSessions, allInvoices] = await Promise.all([
      db.select().from(users),
      db.select().from(clients),
      db.select().from(trainingSessions),
      db.select().from(invoices),
    ]);

    const totalRevenue = allInvoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

    const newUsersThisMonth = allUsers.filter(u =>
      u.createdAt && u.createdAt.toISOString().split("T")[0] >= monthStart
    ).length;

    // Active users = users who have at least one session this month
    const activeUserIds = new Set(
      allSessions
        .filter(s => s.date >= monthStart)
        .map(s => s.userId)
        .filter(Boolean)
    );

    return {
      totalUsers: allUsers.length,
      totalClients: allClients.length,
      totalSessions: allSessions.length,
      totalInvoices: allInvoices.length,
      totalRevenue,
      newUsersThisMonth,
      activeUsersThisMonth: activeUserIds.size,
    };
  }

  // Waitlist
  async createWaitlistSignup(data: InsertWaitlistSignup): Promise<WaitlistSignup> {
    const rows = await db.insert(waitlistSignups).values(data).returning();
    return rows[0];
  }

  async getWaitlistSignupByEmail(email: string): Promise<WaitlistSignup | undefined> {
    const rows = await db.select().from(waitlistSignups).where(eq(waitlistSignups.email, email));
    return rows[0];
  }

  async getWaitlistSignups(): Promise<WaitlistSignup[]> {
    return db.select().from(waitlistSignups).orderBy(desc(waitlistSignups.createdAt));
  }

  // Blog
  async getPublishedBlogPosts(): Promise<BlogPost[]> {
    return db.select().from(blogPosts).where(eq(blogPosts.published, true)).orderBy(desc(blogPosts.publishedAt));
  }

  async getPublishedBlogPost(slug: string): Promise<BlogPost | undefined> {
    const rows = await db.select().from(blogPosts).where(and(eq(blogPosts.slug, slug), eq(blogPosts.published, true)));
    return rows[0];
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return rows[0];
  }

  async createBlogPost(data: InsertBlogPost): Promise<BlogPost> {
    const rows = await db.insert(blogPosts).values({
      ...data,
      publishedAt: data.published ? new Date() : null,
    }).returning();
    return rows[0];
  }

  async updateBlogPost(id: string, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const existing = await this.getBlogPost(id);
    if (!existing) return undefined;
    const justPublished = data.published && !existing.published;
    const rows = await db.update(blogPosts).set({
      ...data,
      updatedAt: new Date(),
      ...(justPublished ? { publishedAt: new Date() } : {}),
    }).where(eq(blogPosts.id, id)).returning();
    return rows[0];
  }

  async deleteBlogPost(id: string): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }
}

export const storage = new DatabaseStorage();

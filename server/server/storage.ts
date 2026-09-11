import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  clients, trainingSessions, packages, sessionNotes, settings, clientForms, referrals, invoices, users, platformConfig,
  type Client, type InsertClient,
  type Session, type InsertSession,
  type Package, type InsertPackage,
  type SessionNote, type InsertSessionNote,
  type Settings, type InsertSettings,
  type ClientForm, type InsertClientForm,
  type Referral, type InsertReferral,
  type Invoice, type InsertInvoice,
  type User, type PlatformConfig,
} from "@shared/schema";

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

  // Platform admin (owner only)
  getAllUsers(): Promise<User[]>;
  getPlatformStats(): Promise<PlatformStats>;
  getPlatformConfig(): Promise<PlatformConfig>;
  upsertPlatformConfig(data: Partial<PlatformConfig>): Promise<PlatformConfig>;
  getCoachDetail(coachId: string): Promise<CoachDetail | undefined>;
  updateCoachPlan(coachId: string, plan: string): Promise<void>;
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
    return rows[0];
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

  // Platform admin
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.createdAt);
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
    };
  }

  async updateCoachPlan(coachId: string, plan: string): Promise<void> {
    const existing = await db.select().from(settings).where(eq(settings.id, coachId));
    if (existing[0]) {
      await db.update(settings).set({ subscriptionPlan: plan, subscriptionStatus: plan === "free" ? "trial" : "active" }).where(eq(settings.id, coachId));
    } else {
      await db.insert(settings).values({ id: coachId, trainerName: "Coach", subscriptionPlan: plan, subscriptionStatus: plan === "free" ? "trial" : "active" });
    }
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
}

export const storage = new DatabaseStorage();

import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  clients, trainingSessions, packages, sessionNotes, settings, clientForms, referrals, invoices, users,
  type Client, type InsertClient,
  type Session, type InsertSession,
  type Package, type InsertPackage,
  type SessionNote, type InsertSessionNote,
  type Settings, type InsertSettings,
  type ClientForm, type InsertClientForm,
  type Referral, type InsertReferral,
  type Invoice, type InsertInvoice,
  type User,
} from "@shared/schema";

export interface IStorage {
  // User-scoped operations (all require userId)
  getClients(userId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(userId: string, data: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  getSessions(userId: string): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(userId: string, data: InsertSession): Promise<Session>;
  updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;

  getPackages(userId: string): Promise<Package[]>;
  getPackage(id: string): Promise<Package | undefined>;
  createPackage(userId: string, data: InsertPackage): Promise<Package>;
  updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined>;

  getNotes(userId: string): Promise<SessionNote[]>;
  getNote(id: string): Promise<SessionNote | undefined>;
  createNote(userId: string, data: InsertSessionNote): Promise<SessionNote>;
  updateNote(id: string, data: Partial<InsertSessionNote>): Promise<SessionNote | undefined>;
  deleteNote(id: string): Promise<void>;

  getSettings(userId: string): Promise<Settings | undefined>;
  upsertSettings(userId: string, data: InsertSettings): Promise<Settings>;

  getClientForms(userId: string): Promise<ClientForm[]>;
  getClientForm(id: string): Promise<ClientForm | undefined>;
  createClientForm(userId: string, data: InsertClientForm): Promise<ClientForm>;
  updateClientForm(id: string, data: Partial<InsertClientForm>): Promise<ClientForm | undefined>;
  deleteClientForm(id: string): Promise<void>;

  getReferrals(userId: string): Promise<Referral[]>;
  createReferral(userId: string, data: InsertReferral): Promise<Referral>;
  updateReferral(id: string, data: Partial<InsertReferral>): Promise<Referral | undefined>;

  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(userId: string, data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;

  // Platform admin (owner only)
  getAllUsers(): Promise<User[]>;
  getPlatformStats(): Promise<PlatformStats>;
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

export class DatabaseStorage implements IStorage {
  async getClients(userId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.userId, userId));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const rows = await db.select().from(clients).where(eq(clients.id, id));
    return rows[0];
  }

  async createClient(userId: string, data: InsertClient): Promise<Client> {
    const rows = await db.insert(clients).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const rows = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return rows[0];
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getSessions(userId: string): Promise<Session[]> {
    return db.select().from(trainingSessions).where(eq(trainingSessions.userId, userId));
  }

  async getSession(id: string): Promise<Session | undefined> {
    const rows = await db.select().from(trainingSessions).where(eq(trainingSessions.id, id));
    return rows[0];
  }

  async createSession(userId: string, data: InsertSession): Promise<Session> {
    const rows = await db.insert(trainingSessions).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    const rows = await db.update(trainingSessions).set(data).where(eq(trainingSessions.id, id)).returning();
    return rows[0];
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(trainingSessions).where(eq(trainingSessions.id, id));
  }

  async getPackages(userId: string): Promise<Package[]> {
    return db.select().from(packages).where(eq(packages.userId, userId));
  }

  async getPackage(id: string): Promise<Package | undefined> {
    const rows = await db.select().from(packages).where(eq(packages.id, id));
    return rows[0];
  }

  async createPackage(userId: string, data: InsertPackage): Promise<Package> {
    const rows = await db.insert(packages).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined> {
    const rows = await db.update(packages).set(data).where(eq(packages.id, id)).returning();
    return rows[0];
  }

  async getNotes(userId: string): Promise<SessionNote[]> {
    return db.select().from(sessionNotes).where(eq(sessionNotes.userId, userId));
  }

  async getNote(id: string): Promise<SessionNote | undefined> {
    const rows = await db.select().from(sessionNotes).where(eq(sessionNotes.id, id));
    return rows[0];
  }

  async createNote(userId: string, data: InsertSessionNote): Promise<SessionNote> {
    const rows = await db.insert(sessionNotes).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateNote(id: string, data: Partial<InsertSessionNote>): Promise<SessionNote | undefined> {
    const rows = await db.update(sessionNotes).set(data).where(eq(sessionNotes.id, id)).returning();
    return rows[0];
  }

  async deleteNote(id: string): Promise<void> {
    await db.delete(sessionNotes).where(eq(sessionNotes.id, id));
  }

  async getSettings(userId: string): Promise<Settings | undefined> {
    const rows = await db.select().from(settings).where(eq(settings.id, userId));
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

  async getClientForm(id: string): Promise<ClientForm | undefined> {
    const rows = await db.select().from(clientForms).where(eq(clientForms.id, id));
    return rows[0];
  }

  async createClientForm(userId: string, data: InsertClientForm): Promise<ClientForm> {
    const rows = await db.insert(clientForms).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateClientForm(id: string, data: Partial<InsertClientForm>): Promise<ClientForm | undefined> {
    const rows = await db.update(clientForms).set(data).where(eq(clientForms.id, id)).returning();
    return rows[0];
  }

  async deleteClientForm(id: string): Promise<void> {
    await db.delete(clientForms).where(eq(clientForms.id, id));
  }

  async getReferrals(userId: string): Promise<Referral[]> {
    return db.select().from(referrals).where(eq(referrals.userId, userId));
  }

  async createReferral(userId: string, data: InsertReferral): Promise<Referral> {
    const rows = await db.insert(referrals).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateReferral(id: string, data: Partial<InsertReferral>): Promise<Referral | undefined> {
    const rows = await db.update(referrals).set(data).where(eq(referrals.id, id)).returning();
    return rows[0];
  }

  async getInvoices(userId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.userId, userId));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const rows = await db.select().from(invoices).where(eq(invoices.id, id));
    return rows[0];
  }

  async createInvoice(userId: string, data: InsertInvoice): Promise<Invoice> {
    const rows = await db.insert(invoices).values({ ...data, userId }).returning();
    return rows[0];
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const rows = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return rows[0];
  }

  // Platform admin
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.createdAt);
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

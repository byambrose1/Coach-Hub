import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  clients, sessions, packages, sessionNotes, settings, clientForms, referrals, invoices,
  type Client, type InsertClient,
  type Session, type InsertSession,
  type Package, type InsertPackage,
  type SessionNote, type InsertSessionNote,
  type Settings, type InsertSettings,
  type ClientForm, type InsertClientForm,
  type Referral, type InsertReferral,
  type Invoice, type InsertInvoice,
} from "@shared/schema";

export interface IStorage {
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  getSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(data: InsertSession): Promise<Session>;
  updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;

  getPackages(): Promise<Package[]>;
  getPackage(id: string): Promise<Package | undefined>;
  createPackage(data: InsertPackage): Promise<Package>;
  updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined>;

  getNotes(): Promise<SessionNote[]>;
  getNote(id: string): Promise<SessionNote | undefined>;
  createNote(data: InsertSessionNote): Promise<SessionNote>;
  updateNote(id: string, data: Partial<InsertSessionNote>): Promise<SessionNote | undefined>;
  deleteNote(id: string): Promise<void>;

  getSettings(): Promise<Settings | undefined>;
  upsertSettings(data: InsertSettings): Promise<Settings>;

  getClientForms(): Promise<ClientForm[]>;
  getClientForm(id: string): Promise<ClientForm | undefined>;
  createClientForm(data: InsertClientForm): Promise<ClientForm>;
  updateClientForm(id: string, data: Partial<InsertClientForm>): Promise<ClientForm | undefined>;
  deleteClientForm(id: string): Promise<void>;

  getReferrals(): Promise<Referral[]>;
  createReferral(data: InsertReferral): Promise<Referral>;
  updateReferral(id: string, data: Partial<InsertReferral>): Promise<Referral | undefined>;

  getInvoices(): Promise<Invoice[]>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getClients(): Promise<Client[]> {
    return db.select().from(clients);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const rows = await db.select().from(clients).where(eq(clients.id, id));
    return rows[0];
  }

  async createClient(data: InsertClient): Promise<Client> {
    const rows = await db.insert(clients).values(data).returning();
    return rows[0];
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const rows = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return rows[0];
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getSessions(): Promise<Session[]> {
    return db.select().from(sessions);
  }

  async getSession(id: string): Promise<Session | undefined> {
    const rows = await db.select().from(sessions).where(eq(sessions.id, id));
    return rows[0];
  }

  async createSession(data: InsertSession): Promise<Session> {
    const rows = await db.insert(sessions).values(data).returning();
    return rows[0];
  }

  async updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    const rows = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
    return rows[0];
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async getPackages(): Promise<Package[]> {
    return db.select().from(packages);
  }

  async getPackage(id: string): Promise<Package | undefined> {
    const rows = await db.select().from(packages).where(eq(packages.id, id));
    return rows[0];
  }

  async createPackage(data: InsertPackage): Promise<Package> {
    const rows = await db.insert(packages).values(data).returning();
    return rows[0];
  }

  async updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined> {
    const rows = await db.update(packages).set(data).where(eq(packages.id, id)).returning();
    return rows[0];
  }

  async getNotes(): Promise<SessionNote[]> {
    return db.select().from(sessionNotes);
  }

  async getNote(id: string): Promise<SessionNote | undefined> {
    const rows = await db.select().from(sessionNotes).where(eq(sessionNotes.id, id));
    return rows[0];
  }

  async createNote(data: InsertSessionNote): Promise<SessionNote> {
    const rows = await db.insert(sessionNotes).values(data).returning();
    return rows[0];
  }

  async updateNote(id: string, data: Partial<InsertSessionNote>): Promise<SessionNote | undefined> {
    const rows = await db.update(sessionNotes).set(data).where(eq(sessionNotes.id, id)).returning();
    return rows[0];
  }

  async deleteNote(id: string): Promise<void> {
    await db.delete(sessionNotes).where(eq(sessionNotes.id, id));
  }

  async getSettings(): Promise<Settings | undefined> {
    const rows = await db.select().from(settings).where(eq(settings.id, "default"));
    return rows[0];
  }

  async upsertSettings(data: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings();
    if (existing) {
      const rows = await db.update(settings).set(data).where(eq(settings.id, "default")).returning();
      return rows[0];
    }
    const rows = await db.insert(settings).values({ ...data, id: "default" }).returning();
    return rows[0];
  }

  async getClientForms(): Promise<ClientForm[]> {
    return db.select().from(clientForms);
  }

  async getClientForm(id: string): Promise<ClientForm | undefined> {
    const rows = await db.select().from(clientForms).where(eq(clientForms.id, id));
    return rows[0];
  }

  async createClientForm(data: InsertClientForm): Promise<ClientForm> {
    const rows = await db.insert(clientForms).values(data).returning();
    return rows[0];
  }

  async updateClientForm(id: string, data: Partial<InsertClientForm>): Promise<ClientForm | undefined> {
    const rows = await db.update(clientForms).set(data).where(eq(clientForms.id, id)).returning();
    return rows[0];
  }

  async deleteClientForm(id: string): Promise<void> {
    await db.delete(clientForms).where(eq(clientForms.id, id));
  }

  async getReferrals(): Promise<Referral[]> {
    return db.select().from(referrals);
  }

  async createReferral(data: InsertReferral): Promise<Referral> {
    const rows = await db.insert(referrals).values(data).returning();
    return rows[0];
  }

  async updateReferral(id: string, data: Partial<InsertReferral>): Promise<Referral | undefined> {
    const rows = await db.update(referrals).set(data).where(eq(referrals.id, id)).returning();
    return rows[0];
  }

  async getInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices);
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const rows = await db.insert(invoices).values(data).returning();
    return rows[0];
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const rows = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return rows[0];
  }
}

export const storage = new DatabaseStorage();

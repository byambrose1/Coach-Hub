import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  clients, sessions, packages, sessionNotes, settings,
  type Client, type InsertClient,
  type Session, type InsertSession,
  type Package, type InsertPackage,
  type SessionNote, type InsertSessionNote,
  type Settings, type InsertSettings,
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
  createNote(data: InsertSessionNote): Promise<SessionNote>;

  getSettings(): Promise<Settings | undefined>;
  upsertSettings(data: InsertSettings): Promise<Settings>;
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

  async createNote(data: InsertSessionNote): Promise<SessionNote> {
    const rows = await db.insert(sessionNotes).values(data).returning();
    return rows[0];
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
}

export const storage = new DatabaseStorage();

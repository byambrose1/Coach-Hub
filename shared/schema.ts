import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  sessionType: text("session_type").default("1:1"),
  status: text("status").default("active"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  sessionType: text("session_type").default("1:1"),
  location: text("location"),
  status: text("status").default("scheduled"),
  notes: text("notes"),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export const packages = pgTable("packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(),
  totalSessions: integer("total_sessions").notNull(),
  usedSessions: integer("used_sessions").default(0),
  price: text("price"),
  status: text("status").default("active"),
});

export const insertPackageSchema = createInsertSchema(packages).omit({ id: true });
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packages.$inferSelect;

export const sessionNotes = pgTable("session_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id"),
  clientId: varchar("client_id").notNull(),
  content: text("content").notNull(),
  date: text("date").notNull(),
});

export const insertSessionNoteSchema = createInsertSchema(sessionNotes).omit({ id: true });
export type InsertSessionNote = z.infer<typeof insertSessionNoteSchema>;
export type SessionNote = typeof sessionNotes.$inferSelect;

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`'default'`),
  trainerName: text("trainer_name").default("Coach"),
  cancellationPolicy: text("cancellation_policy"),
  paymentLink: text("payment_link"),
  businessName: text("business_name"),
  lowSessionThreshold: integer("low_session_threshold").default(2),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

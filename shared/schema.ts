import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().default(""),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  sessionType: text("session_type").default("1:1"),
  status: text("status").default("active"),
  referredBy: varchar("referred_by"),
  referralCode: text("referral_code"),
  gocardlessMandateStatus: text("gocardless_mandate_status").default("inactive"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const trainingSessions = pgTable("training_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().default(""),
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

export const insertSessionSchema = createInsertSchema(trainingSessions).omit({ id: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof trainingSessions.$inferSelect;

export const packages = pgTable("packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().default(""),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(),
  totalSessions: integer("total_sessions").notNull(),
  usedSessions: integer("used_sessions").default(0),
  price: text("price"),
  status: text("status").default("active"),
  billingType: text("billing_type").default("block"),
  monthlyRate: text("monthly_rate"),
  nextBillingDate: text("next_billing_date"),
});

export const insertPackageSchema = createInsertSchema(packages).omit({ id: true });
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packages.$inferSelect;

export const sessionNotes = pgTable("session_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().default(""),
  sessionId: varchar("session_id"),
  clientId: varchar("client_id").notNull(),
  content: text("content").notNull(),
  date: text("date").notNull(),
  updatedAt: text("updated_at"),
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
  trainerEmail: text("trainer_email"),
  trainerPhone: text("trainer_phone"),
  businessAddress: text("business_address"),
  acceptedPaymentMethods: text("accepted_payment_methods"),
  invoicePrefix: text("invoice_prefix").default("INV"),
  enableEmailNotifications: boolean("enable_email_notifications").default(false),
  enableSessionReminders: boolean("enable_session_reminders").default(false),
  reminderHoursBefore: integer("reminder_hours_before").default(24),
  subscriptionStatus: text("subscription_status").default("trial"),
  subscriptionPlan: text("subscription_plan").default("free"),
  hipaaCompliant: boolean("hipaa_compliant").default(false),
  dataRetentionDays: integer("data_retention_days").default(365),
  termsAccepted: boolean("terms_accepted").default(false),
  currency: text("currency").default("£"),
  hasAcceptedTerms: boolean("has_accepted_terms").default(false),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export const clientForms = pgTable("client_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().default(""),
  clientId: varchar("client_id").notNull(),
  formType: text("form_type").notNull(),
  title: text("title").notNull(),
  responses: text("responses").notNull(),
  status: text("status").default("completed"),
  date: text("date").notNull(),
  updatedAt: text("updated_at"),
});

export const insertClientFormSchema = createInsertSchema(clientForms).omit({ id: true });
export type InsertClientForm = z.infer<typeof insertClientFormSchema>;
export type ClientForm = typeof clientForms.$inferSelect;

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().default(""),
  referrerClientId: varchar("referrer_client_id").notNull(),
  referredClientId: varchar("referred_client_id"),
  referredName: text("referred_name").notNull(),
  referredEmail: text("referred_email"),
  referredPhone: text("referred_phone"),
  status: text("status").default("pending"),
  rewardType: text("reward_type").default("free_session"),
  rewardApplied: boolean("reward_applied").default(false),
  date: text("date").notNull(),
  notes: text("notes"),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().default(""),
  clientId: varchar("client_id").notNull(),
  packageId: varchar("package_id"),
  invoiceNumber: text("invoice_number").notNull(),
  amount: text("amount").notNull(),
  status: text("status").default("pending"),
  dueDate: text("due_date").notNull(),
  sentDate: text("sent_date"),
  paidDate: text("paid_date"),
  notes: text("notes"),
  paymentMethod: text("payment_method"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

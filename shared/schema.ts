import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, date, jsonb, customType, primaryKey, check } from "drizzle-orm/pg-core";
import { users } from "./models/auth";
import type { CustomQuestion } from "./custom-forms";
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
  reminderSentKey: text("reminder_sent_key"),
});

export const insertSessionSchema = createInsertSchema(trainingSessions).omit({ id: true, reminderSentKey: true });
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
  lowSessionThreshold: integer("low_session_threshold").default(3),
  trainerEmail: text("trainer_email"),
  trainerPhone: text("trainer_phone"),
  businessAddress: text("business_address"),
  acceptedPaymentMethods: text("accepted_payment_methods"),
  // Payment methods a coach offers their own clients. Each is a simple
  // record-keeping / link-sharing option - none of it moves money through
  // Practably. Stripe/PayPal here are the coach's OWN payment links (e.g. a
  // Stripe Payment Link or paypal.me URL they set up themselves), not a
  // Practably-run checkout.
  acceptsCash: boolean("accepts_cash").default(false),
  acceptsCardMachine: boolean("accepts_card_machine").default(false),
  acceptsBankTransfer: boolean("accepts_bank_transfer").default(false),
  bankTransferDetails: text("bank_transfer_details"),
  acceptsPaypal: boolean("accepts_paypal").default(false),
  paypalLink: text("paypal_link"),
  acceptsStripeLink: boolean("accepts_stripe_link").default(false),
  stripePaymentLink: text("stripe_payment_link"),
  acceptsOtherPayment: boolean("accepts_other_payment").default(false),
  otherPaymentDetails: text("other_payment_details"),
  invoicePrefix: text("invoice_prefix").default("INV"),
  enableEmailNotifications: boolean("enable_email_notifications").default(false),
  enableSessionReminders: boolean("enable_session_reminders").default(false),
  reminderHoursBefore: integer("reminder_hours_before").default(24),
  subscriptionStatus: text("subscription_status").default("trial"),
  subscriptionPlan: text("subscription_plan").default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  hipaaCompliant: boolean("hipaa_compliant").default(false),
  dataRetentionDays: integer("data_retention_days").default(365),
  termsAccepted: boolean("terms_accepted").default(false),
  currency: text("currency").default("£"),
  hasAcceptedTerms: boolean("has_accepted_terms").default(false),
  // Set only by POST /api/settings/accept-terms, server-side - never trust a
  // client-supplied version/timestamp for these.
  termsAcceptedVersion: text("terms_accepted_version"),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  cancellationNoticeHours: integer("cancellation_notice_hours").default(24),
  timezone: text("timezone").default("Europe/London"),
  onboardingProgress: text("onboarding_progress").default("{}"),
  onboardingDismissed: boolean("onboarding_dismissed").default(false),
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

export const platformConfig = pgTable("platform_config", {
  id: varchar("id").primaryKey().default(sql`'default'`),
  tier1MaxClients: integer("tier1_max_clients").default(5),
  tier1Price: text("tier1_price").default("0"),
  tier1PaymentLink: text("tier1_payment_link").default(""),
  tier2MaxClients: integer("tier2_max_clients").default(10),
  tier2Price: text("tier2_price").default("1.99"),
  tier2PaymentLink: text("tier2_payment_link").default(""),
  tier3MaxClients: integer("tier3_max_clients").default(20),
  tier3Price: text("tier3_price").default("4.99"),
  tier3PaymentLink: text("tier3_payment_link").default(""),
  tier4MaxClients: integer("tier4_max_clients").default(50),
  tier4Price: text("tier4_price").default("7.99"),
  tier4PaymentLink: text("tier4_payment_link").default(""),
});

export type PlatformConfig = typeof platformConfig.$inferSelect;
export const insertPlatformConfigSchema = createInsertSchema(platformConfig).omit({ id: true });
export type InsertPlatformConfig = z.infer<typeof insertPlatformConfigSchema>;

export const waitlistSignups = pgTable("waitlist_signups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  name: text("name"),
  coachingFocus: text("coaching_focus"),
  howHeard: text("how_heard"),
  createdAt: timestamp("created_at").defaultNow(),
  invited: boolean("invited").default(false),
});

export const insertWaitlistSignupSchema = createInsertSchema(waitlistSignups)
  .omit({ id: true, createdAt: true, invited: true })
  .extend({ email: z.string().trim().toLowerCase().email() });
export type InsertWaitlistSignup = z.infer<typeof insertWaitlistSignupSchema>;
export type WaitlistSignup = typeof waitlistSignups.$inferSelect;

export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  contentMarkdown: text("content_markdown").notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  authorName: text("author_name").default("The Practably Team"),
  published: boolean("published").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

export const formTemplates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  questions: jsonb("questions").$type<CustomQuestion[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const formRequests = pgTable("form_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  templateId: varchar("template_id").references(() => formTemplates.id, { onDelete: "set null" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  questions: jsonb("questions").$type<CustomQuestion[]>().notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  clientFormId: varchar("client_form_id").references(() => clientForms.id, { onDelete: "set null" }),
});

const documentBytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
export const formDocuments = pgTable("form_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  requestId: varchar("request_id").notNull().references(() => formRequests.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  clientFormId: varchar("client_form_id").references(() => clientForms.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mediaType: text("media_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  content: documentBytes("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
});

export const emailNotificationUsage = pgTable("email_notification_usage", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  usedCount: integer("used_count").notNull().default(0),
}, table => [
  primaryKey({ columns: [table.userId, table.weekStart] }),
  check("email_notification_usage_count_check", sql`${table.usedCount} >= 0 AND ${table.usedCount} <= 10`),
]);

export const platformStaff = pgTable("platform_staff", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  grantedBy: varchar("granted_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

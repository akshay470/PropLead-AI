import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  bigint,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ==========================================
// ENUMS
// ==========================================

export const userRoleEnum = pgEnum("user_role", [
  "buyer",
  "executive",
  "admin",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "property_portal",
  "social_media_ad",
  "website",
  "hoarding_call",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "visit_scheduled",
  "visited",
  "lost",
]);

export const slotStatusEnum = pgEnum("slot_status", [
  "available",
  "booked",
  "blocked",
  "cancelled",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "visited",
  "no_show",
]);

export const reminderTypeEnum = pgEnum("reminder_type", [
  "1_day",
  "2_hour",
]);

export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "sent",
  "failed",
  "cancelled",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "handed_off",
  "closed",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "executive",
]);

export const messageChannelEnum = pgEnum("message_channel", [
  "whatsapp",
  "sms",
  "email",
]);

export const messageLogStatusEnum = pgEnum("message_log_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
]);

// ==========================================
// 1. USERS
// ==========================================
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").default("buyer").notNull(),
    isAdmin: boolean("is_admin").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("users_role_idx").on(table.role),
  ]
);

// ==========================================
// 2. PROJECTS
// ==========================================
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  reraNumber: varchar("rera_number", { length: 100 }).notNull(),
  locationName: varchar("location_name", { length: 255 }).notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 3. LEADS
// ==========================================
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadCode: varchar("lead_code", { length: 32 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    phoneE164: varchar("phone_e164", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }),
    source: leadSourceEnum("source").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "restrict" }),
    wants: varchar("wants", { length: 50 }), // e.g. "2BHK", "3BHK", "2BHK/3BHK"
    budgetMin: bigint("budget_min", { mode: "number" }),
    budgetMax: bigint("budget_max", { mode: "number" }),
    language: varchar("language", { length: 10 }).default("en").notNull(),
    consentGiven: boolean("consent_given").default(false).notNull(),
    optedOut: boolean("opted_out").default(false).notNull(),
    assignedExecutiveId: uuid("assigned_executive_id").references(() => users.id, { onDelete: "set null" }),
    status: leadStatusEnum("status").default("new").notNull(),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    duplicateOfId: uuid("duplicate_of_id"), // Self-referencing FK defined in relations
  },
  (table) => [
    index("leads_phone_idx").on(table.phoneE164),
    index("leads_project_idx").on(table.projectId),
    index("leads_source_idx").on(table.source),
    index("leads_status_idx").on(table.status),
    index("leads_executive_idx").on(table.assignedExecutiveId),
  ]
);

// ==========================================
// 4. FACT SHEET ENTRIES
// ==========================================
export const factSheetEntries = pgTable(
  "fact_sheet_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 100 }).notNull(),
    questionKey: varchar("question_key", { length: 255 }).notNull(),
    answerText: text("answer_text").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fact_sheet_project_idx").on(table.projectId),
    index("fact_sheet_category_idx").on(table.category),
    index("fact_sheet_question_idx").on(table.questionKey),
  ]
);

// ==========================================
// 5. VISIT SLOTS
// ==========================================
export const visitSlots = pgTable(
  "visit_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    executiveId: uuid("executive_id").references(() => users.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: slotStatusEnum("status").default("available").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("slots_project_time_idx").on(table.projectId, table.startsAt),
    index("slots_status_idx").on(table.status),
    index("slots_executive_idx").on(table.executiveId),
  ]
);

// ==========================================
// 6. BOOKINGS (with Partial Unique Index)
// ==========================================
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => visitSlots.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "restrict" }),
    status: bookingStatusEnum("status").default("confirmed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // CRITICAL: Partial unique index enforcing strict single confirmed booking per slot at DB level
    uniqueIndex("confirmed_slot_unique_idx")
      .on(table.slotId)
      .where(sql`${table.status} = 'confirmed'`),
    index("bookings_lead_idx").on(table.leadId),
    index("bookings_status_idx").on(table.status),
  ]
);

// ==========================================
// 7. REMINDERS
// ==========================================
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: reminderTypeEnum("type").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    status: reminderStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("reminders_booking_idx").on(table.bookingId),
    index("reminders_status_time_idx").on(table.status, table.scheduledAt),
  ]
);

// ==========================================
// 8. CONVERSATIONS & MESSAGES
// ==========================================
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    status: conversationStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversations_lead_idx").on(table.leadId),
    index("conversations_status_idx").on(table.status),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    language: varchar("language", { length: 10 }).default("en").notNull(),
    flagged: boolean("flagged").default(false).notNull(),
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId),
    index("messages_flagged_idx").on(table.flagged),
    index("messages_created_idx").on(table.createdAt),
  ]
);

// ==========================================
// 9. HANDOFFS
// ==========================================
export const handoffs = pgTable(
  "handoffs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    executiveId: uuid("executive_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("handoffs_lead_idx").on(table.leadId),
    index("handoffs_executive_idx").on(table.executiveId),
  ]
);

// ==========================================
// 10. MESSAGE LOG (Mocked Messaging Layer)
// ==========================================
export const messageLog = pgTable(
  "message_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channel: messageChannelEnum("channel").notNull(),
    to: varchar("to", { length: 255 }).notNull(),
    template: varchar("template", { length: 100 }).notNull(),
    body: text("body").notNull(),
    status: messageLogStatusEnum("status").default("sent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("msg_log_to_idx").on(table.to),
    index("msg_log_status_idx").on(table.status),
    index("msg_log_created_idx").on(table.createdAt),
  ]
);

// ==========================================
// 11. AD SPEND (Cost per Visit Attribution)
// ==========================================
export const adSpend = pgTable(
  "ad_spend",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: leadSourceEnum("source").notNull(),
    month: varchar("month", { length: 7 }).notNull(), // Format: YYYY-MM
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ad_spend_source_month_idx").on(table.source, table.month),
  ]
);

// ==========================================
// RELATIONS
// ==========================================
export const usersRelations = relations(users, ({ many }) => ({
  assignedLeads: many(leads),
  visitSlots: many(visitSlots),
  handoffs: many(handoffs),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  leads: many(leads),
  factSheetEntries: many(factSheetEntries),
  visitSlots: many(visitSlots),
  conversations: many(conversations),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  project: one(projects, {
    fields: [leads.projectId],
    references: [projects.id],
  }),
  assignedExecutive: one(users, {
    fields: [leads.assignedExecutiveId],
    references: [users.id],
  }),
  duplicateOf: one(leads, {
    fields: [leads.duplicateOfId],
    references: [leads.id],
    relationName: "lead_duplicates",
  }),
  duplicates: many(leads, {
    relationName: "lead_duplicates",
  }),
  bookings: many(bookings),
  conversations: many(conversations),
  handoffs: many(handoffs),
}));

export const factSheetEntriesRelations = relations(factSheetEntries, ({ one }) => ({
  project: one(projects, {
    fields: [factSheetEntries.projectId],
    references: [projects.id],
  }),
}));

export const visitSlotsRelations = relations(visitSlots, ({ one, many }) => ({
  project: one(projects, {
    fields: [visitSlots.projectId],
    references: [projects.id],
  }),
  executive: one(users, {
    fields: [visitSlots.executiveId],
    references: [users.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  slot: one(visitSlots, {
    fields: [bookings.slotId],
    references: [visitSlots.id],
  }),
  lead: one(leads, {
    fields: [bookings.leadId],
    references: [leads.id],
  }),
  reminders: many(reminders),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  booking: one(bookings, {
    fields: [reminders.bookingId],
    references: [bookings.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  lead: one(leads, {
    fields: [conversations.leadId],
    references: [leads.id],
  }),
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const handoffsRelations = relations(handoffs, ({ one }) => ({
  lead: one(leads, {
    fields: [handoffs.leadId],
    references: [leads.id],
  }),
  executive: one(users, {
    fields: [handoffs.executiveId],
    references: [users.id],
  }),
}));

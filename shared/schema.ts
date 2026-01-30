import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
});

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.string(),
  size: z.number(),
  uploadedAt: z.string(),
  uploadedBy: z.number().optional(),
});

export const historyEntrySchema = z.object({
  action: z.string(),
  userId: z.number().nullable(),
  userName: z.string().nullable(),
  timestamp: z.string(),
});

export const historyItemSchema = z.union([z.string(), historyEntrySchema]);
const nullableDateSchema = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.union([z.null(), z.coerce.date()]),
);

export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;

export const PERMISSIONS = [
  "CREATE_TASK",
  "UPDATE_TASK",
  "COMPLETE_TASK",
  "DELETE_TASK",
  "CREATE_PROJECT",
  "UPDATE_PROJECT",
  "DELETE_PROJECT",
  "MANAGE_USERS",
] as const;

export type Permission = typeof PERMISSIONS[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password"),
  name: text("name").notNull(),
  avatar: text("avatar"),
  title: text("title"),
  role: text("role").notNull().default("User"),
  permissions: jsonb("permissions").$type<Permission[]>().default([]),
  otpVerified: boolean("otp_verified").default(false),
  passwordResetOtp: text("password_reset_otp"),
  passwordResetExpires: timestamp("password_reset_expires"),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  ownerId: integer("owner_id").references(() => users.id),
  lastModifiedBy: integer("last_modified_by").references(() => users.id),
});

export const buckets = pgTable("buckets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  bucketId: integer("bucket_id").references(() => buckets.id, { onDelete: "set null" }),
  assigneeId: integer("assignee_id").references(() => users.id),
  assignedUsers: integer("assigned_users").array().default([]),
  estimateHours: integer("estimate_hours").default(0),
  estimateMinutes: integer("estimate_minutes").default(0),
  history: jsonb("history").$type<HistoryItem[]>().default([]),
  checklist: jsonb("checklist").$type<ChecklistItem[]>().default([]),
  attachments: jsonb("attachments").$type<Attachment[]>().default([]),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deletedProjects = pgTable("deleted_projects", {
  id: serial("id").primaryKey(),
  originalProjectId: integer("original_project_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  ownerId: integer("owner_id").references(() => users.id),
  lastModifiedBy: integer("last_modified_by").references(() => users.id),
  buckets: jsonb("buckets").$type<Bucket[]>().default([]),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  deletedBy: integer("deleted_by").references(() => users.id),
});

export const deletedTasks = pgTable("deleted_tasks", {
  id: serial("id").primaryKey(),
  originalTaskId: integer("original_task_id").notNull(),
  projectId: integer("project_id").notNull(),
  bucketId: integer("bucket_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: integer("assignee_id"),
  assignedUsers: integer("assigned_users").array().default([]),
  estimateHours: integer("estimate_hours").default(0),
  estimateMinutes: integer("estimate_minutes").default(0),
  history: jsonb("history").$type<HistoryItem[]>().default([]),
  checklist: jsonb("checklist").$type<ChecklistItem[]>().default([]),
  attachments: jsonb("attachments").$type<Attachment[]>().default([]),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at"),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  deletedBy: integer("deleted_by").references(() => users.id),
  deletedProjectId: integer("deleted_project_id").references(() => deletedProjects.id),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("sent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  entityName: text("entity_name"),
  action: text("action").notNull(),
  performedBy: integer("performed_by").references(() => users.id),
  performedByName: text("performed_by_name"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const projectsRelations = relations(projects, ({ many, one }) => ({
  tasks: many(tasks),
  buckets: many(buckets),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
}));

export const bucketsRelations = relations(buckets, ({ one, many }) => ({
  project: one(projects, {
    fields: [buckets.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  bucket: one(buckets, {
    fields: [tasks.bucketId],
    references: [buckets.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true }).extend({
  permissions: z.array(z.enum(PERMISSIONS)).optional().default([]),
});
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertBucketSchema = createInsertSchema(buckets).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true }).extend({
  startDate: nullableDateSchema.optional(),
  dueDate: nullableDateSchema.optional(),
  assignedUsers: z.array(z.number()).optional().default([]),
  checklist: z.array(checklistItemSchema).optional().default([]),
  attachments: z.array(attachmentSchema).optional().default([]),
  history: z.array(historyItemSchema).optional().default([]),
});
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export const insertDeletedProjectSchema = createInsertSchema(deletedProjects).omit({ id: true });
export const insertDeletedTaskSchema = createInsertSchema(deletedTasks).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Bucket = typeof buckets.$inferSelect;
export type InsertBucket = z.infer<typeof insertBucketSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type DeletedProject = typeof deletedProjects.$inferSelect;
export type InsertDeletedProject = z.infer<typeof insertDeletedProjectSchema>;
export type DeletedTask = typeof deletedTasks.$inferSelect;
export type InsertDeletedTask = z.infer<typeof insertDeletedTaskSchema>;

// API Types
export type CreateProjectRequest = InsertProject;
export type UpdateProjectRequest = Partial<InsertProject>;
export type CreateBucketRequest = InsertBucket;
export type UpdateBucketRequest = Partial<InsertBucket>;
export type CreateTaskRequest = InsertTask;
export type UpdateTaskRequest = Partial<InsertTask>;

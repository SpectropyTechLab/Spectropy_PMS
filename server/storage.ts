import { db } from "./db";
import {
  users, projects, tasks, buckets, notifications, activityLogs, deletedProjects, deletedTasks,
  type User, type InsertUser,
  type Project, type InsertProject,
  type Bucket, type InsertBucket,
  type Task, type InsertTask,
  type DeletedProject, type InsertDeletedProject,
  type DeletedTask, type InsertDeletedTask,
  type Notification, type InsertNotification,
  type ActivityLog, type InsertActivityLog,
  type UpdateProjectRequest,
  type UpdateBucketRequest,
  type UpdateTaskRequest
} from "@shared/schema";
import { eq, asc, desc, lt } from "drizzle-orm";

export type TaskSummary = Pick<
  Task,
  | "id"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "projectId"
  | "bucketId"
  | "assigneeId"
  | "assignedUsers"
  | "dueDate"
>;

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: UpdateProjectRequest): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  cloneProject(id: number, newName: string, ownerId: number): Promise<Project>;

  // Buckets
  getBuckets(projectId: number): Promise<Bucket[]>;
  getAllBuckets(): Promise<Bucket[]>;
  getBucket(id: number): Promise<Bucket | undefined>;
  createBucket(bucket: InsertBucket): Promise<Bucket>;
  updateBucket(id: number, updates: UpdateBucketRequest): Promise<Bucket>;
  deleteBucket(id: number): Promise<void>;

  getTaskSummaries(projectId?: number): Promise<TaskSummary[]>;
  getTasks(projectId?: number): Promise<Task[]>;
  getTasksByBucket(bucketId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: UpdateTaskRequest): Promise<Task>;
  deleteTask(id: number): Promise<void>;

  // Deleted items
  archiveProject(id: number, deletedBy?: number | null): Promise<{
    project: Project;
    buckets: Bucket[];
    tasks: Task[];
    deletedProjectId: number;
    deletedTasks: DeletedTask[];
  } | null>;
  archiveTask(id: number, deletedBy?: number | null): Promise<{
    task: Task;
    deletedTaskId: number;
  } | null>;
  restoreDeletedProject(deletedProjectId: number, restoredBy?: number | null): Promise<{
    project: Project;
    buckets: Bucket[];
    tasks: Task[];
  } | null>;
  restoreDeletedTask(deletedTaskId: number, restoredBy?: number | null): Promise<{
    task: Task;
  } | null>;
  purgeDeletedRecords(olderThanDays: number): Promise<{
    deletedProjects: number;
    deletedTasks: number;
  }>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: number): Promise<Notification[]>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(): Promise<ActivityLog[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(id: number, updates: UpdateProjectRequest): Promise<Project> {
    const [project] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
    return project;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.projectId, id));
    await db.delete(buckets).where(eq(buckets.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }

  async cloneProject(id: number, newName: string, ownerId: number): Promise<Project> {
    const sourceProject = await this.getProject(id);
    if (!sourceProject) {
      throw new Error("Project not found");
    }

    const [newProject] = await db.insert(projects).values({
      name: newName,
      description: sourceProject.description,
      status: "active",
      startDate: new Date(),
      ownerId: ownerId,
      lastModifiedBy: ownerId,
    }).returning();

    const sourceBuckets = await this.getBuckets(id);

    for (const bucket of sourceBuckets) {
      await db.insert(buckets).values({
        title: bucket.title,
        projectId: newProject.id,
        position: bucket.position,
      });
    }

    return newProject;
  }

  // Buckets
  async getBuckets(projectId: number): Promise<Bucket[]> {
    return await db.select().from(buckets).where(eq(buckets.projectId, projectId)).orderBy(asc(buckets.position));
  }

  async getAllBuckets(): Promise<Bucket[]> {
    return await db.select().from(buckets).orderBy(asc(buckets.position));
  }

  async getBucket(id: number): Promise<Bucket | undefined> {
    const [bucket] = await db.select().from(buckets).where(eq(buckets.id, id));
    return bucket;
  }

  async createBucket(insertBucket: InsertBucket): Promise<Bucket> {
    const [bucket] = await db.insert(buckets).values(insertBucket).returning();
    return bucket;
  }

  async updateBucket(id: number, updates: UpdateBucketRequest): Promise<Bucket> {
    const [bucket] = await db.update(buckets).set(updates).where(eq(buckets.id, id)).returning();
    return bucket;
  }

  async deleteBucket(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.bucketId, id));
    await db.delete(buckets).where(eq(buckets.id, id));
  }

  async getTaskSummaries(projectId?: number): Promise<TaskSummary[]> {
    const baseQuery = db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        projectId: tasks.projectId,
        bucketId: tasks.bucketId,
        assigneeId: tasks.assigneeId,
        assignedUsers: tasks.assignedUsers,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .orderBy(asc(tasks.position));

    if (projectId) {
      return await baseQuery.where(eq(tasks.projectId, projectId));
    }

    return await baseQuery;
  }

  async getTasks(projectId?: number): Promise<Task[]> {
    if (projectId) {
      return await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.position));
    }
    return await db.select().from(tasks).orderBy(asc(tasks.position));
  }

  async getTasksByBucket(bucketId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.bucketId, bucketId)).orderBy(asc(tasks.position));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: number, updates: UpdateTaskRequest): Promise<Task> {
    const [task] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    return task;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Deleted items
  async archiveProject(
    id: number,
    deletedBy: number | null = null,
  ): Promise<{
    project: Project;
    buckets: Bucket[];
    tasks: Task[];
    deletedProjectId: number;
    deletedTasks: DeletedTask[];
  } | null> {
    return db.transaction(async (tx) => {
      const [project] = await tx.select().from(projects).where(eq(projects.id, id));
      if (!project) return null;

      const projectBuckets = await tx
        .select()
        .from(buckets)
        .where(eq(buckets.projectId, id))
        .orderBy(asc(buckets.position));

      const projectTasks = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, id))
        .orderBy(asc(tasks.position));

      const [deletedProject] = await tx
        .insert(deletedProjects)
        .values({
          originalProjectId: project.id,
          name: project.name,
          description: project.description,
          status: project.status ?? "active",
          startDate: project.startDate,
          endDate: project.endDate,
          ownerId: project.ownerId,
          lastModifiedBy: project.lastModifiedBy,
          buckets: projectBuckets,
          deletedAt: new Date(),
          deletedBy,
        } satisfies InsertDeletedProject)
        .returning();

      let insertedDeletedTasks: DeletedTask[] = [];
      if (projectTasks.length > 0) {
        const deletedAt = new Date();
        insertedDeletedTasks = await tx
          .insert(deletedTasks)
          .values(
            projectTasks.map((task) => ({
              originalTaskId: task.id,
              projectId: task.projectId,
              bucketId: task.bucketId,
              title: task.title,
              description: task.description,
              status: task.status ?? "todo",
              priority: task.priority ?? "medium",
              assigneeId: task.assigneeId,
              assignedUsers: task.assignedUsers ?? [],
              estimateHours: task.estimateHours ?? 0,
              estimateMinutes: task.estimateMinutes ?? 0,
              history: task.history ?? [],
              checklist: task.checklist ?? [],
              attachments: task.attachments ?? [],
              startDate: task.startDate,
              dueDate: task.dueDate,
              position: task.position,
              createdAt: task.createdAt,
              deletedAt,
              deletedBy,
              deletedProjectId: deletedProject.id,
            } satisfies InsertDeletedTask)),
          )
          .returning();
      }

      await tx.delete(tasks).where(eq(tasks.projectId, id));
      await tx.delete(buckets).where(eq(buckets.projectId, id));
      await tx.delete(projects).where(eq(projects.id, id));

      return {
        project,
        buckets: projectBuckets,
        tasks: projectTasks,
        deletedProjectId: deletedProject.id,
        deletedTasks: insertedDeletedTasks,
      };
    });
  }

  async archiveTask(
    id: number,
    deletedBy: number | null = null,
  ): Promise<{ task: Task; deletedTaskId: number } | null> {
    return db.transaction(async (tx) => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, id));
      if (!task) return null;

      const [deletedTask] = await tx
        .insert(deletedTasks)
        .values({
          originalTaskId: task.id,
          projectId: task.projectId,
          bucketId: task.bucketId,
          title: task.title,
          description: task.description,
          status: task.status ?? "todo",
          priority: task.priority ?? "medium",
          assigneeId: task.assigneeId,
          assignedUsers: task.assignedUsers ?? [],
          estimateHours: task.estimateHours ?? 0,
          estimateMinutes: task.estimateMinutes ?? 0,
          history: task.history ?? [],
          checklist: task.checklist ?? [],
          attachments: task.attachments ?? [],
          startDate: task.startDate,
          dueDate: task.dueDate,
          position: task.position,
          createdAt: task.createdAt,
          deletedAt: new Date(),
          deletedBy,
          deletedProjectId: null,
        } satisfies InsertDeletedTask)
        .returning();

      await tx.delete(tasks).where(eq(tasks.id, id));

      return { task, deletedTaskId: deletedTask.id };
    });
  }

  async restoreDeletedProject(
    deletedProjectId: number,
    restoredBy: number | null = null,
  ): Promise<{ project: Project; buckets: Bucket[]; tasks: Task[] } | null> {
    return db.transaction(async (tx) => {
      const [deletedProject] = await tx
        .select()
        .from(deletedProjects)
        .where(eq(deletedProjects.id, deletedProjectId));
      if (!deletedProject) return null;

      const existingProject = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, deletedProject.originalProjectId));
      if (existingProject.length > 0) {
        throw new Error("Project already exists");
      }

      const restoredStatus =
        deletedProject.status === "deleted"
          ? "active"
          : deletedProject.status || "active";

      const [project] = await tx
        .insert(projects)
        .values({
          id: deletedProject.originalProjectId,
          name: deletedProject.name,
          description: deletedProject.description,
          status: restoredStatus,
          startDate: deletedProject.startDate,
          endDate: deletedProject.endDate,
          ownerId: deletedProject.ownerId,
          lastModifiedBy: deletedProject.lastModifiedBy ?? restoredBy ?? undefined,
        })
        .returning();

      const bucketSnapshot = (deletedProject.buckets || []) as Bucket[];
      if (bucketSnapshot.length > 0) {
        await tx.insert(buckets).values(
          bucketSnapshot.map((bucket) => ({
            id: bucket.id,
            title: bucket.title,
            projectId: project.id,
            position: bucket.position,
          })),
        );
      }

      const deletedProjectTasks = await tx
        .select()
        .from(deletedTasks)
        .where(eq(deletedTasks.deletedProjectId, deletedProjectId))
        .orderBy(asc(deletedTasks.position));

      let restoredTasks: Task[] = [];
      if (deletedProjectTasks.length > 0) {
        restoredTasks = await tx
          .insert(tasks)
          .values(
            deletedProjectTasks.map((task) => ({
              id: task.originalTaskId,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              projectId: project.id,
              bucketId: task.bucketId,
              assigneeId: task.assigneeId,
              assignedUsers: task.assignedUsers ?? [],
              estimateHours: task.estimateHours ?? 0,
              estimateMinutes: task.estimateMinutes ?? 0,
              history: task.history ?? [],
              checklist: task.checklist ?? [],
              attachments: task.attachments ?? [],
              startDate: task.startDate,
              dueDate: task.dueDate,
              position: task.position,
              createdAt: task.createdAt ?? new Date(),
            })),
          )
          .returning();
      }

      await tx
        .delete(deletedTasks)
        .where(eq(deletedTasks.deletedProjectId, deletedProjectId));
      await tx.delete(deletedProjects).where(eq(deletedProjects.id, deletedProjectId));

      return { project, buckets: bucketSnapshot, tasks: restoredTasks };
    });
  }

  async restoreDeletedTask(
    deletedTaskId: number,
    restoredBy: number | null = null,
  ): Promise<{ task: Task } | null> {
    return db.transaction(async (tx) => {
      const [deletedTask] = await tx
        .select()
        .from(deletedTasks)
        .where(eq(deletedTasks.id, deletedTaskId));
      if (!deletedTask) return null;

      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, deletedTask.projectId));
      if (!project) {
        throw new Error("Project not found");
      }

      let bucketId = deletedTask.bucketId;
      if (bucketId) {
        const [bucket] = await tx
          .select()
          .from(buckets)
          .where(eq(buckets.id, bucketId));
        if (!bucket) {
          bucketId = null;
        }
      }

      const [task] = await tx
        .insert(tasks)
        .values({
          id: deletedTask.originalTaskId,
          title: deletedTask.title,
          description: deletedTask.description,
          status: deletedTask.status,
          priority: deletedTask.priority,
          projectId: deletedTask.projectId,
          bucketId,
          assigneeId: deletedTask.assigneeId,
          assignedUsers: deletedTask.assignedUsers ?? [],
          estimateHours: deletedTask.estimateHours ?? 0,
          estimateMinutes: deletedTask.estimateMinutes ?? 0,
          history: deletedTask.history ?? [],
          checklist: deletedTask.checklist ?? [],
          attachments: deletedTask.attachments ?? [],
          startDate: deletedTask.startDate,
          dueDate: deletedTask.dueDate,
          position: deletedTask.position,
          createdAt: deletedTask.createdAt ?? new Date(),
        })
        .returning();

      await tx.delete(deletedTasks).where(eq(deletedTasks.id, deletedTaskId));

      return { task };
    });
  }

  async purgeDeletedRecords(
    olderThanDays: number,
  ): Promise<{ deletedProjects: number; deletedTasks: number }> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const removedTasks = await db
      .delete(deletedTasks)
      .where(lt(deletedTasks.deletedAt, cutoff))
      .returning({ id: deletedTasks.id });

    const removedProjects = await db
      .delete(deletedProjects)
      .where(lt(deletedProjects.deletedAt, cutoff))
      .returning({ id: deletedProjects.id });

    return {
      deletedProjects: removedProjects.length,
      deletedTasks: removedTasks.length,
    };
  }

  // Notifications
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }

  async getNotifications(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  // Activity Logs
  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLogs).values(insertLog).returning();
    return log;
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
  }
}

export const storage = new DatabaseStorage();

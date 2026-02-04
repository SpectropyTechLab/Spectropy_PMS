import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcrypt";
import {
  sendEmail,
  createTaskAssignmentEmail,
  createTaskCompletionEmail,
  createTaskUpdateEmail,
} from "./emailService";
import { SupabaseStorageService } from "./services/supabaseStorage";

import { checklistItemSchema, attachmentSchema, PERMISSIONS, type Permission } from "@shared/schema";
import {
  createPermissionMiddleware,
  requireAdmin,
  hasPermission,
  getUserWithPermissions
} from "./permissions";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const storageService = new SupabaseStorageService();

const otpMap = new Map<
  string,
  { code: string; expires: number; verified: boolean }
>();
const SALT_ROUNDS = 10;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getCurrentUserId(req: import("express").Request): number {

  const userIdHeader = req.headers["x-user-id"];


  if (userIdHeader) {
    const id = Number(userIdHeader);
    return Number.isNaN(id) ? 2 : id;
  }

  return 2;
}

function createHistoryEntry(
  action: string,
  user?: { id: number; name: string } | null,
) {
  return {
    action,
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    timestamp: new Date().toISOString(),
  };
}

async function getProjectAndBucketNames(
  projectId?: number | null,
  bucketId?: number | null,
) {
  const project = projectId ? await storage.getProject(projectId) : null;
  const bucket = bucketId ? await storage.getBucket(bucketId) : null;
  return {
    projectId: project?.id ?? projectId ?? null,
    projectName: project?.name ?? null,
    bucketId: bucket?.id ?? bucketId ?? null,
    bucketName: bucket?.title ?? null,
  };
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
//iintial dummy data for database  
async function seedDatabase() {
  const users = await storage.getUsers();
  if (users.length === 0) {
    const adminHash = await hashPassword("admin123");
    const userHash = await hashPassword("user123");

    const user = await storage.createUser({
      username: "admin",
      email: "admin@spectropy.com",
      password: adminHash,
      name: "Admin User",
      title: "Project Manager",
      avatar: "https://github.com/shadcn.png",
      role: "Admin",
      permissions: [],
      otpVerified: true,
    });

    await storage.createUser({
      username: "user",
      email: "user@spectropy.com",
      password: userHash,
      name: "Standard User",
      title: "Developer",
      role: "User",
      permissions: [],
      otpVerified: true,
    });

    const project = await storage.createProject({
      name: "Website Redesign",
      description: "Redesigning the corporate website for better UX.",
      status: "active",
      startDate: new Date(),
      ownerId: user.id,
    });

    const bucket1 = await storage.createBucket({
      title: "To Do",
      projectId: project.id,
      position: 0,
    });

    const bucket2 = await storage.createBucket({
      title: "In Progress",
      projectId: project.id,
      position: 1,
    });

    const bucket3 = await storage.createBucket({
      title: "Done",
      projectId: project.id,
      position: 2,
    });

    await storage.createTask({
      title: "Design Mockups",
      description: "Create initial high-fidelity mockups in Figma",
      status: "in_progress",
      priority: "high",
      projectId: project.id,
      bucketId: bucket2.id,
      assigneeId: user.id,
      assignedUsers: [user.id],
      dueDate: new Date(Date.now() + 86400000 * 3),
      position: 0,
      history: [{
        action: "Created",
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString(),
      }],
      checklist: [],
      attachments: [],
    });

    await storage.createTask({
      title: "Setup CI/CD",
      description: "Configure GitHub Actions pipeline",
      status: "todo",
      priority: "medium",
      projectId: project.id,
      bucketId: bucket1.id,
      assignedUsers: [],
      position: 0,
      history: [{
        action: "Created",
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString(),
      }],
      checklist: [],
      attachments: [],
    });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Projects
  app.get(api.projects.list.path, async (req, res) => {
    const allProjects = await storage.getProjects();
    const projects = allProjects.filter(p => p.status !== "deleted");
    res.json(projects);
  });

  app.get(api.projects.get.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || (currentUser.role !== "Admin" && !hasPermission(currentUser, "CREATE_PROJECT"))) {
        return res.status(403).json({ error: "Permission denied", message: "You do not have permission to create projects" });
      }

      const input = api.projects.create.input.parse(req.body);
      const userId = getCurrentUserId(req);

      const project = await storage.createProject({
        ...input,
        ownerId: userId,
        lastModifiedBy: userId,
        startDate: new Date(),
      });

      try {
        await storage.createActivityLog({
          entityType: "project",
          entityId: project.id,
          entityName: project.name,
          action: "created",
          performedBy: currentUser.id,
          performedByName: currentUser.name,
          payload: { projectId: project.id, name: project.name },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for project creation:", logErr);
      }

      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.projects.update.path, async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || (currentUser.role !== "Admin" && !hasPermission(currentUser, "UPDATE_PROJECT"))) {
        return res.status(403).json({ error: "Permission denied", message: "You do not have permission to update projects" });
      }

      const input = api.projects.update.input.parse(req.body);
      const userId = getCurrentUserId(req);
      const projectId = Number(req.params.id);

      const oldProject = await storage.getProject(projectId);
      const project = await storage.updateProject(projectId, {
        ...input,
        lastModifiedBy: userId,
      });

      try {
        await storage.createActivityLog({
          entityType: "project",
          entityId: project.id,
          entityName: project.name,
          action: "updated",
          performedBy: currentUser.id,
          performedByName: currentUser.name,
          payload: { before: oldProject, after: project, changes: input },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for project update:", logErr);
      }

      res.json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Project not found" });
    }
  });

  app.delete(api.projects.delete.path, async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || (currentUser.role !== "Admin" && !hasPermission(currentUser, "DELETE_PROJECT"))) {
        return res.status(403).json({ error: "Permission denied", message: "You do not have permission to delete projects" });
      }

      const projectId = Number(req.params.id);
      const archived = await storage.archiveProject(projectId, currentUser.id);
      if (!archived) {
        return res.status(404).json({ message: "Project not found" });
      }

      try {
        await storage.createActivityLog({
          entityType: "project",
          entityId: archived.project.id,
          entityName: archived.project.name,
          action: "deleted",
          performedBy: currentUser.id,
          performedByName: currentUser.name,
          payload: {
            deletedProjectId: archived.deletedProjectId,
            projectId: archived.project.id,
          },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for project deletion:", logErr);
      }

      if (archived.deletedTasks.length > 0) {
        const bucketTitleMap = new Map(
          archived.buckets.map((bucket) => [bucket.id, bucket.title]),
        );
        for (const deletedTask of archived.deletedTasks) {
          try {
            await storage.createActivityLog({
              entityType: "task",
              entityId: deletedTask.originalTaskId,
              entityName: deletedTask.title,
              action: "deleted",
              performedBy: currentUser.id,
              performedByName: currentUser.name,
              payload: {
                deletedTaskId: deletedTask.id,
                projectId: deletedTask.projectId,
                projectName: archived.project.name,
                bucketId: deletedTask.bucketId,
                bucketName: deletedTask.bucketId
                  ? bucketTitleMap.get(deletedTask.bucketId) ?? null
                  : null,
              },
            });
          } catch (logErr) {
            console.error("Failed to create activity log for task deletion:", logErr);
          }
        }
      }

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.post(api.projects.clone.path, async (req, res) => {
    try {
      const input = api.projects.clone.input.parse(req.body);
      const userId = getCurrentUserId(req);
      const project = await storage.cloneProject(
        Number(req.params.id),
        input.name,
        userId,
      );
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === "Project not found") {
        return res.status(404).json({ message: "Project not found" });
      }
      throw err;
    }
  });

  // Tasks
  app.get(api.tasks.list.path, async (req, res) => {
    const projectId = req.query.projectId
      ? Number(req.query.projectId)
      : undefined;
    const assigneeId = req.query.assigneeId
      ? Number(req.query.assigneeId)
      : undefined;
    let tasks = await storage.getTasks(projectId);
    if (assigneeId) {
      tasks = tasks.filter((task) => task.assigneeId === assigneeId);
    }
    res.json(tasks);
  });

  app.post(api.tasks.create.path, async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || (currentUser.role !== "Admin" && !hasPermission(currentUser, "CREATE_TASK"))) {
        return res.status(403).json({ error: "Permission denied", message: "You do not have permission to create tasks" });
      }

      const input = api.tasks.create.input.parse(req.body);
      const task = await storage.createTask(input);

      try {
        const logContext = await getProjectAndBucketNames(
          task.projectId,
          task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "created",
          performedBy: currentUser?.id ?? null,
          performedByName: currentUser?.name ?? null,
          payload: { taskId: task.id, ...logContext },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for task creation:", logErr);
      }

      if (task.assigneeId) {
        const assignee = await storage.getUser(task.assigneeId);
        const project = await storage.getProject(task.projectId);
        const currentUser = await storage.getUser(getCurrentUserId(req));

        if (assignee && project) {
          let sent = false;
          if (assignee.email) {
            const { subject, html } = createTaskAssignmentEmail({
              taskTitle: task.title,
              taskDescription: task.description || undefined,
              projectName: project.name,
              assignedBy: currentUser?.name || "System",
              dueDate: task.dueDate,
            });

            sent = await sendEmail({ to: assignee.email, subject, html });
          }

          await storage.createNotification({
            taskId: task.id,
            userId: assignee.id,
            type: "assignment",
            status: sent ? "sent" : "in_app",
          });
        }
      }

      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.tasks.update.path, async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      const existingTask = await storage.getTask(Number(req.params.id));
      const input = api.tasks.update.input.parse(req.body);

      const isCompletion = input.status === "completed" && existingTask?.status !== "completed";
      const isUncompletion = input.status !== "completed" && existingTask?.status === "completed";

      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }

      if (isCompletion || isUncompletion) {
        const isAssignedToTask = existingTask && (
          existingTask.assigneeId === currentUser.id ||
          (existingTask.assignedUsers && existingTask.assignedUsers.includes(currentUser.id))
        );

        if (currentUser.role !== "Admin" && !hasPermission(currentUser, "COMPLETE_TASK") && !isAssignedToTask) {
          return res.status(403).json({ error: "Permission denied", message: "You do not have permission to mark tasks as complete/incomplete" });
        }
      } else if (Object.keys(input).length > 0) {
        if (currentUser.role !== "Admin" && !hasPermission(currentUser, "UPDATE_TASK")) {
          return res.status(403).json({ error: "Permission denied", message: "You do not have permission to update tasks" });
        }
      }

      const task = await storage.updateTask(Number(req.params.id), input);
      const project = await storage.getProject(task.projectId);

      if (project) {
        const isNewAssignment =
          input.assigneeId && input.assigneeId !== existingTask?.assigneeId;

        if (isCompletion && project.ownerId) {
          const projectOwner = await storage.getUser(project.ownerId);
          const assignee = task.assigneeId
            ? await storage.getUser(task.assigneeId)
            : null;

          if (projectOwner) {
            let sent = false;
            if (projectOwner.email) {
              const { subject, html } = createTaskCompletionEmail({
                taskTitle: task.title,
                projectName: project.name,
                assigneeName: assignee?.name || "Unknown",
              });

              sent = await sendEmail({
                to: projectOwner.email,
                subject,
                html,
              });
            }

            await storage.createNotification({
              taskId: task.id,
              userId: projectOwner.id,
              type: "completion",
              status: sent ? "sent" : "in_app",
            });
          }
        } else if (isNewAssignment && task.assigneeId) {
          const assignee = await storage.getUser(task.assigneeId);

          if (assignee) {
            let sent = false;
            if (assignee.email) {
              const { subject, html } = createTaskAssignmentEmail({
                taskTitle: task.title,
                taskDescription: task.description || undefined,
                projectName: project.name,
                assignedBy: currentUser?.name || "System",
                dueDate: task.dueDate,
              });

              sent = await sendEmail({ to: assignee.email, subject, html });
            }

            await storage.createNotification({
              taskId: task.id,
              userId: assignee.id,
              type: "assignment",
              status: sent ? "sent" : "in_app",
            });
          }
        } else if (Object.keys(input).length > 0) {
          const recipientIds = new Set<number>();
          if (task.assigneeId) recipientIds.add(task.assigneeId);
          if (project.ownerId) recipientIds.add(project.ownerId);

          for (const userId of Array.from(recipientIds)) {
            const user = await storage.getUser(userId);
            if (!user) continue;
            let sent = false;
            if (user.email) {
              const modificationType = Object.keys(input).join(", ");
              const { subject, html } = createTaskUpdateEmail({
                taskTitle: task.title,
                projectName: project.name,
                modifiedBy: currentUser?.name || "System",
                modificationType,
                status: task.status,
              });

              sent = await sendEmail({ to: user.email, subject, html });
            }

            await storage.createNotification({
              taskId: task.id,
              userId: user.id,
              type: "update",
              status: sent ? "sent" : "in_app",
            });
          }
        }
      }

      if (isCompletion && task.bucketId) {
        try {
          const buckets = await storage.getBuckets(task.projectId);
          const currentBucketIndex = buckets.findIndex(
            (bucket) => bucket.id === task.bucketId,
          );
          const nextBucket =
            currentBucketIndex >= 0 ? buckets[currentBucketIndex + 1] : undefined;

          if (nextBucket) {
            const nextBucketTasks = await storage.getTasksByBucket(nextBucket.id);
            const maxPosition = nextBucketTasks.reduce(
              (max, current) => Math.max(max, current.position),
              -1,
            );

            await storage.createTask({
              title: task.title,
              description: task.description ?? undefined,
              status: "todo",
              priority: task.priority,
              projectId: task.projectId,
              bucketId: nextBucket.id,
              assigneeId: null,
              assignedUsers: [],
              startDate: null,
              dueDate: null,
              estimateHours: 0,
              estimateMinutes: 0,
              position: maxPosition + 1,
              checklist: [],
              attachments: task.attachments || [],
              history: [
                createHistoryEntry(
                  `Auto-created from completed task in ${buckets[currentBucketIndex]?.title || "previous bucket"}`,
                  currentUser,
                ),
              ],
            });
          }
        } catch (err) {
          console.error("Failed to auto-create next task:", err);
        }
      }

      try {
        const logContext = await getProjectAndBucketNames(
          task.projectId,
          task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          action: "updated",
          performedBy: currentUser?.id ?? null,
          performedByName: currentUser?.name ?? null,
          payload: { taskId: task.id, changes: input, ...logContext },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for task update:", logErr);
      }

      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Task not found" });
    }
  });

  app.delete(api.tasks.delete.path, async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || (currentUser.role !== "Admin" && !hasPermission(currentUser, "DELETE_TASK"))) {
        return res.status(403).json({ error: "Permission denied", message: "You do not have permission to delete tasks" });
      }

      const archived = await storage.archiveTask(Number(req.params.id), currentUser.id);
      if (!archived) {
        return res.status(404).json({ message: "Task not found" });
      }

      try {
        const logContext = await getProjectAndBucketNames(
          archived.task.projectId,
          archived.task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: archived.task.id,
          entityName: archived.task.title,
          action: "deleted",
          performedBy: currentUser.id,
          performedByName: currentUser.name,
          payload: {
            deletedTaskId: archived.deletedTaskId,
            ...logContext,
          },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for task deletion:", logErr);
      }

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  app.post("/api/deleted/projects/:id/restore", async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || (currentUser.role !== "Admin" && !hasPermission(currentUser, "DELETE_PROJECT"))) {
        return res.status(403).json({ error: "Permission denied", message: "You do not have permission to restore projects" });
      }

      const deletedProjectId = Number(req.params.id);
      try {
        const restored = await storage.restoreDeletedProject(deletedProjectId, currentUser.id);
        if (!restored) {
          return res.status(404).json({ message: "Deleted project not found" });
        }

        try {
          await storage.createActivityLog({
            entityType: "project",
            entityId: restored.project.id,
            entityName: restored.project.name,
            action: "restored",
            performedBy: currentUser.id,
            performedByName: currentUser.name,
            payload: {
              projectId: restored.project.id,
            },
          });
        } catch (logErr) {
          console.error("Failed to create activity log for project restore:", logErr);
        }

        if (restored.tasks.length > 0) {
          const bucketTitleMap = new Map(
            restored.buckets.map((bucket) => [bucket.id, bucket.title]),
          );
          for (const task of restored.tasks) {
            try {
              await storage.createActivityLog({
                entityType: "task",
                entityId: task.id,
                entityName: task.title,
                action: "restored",
                performedBy: currentUser.id,
                performedByName: currentUser.name,
                payload: {
                  taskId: task.id,
                  projectId: task.projectId,
                  projectName: restored.project.name,
                  bucketId: task.bucketId,
                  bucketName: task.bucketId
                    ? bucketTitleMap.get(task.bucketId) ?? null
                    : null,
                },
              });
            } catch (logErr) {
              console.error("Failed to create activity log for task restore:", logErr);
            }
          }
        }

        res.json(restored.project);
      } catch (err) {
        if (err instanceof Error && err.message === "Project already exists") {
          return res.status(409).json({ message: "Project already exists" });
        }
        throw err;
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to restore project" });
    }
  });

  app.post("/api/deleted/tasks/:id/restore", async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || (currentUser.role !== "Admin" && !hasPermission(currentUser, "DELETE_TASK"))) {
        return res.status(403).json({ error: "Permission denied", message: "You do not have permission to restore tasks" });
      }

      const deletedTaskId = Number(req.params.id);
      try {
        const restored = await storage.restoreDeletedTask(deletedTaskId, currentUser.id);
        if (!restored) {
          return res.status(404).json({ message: "Deleted task not found" });
        }

        try {
          const logContext = await getProjectAndBucketNames(
            restored.task.projectId,
            restored.task.bucketId,
          );
          await storage.createActivityLog({
            entityType: "task",
            entityId: restored.task.id,
            entityName: restored.task.title,
            action: "restored",
            performedBy: currentUser.id,
            performedByName: currentUser.name,
            payload: { taskId: restored.task.id, ...logContext },
          });
        } catch (logErr) {
          console.error("Failed to create activity log for task restore:", logErr);
        }

        res.json(restored.task);
      } catch (err) {
        if (err instanceof Error && err.message === "Project not found") {
          return res.status(409).json({ message: "Project not found. Restore the project first." });
        }
        throw err;
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to restore task" });
    }
  });

  // Users
  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.get(api.notifications.list.path, async (req, res) => {
    const userId = getCurrentUserId(req);
    const notifications = await storage.getNotifications(userId);
    res.json(notifications);
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        title: z.string().optional(),
        avatar: z.string().url().or(z.string().length(0)).optional(),
      });
      const input = updateSchema.parse(req.body);
      const user = await storage.updateUser(Number(req.params.id), input);
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "User not found" });
    }
  });

  app.patch("/api/users/:id/permissions", async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || currentUser.role !== "Admin") {
        return res.status(403).json({ error: "Permission denied", message: "Only admins can manage user permissions" });
      }

      const permissionSchema = z.object({
        permissions: z.array(z.enum(PERMISSIONS)),
      });
      const input = permissionSchema.parse(req.body);
      const user = await storage.updateUser(Number(req.params.id), { permissions: input.permissions });
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "User not found" });
    }
  });

  app.patch("/api/users/:id/role", async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || currentUser.role !== "Admin") {
        return res.status(403).json({ error: "Permission denied", message: "Only admins can change user roles" });
      }

      const roleSchema = z.object({
        role: z.enum(["Admin", "User"]),
      });
      const input = roleSchema.parse(req.body);
      const user = await storage.updateUser(Number(req.params.id), { role: input.role });
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "User not found" });
    }
  });

  app.get("/api/permissions", async (req, res) => {
    res.json(PERMISSIONS);
  });

  app.get("/api/users/:id/permissions", async (req, res) => {
    try {
      const userWithPermissions = await getUserWithPermissions(Number(req.params.id));
      if (!userWithPermissions) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        permissions: userWithPermissions.permissions,
        canCreateTask: userWithPermissions.canCreateTask,
        canUpdateTask: userWithPermissions.canUpdateTask,
        canCompleteTask: userWithPermissions.canCompleteTask,
        canDeleteTask: userWithPermissions.canDeleteTask,
        canCreateProject: userWithPermissions.canCreateProject,
        canUpdateProject: userWithPermissions.canUpdateProject,
        canDeleteProject: userWithPermissions.canDeleteProject,
        canManageUsers: userWithPermissions.canManageUsers,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to get permissions" });
    }
  });

  app.get("/api/users/current", async (req, res) => {
    const user = await storage.getUser(getCurrentUserId(req));
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, otp, newPassword } = z.object({
        email: z.string().email(),
        otp: z.string().length(6),
        newPassword: z.string().min(6),
      }).parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stored = otpMap.get(email);
      if (!stored || stored.code !== otp || Date.now() > stored.expires) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      otpMap.delete(email);
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Buckets
  app.get(api.buckets.list.path, async (req, res) => {
    const projectId = req.query.projectId
      ? Number(req.query.projectId)
      : undefined;
    if (projectId) {
      const buckets = await storage.getBuckets(projectId);
      res.json(buckets);
    } else {
      const allBuckets = await storage.getAllBuckets();
      res.json(allBuckets);
    }
  });

  app.post(api.buckets.create.path, async (req, res) => {
    try {
      const input = api.buckets.create.input.parse(req.body);
      const bucket = await storage.createBucket(input);
      res.status(201).json(bucket);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.buckets.update.path, async (req, res) => {
    try {
      const input = api.buckets.update.input.parse(req.body);
      const bucket = await storage.updateBucket(Number(req.params.id), input);
      res.json(bucket);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Bucket not found" });
    }
  });

  app.delete(api.buckets.delete.path, async (req, res) => {
    await storage.deleteBucket(Number(req.params.id));
    res.status(204).send();
  });

  // Auth - OTP
  app.post(api.auth.sendOtp.path, async (req, res) => {
    try {
      const { email } = api.auth.sendOtp.input.parse(req.body);
      const otp = generateOTP();
      otpMap.set(email, {
        code: otp,
        expires: Date.now() + 5 * 60 * 1000,
        verified: false,
      });

      // --- NEW CODE START ---
      const emailSubject = "Your Verification Code - SPECTROPY";
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verification Request</h2>
          <p>Please use the following code to verify your identity:</p>
          <div style="background-color: #f4f4f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #4F46E5; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 5 minutes.</p>
        </div>
      `;

      const sent = await sendEmail({
        to: email,
        subject: emailSubject,
        html: emailHtml,
      });

      if (!sent) {
        throw new Error("Failed to send email via transport service");
      }
      console.log(`OTP for ${email}: ${otp}`);
      res.json({ message: "OTP sent successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.auth.verifyOtp.path, async (req, res) => {
    try {
      const { email, otp } = api.auth.verifyOtp.input.parse(req.body);
      const stored = otpMap.get(email);

      if (!stored) {
        return res.status(400).json({ message: "No OTP found for this email" });
      }
      if (Date.now() > stored.expires) {
        otpMap.delete(email);
        return res.status(400).json({ message: "OTP expired" });
      }
      if (stored.code !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      stored.verified = true;
      res.json({ verified: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const { email, password, name, role } = api.auth.register.input.parse(
        req.body,
      );

      const stored = otpMap.get(email);
      if (!stored || !stored.verified) {
        return res.status(400).json({ message: "Please verify OTP first" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username: email.split("@")[0],
        email,
        password: hashedPassword,
        name,
        role: role || "User",
        permissions: [],
        otpVerified: true,
      });

      otpMap.delete(email);
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { email, password } = api.auth.login.input.parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Reports API
  app.get("/api/reports/summary", async (req, res) => {
    const projects = await storage.getProjects();
    const tasks = await storage.getTasks();
    const users = await storage.getUsers();
    const activeUsers = users.filter((u) => u.otpVerified);

    res.json({
      totalProjects: projects.length,
      totalTasks: tasks.length,
      activeUsers: activeUsers.length,
    });
  });

  app.get("/api/reports/project-progress", async (req, res) => {
    const projects = await storage.getProjects();
    const tasks = await storage.getTasks();

    const projectProgress = projects.map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const completed = projectTasks.filter(
        (t) => t.status === "completed",
      ).length;
      return {
        name: project.name,
        completed,
        total: projectTasks.length,
        percentage:
          projectTasks.length > 0
            ? Math.round((completed / projectTasks.length) * 100)
            : 0,
      };
    });

    res.json(projectProgress);
  });

  app.get("/api/reports/user-performance", async (req, res) => {
    const users = await storage.getUsers();
    const tasks = await storage.getTasks();

    const userPerformance = users
      .map((user) => {
        const userTasks = tasks.filter((t) => t.assigneeId === user.id);
        const completed = userTasks.filter(
          (t) => t.status === "completed",
        ).length;
        const totalEstimate = userTasks.reduce(
          (acc, t) =>
            acc + (t.estimateHours || 0) + (t.estimateMinutes || 0) / 60,
          0,
        );
        const avgTime =
          userTasks.length > 0 ? totalEstimate / userTasks.length : 0;
        return {
          user: user.name,
          userId: user.id,
          completed,
          total: userTasks.length,
          avgTime: Math.round(avgTime * 10) / 10,
        };
      })
      .filter((u) => u.total > 0);

    res.json(userPerformance);
  });

  app.get("/api/reports/bucket-stats", async (req, res) => {
    const tasks = await storage.getTasks();
    const projects = await storage.getProjects();

    const bucketStats: { bucket: string; count: number }[] = [];

    for (const project of projects) {
      const buckets = await storage.getBuckets(project.id);
      for (const bucket of buckets) {
        const existingBucket = bucketStats.find(
          (b) => b.bucket === bucket.title,
        );
        const bucketTaskCount = tasks.filter(
          (t) => t.bucketId === bucket.id,
        ).length;
        if (existingBucket) {
          existingBucket.count += bucketTaskCount;
        } else {
          bucketStats.push({ bucket: bucket.title, count: bucketTaskCount });
        }
      }
    }

    res.json(bucketStats);
  });

  app.get("/api/reports/status-breakdown", async (req, res) => {
    const tasks = await storage.getTasks();

    const statusMap: Record<string, number> = {};
    tasks.forEach((task) => {
      const status = task.status || "unknown";
      statusMap[status] = (statusMap[status] || 0) + 1;
    });

    const statusBreakdown = Object.entries(statusMap).map(
      ([status, count]) => ({
        status:
          status.charAt(0).toUpperCase() + status.slice(1).replace("_", " "),
        count,
      }),
    );

    res.json(statusBreakdown);
  });

  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType, folder } = req.body;

      if (!name || !contentType) {
        return res.status(400).json({ error: "Missing file metadata" });
      }

      const userId = getCurrentUserId(req);

      const result = await storageService.getSignedUploadUrl({
        userId,
        fileName: name,
        contentType,
        folder,
      });
      const { data: publicData } = supabase.storage
        .from(storageService.bucket)
        .getPublicUrl(result.objectPath);

      res.json({
        uploadURL: result.uploadURL,
        objectPath: result.objectPath,
        publicUrl: publicData?.publicUrl,
        metadata: {
          name,
          size,
          contentType,
        },
      });
    } catch (err) {
      console.error("Supabase upload error:", err);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });


  app.get("/api/uploads/download", async (req, res) => {
    try {
      const objectPath = req.query.path as string;

      if (!objectPath) {
        return res.status(400).json({ error: "Missing file path" });
      }

      // Optional: permission check here
      // const userId = getCurrentUserId(req);

      const { data, error } = await supabase.storage
        .from("uploads")
        .createSignedUrl(objectPath, 60); // 60 seconds

      if (error || !data) {
        return res.status(500).json({ error: "Failed to generate download URL" });
      }

      res.json({ downloadURL: data.signedUrl });
    } catch (err) {
      console.error("Download URL error:", err);
      res.status(500).json({ error: "Download failed" });
    }
  });


  // Task checklist endpoints
  app.post("/api/tasks/:id/checklist", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const currentUser = await storage.getUser(getCurrentUserId(req));
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const input = checklistItemSchema.parse(req.body);
      const checklist = [...(task.checklist || []), input];
      const history = [...(task.history || []), `Checklist item added: "${input.title}" on ${new Date().toLocaleDateString()}`];

      const updatedTask = await storage.updateTask(taskId, { checklist, history });
      try {
        const logContext = await getProjectAndBucketNames(
          task.projectId,
          task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: taskId,
          entityName: task.title,
          action: "updated",
          performedBy: currentUser?.id ?? null,
          performedByName: currentUser?.name ?? null,
          payload: {
            taskId,
            type: "checklist_added",
            itemId: input.id,
            ...logContext,
          },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for checklist add:", logErr);
      }
      res.json(updatedTask);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/tasks/:id/checklist/:itemId", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const itemId = req.params.itemId;
      const currentUser = await storage.getUser(getCurrentUserId(req));
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const { completed, title } = req.body;
      const checklist = (task.checklist || []).map(item =>
        item.id === itemId ? { ...item, ...(completed !== undefined ? { completed } : {}), ...(title !== undefined ? { title } : {}) } : item
      );

      const historyEntry = completed !== undefined
        ? `Checklist item "${title || 'item'}" marked as ${completed ? 'completed' : 'incomplete'} on ${new Date().toLocaleDateString()}`
        : `Checklist item updated on ${new Date().toLocaleDateString()}`;
      const history = [...(task.history || []), historyEntry];

      const updatedTask = await storage.updateTask(taskId, { checklist, history });
      try {
        const logContext = await getProjectAndBucketNames(
          task.projectId,
          task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: taskId,
          entityName: task.title,
          action: "updated",
          performedBy: currentUser?.id ?? null,
          performedByName: currentUser?.name ?? null,
          payload: {
            taskId,
            type: "checklist_updated",
            itemId,
            ...logContext,
          },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for checklist update:", logErr);
      }
      res.json(updatedTask);
    } catch (err) {
      res.status(500).json({ message: "Failed to update checklist item" });
    }
  });

  app.delete("/api/tasks/:id/checklist/:itemId", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const itemId = req.params.itemId;
      const currentUser = await storage.getUser(getCurrentUserId(req));
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const removedItem = (task.checklist || []).find(item => item.id === itemId);
      const checklist = (task.checklist || []).filter(item => item.id !== itemId);
      const history = [...(task.history || []), `Checklist item removed: "${removedItem?.title || 'item'}" on ${new Date().toLocaleDateString()}`];

      const updatedTask = await storage.updateTask(taskId, { checklist, history });
      try {
        const logContext = await getProjectAndBucketNames(
          task.projectId,
          task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: taskId,
          entityName: task.title,
          action: "updated",
          performedBy: currentUser?.id ?? null,
          performedByName: currentUser?.name ?? null,
          payload: {
            taskId,
            type: "checklist_removed",
            itemId,
            ...logContext,
          },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for checklist delete:", logErr);
      }
      res.json(updatedTask);
    } catch (err) {
      res.status(500).json({ message: "Failed to delete checklist item" });
    }
  });

  // Task attachments endpoints
  app.post("/api/tasks/:id/attachments", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const currentUser = await storage.getUser(getCurrentUserId(req));
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const input = attachmentSchema.parse(req.body);

      // Validate file size (10MB limit)
      if (input.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "File size exceeds 10MB limit" });
      }

      const attachments = [...(task.attachments || []), input];
      const history = [...(task.history || []), `Attachment added: "${input.name}" on ${new Date().toLocaleDateString()}`];

      const updatedTask = await storage.updateTask(taskId, { attachments, history });
      try {
        const logContext = await getProjectAndBucketNames(
          task.projectId,
          task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: taskId,
          entityName: task.title,
          action: "updated",
          performedBy: currentUser?.id ?? null,
          performedByName: currentUser?.name ?? null,
          payload: {
            taskId,
            type: "attachment_added",
            attachmentId: input.id,
            ...logContext,
          },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for attachment add:", logErr);
      }
      res.json(updatedTask);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/tasks/:id/attachments/:attachmentId", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const attachmentId = req.params.attachmentId;
      const currentUser = await storage.getUser(getCurrentUserId(req));
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const removedAttachment = (task.attachments || []).find(att => att.id === attachmentId);
      const attachments = (task.attachments || []).filter(att => att.id !== attachmentId);
      const history = [...(task.history || []), `Attachment removed: "${removedAttachment?.name || 'file'}" on ${new Date().toLocaleDateString()}`];

      const updatedTask = await storage.updateTask(taskId, { attachments, history });
      try {
        const logContext = await getProjectAndBucketNames(
          task.projectId,
          task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: taskId,
          entityName: task.title,
          action: "updated",
          performedBy: currentUser?.id ?? null,
          performedByName: currentUser?.name ?? null,
          payload: {
            taskId,
            type: "attachment_removed",
            attachmentId,
            ...logContext,
          },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for attachment delete:", logErr);
      }
      res.json(updatedTask);
    } catch (err) {
      res.status(500).json({ message: "Failed to delete attachment" });
    }
  });

  // Auto-progress task to next bucket on completion
  app.post("/api/tasks/:id/complete-and-progress", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const currentUser = await storage.getUser(getCurrentUserId(req));
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      // Mark current task as completed
      const history = [...(task.history || []), `Marked as completed on ${new Date().toLocaleDateString()}`];
      await storage.updateTask(taskId, { status: "completed", history });
      try {
        const logContext = await getProjectAndBucketNames(
          task.projectId,
          task.bucketId,
        );
        await storage.createActivityLog({
          entityType: "task",
          entityId: taskId,
          entityName: task.title,
          action: "updated",
          performedBy: currentUser?.id ?? null,
          performedByName: currentUser?.name ?? null,
          payload: { taskId, type: "completed", ...logContext },
        });
      } catch (logErr) {
        console.error("Failed to create activity log for task completion:", logErr);
      }

      // Find next bucket
      if (task.bucketId) {
        const buckets = await storage.getBuckets(task.projectId);
        const currentBucketIndex = buckets.findIndex(b => b.id === task.bucketId);

        if (currentBucketIndex >= 0 && currentBucketIndex < buckets.length - 1) {
          const nextBucket = buckets[currentBucketIndex + 1];

          // Create new task in next bucket with empty dates
          const newTask = await storage.createTask({
            title: task.title,
            description: task.description,
            status: "todo",
            priority: task.priority,
            projectId: task.projectId,
            bucketId: nextBucket.id,
            assigneeId: task.assigneeId,
            assignedUsers: task.assignedUsers || [],
            estimateHours: 0,
            estimateMinutes: 0,
            position: 0,
            history: [`Created from completed task on ${new Date().toLocaleDateString()}`],
            checklist: [],
            attachments: [],
          });

          return res.json({ completedTask: task, newTask });
        }
      }

      res.json({ completedTask: task, newTask: null });
    } catch (err) {
      res.status(500).json({ message: "Failed to progress task" });
    }
  });

  // Activity Logs
  app.get("/api/logs", async (req, res) => {
    try {
      const currentUser = await storage.getUser(getCurrentUserId(req));
      if (!currentUser || currentUser.role !== "Admin") {
        return res.status(403).json({ error: "Permission denied", message: "Only admins can view activity logs" });
      }

      const logs = await storage.getActivityLogs();
      res.json(logs);
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Seed data
  seedDatabase();

  return httpServer;
}

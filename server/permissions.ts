import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { getCurrentUserId } from "./auth";
import { type Permission, PERMISSIONS } from "@shared/schema";

export function hasPermission(user: { role: string; permissions: Permission[] | null }, permission: Permission): boolean {
  if (user.role === "Admin") {
    return true;
  }
  const userPermissions = user.permissions || [];
  return userPermissions.includes(permission);
}

export function hasAnyPermission(user: { role: string; permissions: Permission[] | null }, permissions: Permission[]): boolean {
  if (user.role === "Admin") {
    return true;
  }
  const userPermissions = user.permissions || [];
  return permissions.some(p => userPermissions.includes(p));
}

export function createPermissionMiddleware(requiredPermission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let userId: number;
    try {
      userId = getCurrentUserId(req);
    } catch {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (hasPermission(user, requiredPermission)) {
        return next();
      }

      return res.status(403).json({
        error: "Permission denied",
        required: requiredPermission,
        message: `You do not have the required permission: ${requiredPermission}`
      });
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

export function createAnyPermissionMiddleware(requiredPermissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let userId: number;
    try {
      userId = getCurrentUserId(req);
    } catch {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (hasAnyPermission(user, requiredPermissions)) {
        return next();
      }

      return res.status(403).json({
        error: "Permission denied",
        required: requiredPermissions,
        message: `You do not have any of the required permissions: ${requiredPermissions.join(", ")}`
      });
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

export function requireAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    let userId: number;
    try {
      userId = getCurrentUserId(req);
    } catch {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.role === "Admin") {
        return next();
      }

      return res.status(403).json({
        error: "Admin access required",
        message: "This action requires administrator privileges"
      });
    } catch (error) {
      console.error("Admin check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

export async function getUserWithPermissions(userId: number) {
  const user = await storage.getUser(userId);
  if (!user) return null;

  return {
    ...user,
    permissions: user.permissions || [],
    canCreateTask: hasPermission(user, "CREATE_TASK"),
    canUpdateTask: hasPermission(user, "UPDATE_TASK"),
    canCompleteTask: hasPermission(user, "COMPLETE_TASK"),
    canDeleteTask: hasPermission(user, "DELETE_TASK"),
    canCreateProject: hasPermission(user, "CREATE_PROJECT"),
    canUpdateProject: hasPermission(user, "UPDATE_PROJECT"),
    canDeleteProject: hasPermission(user, "DELETE_PROJECT"),
    canManageUsers: hasPermission(user, "MANAGE_USERS"),
  };
}

export { PERMISSIONS };

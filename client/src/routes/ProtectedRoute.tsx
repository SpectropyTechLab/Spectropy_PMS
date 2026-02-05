import { useLocation } from "wouter";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: "Admin" | "User";
}

export const ProtectedRoute = ({ children, role }: ProtectedRouteProps) => {
  const [location, setLocation] = useLocation();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const storedRole = localStorage.getItem("userRole");

  useEffect(() => {
    if (!isAuthenticated || !storedRole) {
      setLocation("/auth");
    } else if (role && storedRole !== role) {
      setLocation("/auth");
    }
  }, [isAuthenticated, storedRole, role, setLocation]);

  useEffect(() => {
    if (!isAuthenticated || !storedRole) return;
    apiRequest("GET", "/api/users/current").catch(() => {
      // apiRequest will force logout on 401
    });
  }, [isAuthenticated, storedRole]);

  if (!isAuthenticated || !storedRole || (role && storedRole !== role)) {
    return null;
  }

  return <>{children}</>;
};

import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Settings,
  LogOut,
  BarChart3,
  User,
  Users,
  ChevronUp,
  Shield,
  Menu,
  X,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const [location] = useLocation();
  const userRole = localStorage.getItem("userRole");
  const userName = localStorage.getItem("userName") || "User";
  const userAvatar = localStorage.getItem("userAvatar");

  const adminNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/projects", icon: FolderKanban },
    { label: "Tasks", href: "/tasks", icon: CheckSquare },
    { label: "To Do", href: "/todo", icon: CheckSquare },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "User Management", href: "/users", icon: Shield },
    { label: "Activity Logs", href: "/logs", icon: ScrollText },
  ];

  const userNavItems = [
    { label: "Dashboard", href: "/user/dashboard", icon: LayoutDashboard },
    { label: "My Projects", href: "/user/projects", icon: FolderKanban },
    { label: "My Tasks", href: "/user/tasks", icon: CheckSquare },
    { label: "To Do", href: "/todo", icon: CheckSquare },
  ];

  const navItems = userRole === "Admin" ? adminNavItems : userNavItems;

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // Ignore errors and continue client-side logout.
    }
    localStorage.removeItem("userRole");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("userAvatar");
    window.location.href = "/auth";
  };

  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const sidebarContent = (
    <>
      <div className="p-4 md:p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden flex-shrink-0">
          <img
            src="/favicon.png"
            alt="Logo"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <h1 className="font-display font-bold text-xl tracking-tight text-slate-900 truncate">
            Spectropy
          </h1>
          <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">
            {userRole === "Admin" ? "Admin Panel" : "Workspace"}
          </span>
        </div>

        {isMobileOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden flex-shrink-0"
            onClick={onMobileClose}
            data-testid="button-close-sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 px-3 md:px-4 py-4 md:py-6 space-y-1 md:space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} onClick={handleNavClick}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-200 cursor-pointer group font-medium text-sm md:text-base",
                  isActive
                    ? "bg-primary/5 text-primary"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-colors flex-shrink-0",
                    isActive
                      ? "text-primary"
                      : "text-slate-400 group-hover:text-slate-900",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 md:p-4 mt-auto border-t border-slate-100 bg-slate-50/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={userAvatar || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 text-left min-w-0">
                <span className="text-sm font-medium text-slate-900 truncate">
                  {userName}
                </span>
                <span className="text-xs text-slate-400">{userRole}</span>
              </div>
              <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem asChild className="cursor-pointer" data-testid="menu-item-account">
              <Link href="/account" onClick={handleNavClick}>
                <User className="w-4 h-4 mr-2" />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer" data-testid="menu-item-settings">
              <Link href="/settings" onClick={handleNavClick}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-red-500 focus:text-red-500"
              onClick={handleLogout}
              data-testid="menu-item-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 h-screen bg-white border-r border-slate-200 flex-col fixed left-0 top-0 z-20 hidden md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onMobileClose}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-72 bg-white border-r border-slate-200 flex flex-col z-40 md:hidden transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        data-testid="button-hamburger-menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
          <img
            src="/favicon.png"
            alt="Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <span className="font-display font-bold text-lg text-slate-900">Spectropy</span>
      </div>

      <div className="w-9" />
    </header>
  );
}

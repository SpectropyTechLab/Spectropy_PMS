import { Sidebar, MobileHeader } from "./Sidebar";
import { useEffect, useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function Layout({ children, fullWidth = false }: LayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    document.title = "Spectropy PMS";
  }, []);

  const handleOpenMobileSidebar = () => {
    setIsMobileSidebarOpen(true);
  };

  const handleCloseMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen} 
        onMobileClose={handleCloseMobileSidebar} 
      />
      <MobileHeader onMenuClick={handleOpenMobileSidebar} />
      <main
        className={`flex-1 min-h-0 pt-14 md:pt-0 animate-in fade-in duration-500 ${
          fullWidth
            ? "overflow-hidden p-0 md:pl-72"
            : "overflow-y-auto p-4 md:p-6 md:pl-72"
        }`}
      >
        <div className={fullWidth ? "h-full w-full" : "max-w-7xl mx-auto"}>
          {children}
        </div>
      </main>
    </div>
  );
}

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated } = useAuth();
  // Always call the hook, let the hook itself handle the authentication check
  useIdleTimer();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile Navbar */}
      <div className="md:hidden">
        <Navbar />
      </div>
      
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar onCollapseChange={setIsSidebarCollapsed} />
      </div>

      {/* Main Content */}
      <main className={cn(
        "flex-grow transition-all duration-300",
        "md:ml-16", // Default margin for collapsed sidebar
        !isSidebarCollapsed && "md:ml-64" // Margin for expanded sidebar
      )}>
        {children}
      </main>
      
      {location.pathname === "/" && <Footer />}
    </div>
  );
}

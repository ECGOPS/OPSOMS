import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated } = useAuth();
  // Always call the hook, let the hook itself handle the authentication check
  useIdleTimer();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      {location.pathname === "/" && <Footer />}
    </div>
  );
}

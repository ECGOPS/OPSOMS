import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useIdleTimer } from "@/hooks/useIdleTimer";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated } = useAuth();
  
  // Only initialize the idle timer if user is authenticated
  if (isAuthenticated) {
    useIdleTimer();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation, NavLink } from "react-router-dom";
import { Menu, X, User, LogOut, Database, ChevronDown, BarChart3 } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { hasRequiredRole } from "@/utils/security";
import { UserRole } from "@/lib/types";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Check if the current path starts with a specific route
  const isActiveRoute = (route: string) => {
    return location.pathname.startsWith(route);
  };

  const showMenuItem = (requiredRole: UserRole) => {
    if (!user?.role) return false;
    if (user.role === "system_admin") return true;
    // For technicians, only show specific menu items
    if (user.role === "technician") {
      return requiredRole === "district_engineer" && !location.pathname.startsWith("/analytics");
    }
    // For district engineers, allow access to district population
    if (user.role === "district_engineer") {
      return requiredRole === "district_engineer" || requiredRole === "global_engineer";
    }
    return hasRequiredRole(user.role, requiredRole);
  };

  const NavLinks = () => (
    <>
      <NavLink
        to="/"
        className={({ isActive }: { isActive: boolean }) =>
          `${isActive ? "text-ecg-blue" : "text-gray-700"} hover:text-ecg-blue transition-colors`
        }
      >
        Home
      </NavLink>
      {isAuthenticated && (
        <>
          <NavLink to="/dashboard" className="text-foreground hover:text-primary transition-colors">
            Dashboard
          </NavLink>
          <NavLink to="/report-fault" className="text-foreground hover:text-primary transition-colors">
            Report Fault
          </NavLink>
          
          {/* Show Analytics only for non-technician roles */}
          {user?.role !== "technician" && showMenuItem("district_engineer") && (
            <NavLink
              to="/analytics"
              className={({ isActive }: { isActive: boolean }) =>
                `${isActive ? "text-ecg-blue" : "text-gray-700"} hover:text-ecg-blue transition-colors`
              }
            >
              Analytics
            </NavLink>
          )}
          
          {/* Asset Management Dropdown - Show for technicians and other roles */}
          {showMenuItem("district_engineer") && (
            <div className="hidden md:block">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className={cn(
                      "text-foreground hover:text-primary transition-colors",
                      isActiveRoute("/asset-management") && "bg-accent text-primary dark:bg-blue-700 dark:text-white"
                    )}>
                      Asset Management
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[200px] gap-3 p-4">
                        <li>
                          <NavigationMenuLink asChild>
                            <NavLink
                              to="/asset-management/load-monitoring"
                              className={cn(
                                "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                isActiveRoute("/asset-management/load-monitoring") && "bg-accent"
                              )}
                            >
                              <div className="text-sm font-medium leading-none">Load Monitoring</div>
                              <div className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                Monitor load distribution across the grid
                              </div>
                            </NavLink>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <NavLink
                              to="/asset-management/inspection-management"
                              className={cn(
                                "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                isActiveRoute("/asset-management/inspection-management") && "bg-accent"
                              )}
                            >
                              <div className="text-sm font-medium leading-none">Substation Inspection</div>
                              <div className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                Manage and track substation inspections
                              </div>
                            </NavLink>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <NavLink
                              to="/asset-management/vit-inspection"
                              className={cn(
                                "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                isActiveRoute("/asset-management/vit-inspection") && "bg-accent"
                              )}
                            >
                              <div className="text-sm font-medium leading-none">VITs Inspection</div>
                              <div className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                Manage and monitor VIT assets and inspections
                              </div>
                            </NavLink>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <NavLink
                              to="/asset-management/overhead-line"
                              className={cn(
                                "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                isActiveRoute("/asset-management/overhead-line") && "bg-accent"
                              )}
                            >
                              <div className="text-sm font-medium leading-none">Overhead Line Inspection</div>
                              <div className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                Manage and monitor overhead line inspections
                              </div>
                            </NavLink>
                          </NavigationMenuLink>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          )}
          
          {/* District Population Menu - Show for district engineers and above */}
          {showMenuItem("district_engineer") && (
            <NavLink 
              to="/district-population" 
              className={cn(
                "text-foreground hover:text-primary transition-colors",
                isActiveRoute("/district-population") && "text-primary"
              )}
            >
              District Population
            </NavLink>
          )}
          
          {/* Admin Menu Items - Only for system admin */}
          {user?.role === "system_admin" && (
            <>
              <NavLink to="/user-management" className="text-foreground hover:text-primary transition-colors">
                User Management
              </NavLink>
              <NavLink to="/system-admin/permissions" className="text-foreground hover:text-primary transition-colors">
                Permission Management
              </NavLink>
              <NavLink to="/system-admin/security" className="text-foreground hover:text-primary transition-colors">
                Security Monitoring
              </NavLink>
            </>
          )}

          {user?.role === "global_engineer" && (
            <NavLink to="/user-management" className="text-foreground hover:text-primary transition-colors">
              User Management
            </NavLink>
          )}
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <img src="/ecg-images/ecg-logo.png" alt="ECG Logo" className="h-10 w-auto" />
            <span className="font-bold text-base md:text-lg">ECG Outage Management System</span>
          </Link>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-6">
            <NavLinks />
          </nav>
          
          <div className="ml-4 flex items-center gap-2">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/profile" className="flex items-center gap-2">
                    <User size={16} />
                    <span>{user?.name || "User"}</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut size={18} />
                </Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Log In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </>
            )}
            {/* Desktop Dark Mode Toggle Button */}
            <Button variant="ghost" onClick={toggleTheme} className="ml-2">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </Button>
          </div>
        </div>
        
        <div className="md:hidden flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col overflow-y-auto">
              {/* Move Log Out button to the top for mobile */}
              {isAuthenticated && (
                <div className="space-y-3 mb-4">
                  <Link to="/profile" className="flex items-center gap-2 hover:underline">
                    <User size={16} />
                    <span className="font-medium">{user?.name || "User"}</span>
                  </Link>
                  <Button variant="outline" className="w-full" onClick={handleLogout}>
                    <LogOut size={16} className="mr-2" />
                    Log Out
                  </Button>
                </div>
              )}
              <nav className="flex flex-col gap-4 mt-4">
                <NavLinks />
                {/* Mobile Asset Management links */}
                {isAuthenticated && (
                  <div className="space-y-3">
                    <div className="font-medium">Asset Management</div>
                    <div className="pl-4 space-y-2">
                      <NavLink 
                        to="/asset-management/load-monitoring" 
                        className="block text-sm text-muted-foreground hover:text-foreground"
                      >
                        Load Monitoring
                      </NavLink>
                      <NavLink 
                        to="/asset-management/inspection-management" 
                        className="block text-sm text-muted-foreground hover:text-foreground"
                      >
                        Substation Inspection
                      </NavLink>
                      <NavLink 
                        to="/asset-management/vit-inspection" 
                        className="block text-sm text-muted-foreground hover:text-foreground"
                      >
                        VITs Inspection
                      </NavLink>
                      <NavLink 
                        to="/asset-management/overhead-line" 
                        className="block text-sm text-muted-foreground hover:text-foreground"
                      >
                        Overhead Line Inspection
                      </NavLink>
                    </div>
                  </div>
                )}
                {/* Mobile Admin Links */}
                {user?.role === "system_admin" && (
                  <div className="space-y-3">
                    <div className="font-medium">Admin</div>
                    <div className="pl-4 space-y-2">
                      <NavLink 
                        to="/user-management" 
                        className="block text-sm text-muted-foreground hover:text-foreground"
                      >
                        User Management
                      </NavLink>
                      <NavLink 
                        to="/system-admin/permissions" 
                        className="block text-sm text-muted-foreground hover:text-foreground"
                      >
                        Permission Management
                      </NavLink>
                      <NavLink 
                        to="/system-admin/security" 
                        className="block text-sm text-muted-foreground hover:text-foreground"
                      >
                        Security Monitoring
                      </NavLink>
                    </div>
                  </div>
                )}
              </nav>
              <Separator className="my-4" />
              <Button variant="ghost" onClick={toggleTheme} className="w-full mb-2">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </Button>
              {!isAuthenticated && (
                <div className="flex flex-col gap-2 mt-auto">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/login">Log In</Link>
                  </Button>
                  <Button className="w-full" asChild>
                    <Link to="/signup">Sign Up</Link>
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

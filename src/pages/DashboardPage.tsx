import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { FaultCard } from "@/components/dashboard/FaultCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertTriangle, ZapOff, RefreshCw, Filter } from "lucide-react";
import { OP5Fault, ControlSystemOutage, FaultType } from "@/lib/types";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { PermissionService } from "@/services/PermissionService";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, isSameDay, isSameMonth, isSameYear } from "date-fns";

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const { getFilteredFaults, regions, districts } = useData();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  
  console.log('[Dashboard] Initial render - Auth state:', { isAuthenticated, userRole: user?.role });
  
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [faults, setFaults] = useState<{op5Faults: OP5Fault[], controlOutages: ControlSystemOutage[]}>({
    op5Faults: [],
    controlOutages: []
  });
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  
  // Advanced filter states
  const [filterFaultType, setFilterFaultType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [dateFilterType, setDateFilterType] = useState<"range" | "day" | "month" | "year">("range");
  
  // Set initial filter values based on user role
  useEffect(() => {
    console.log('[Dashboard] Auth effect - Checking authentication');
    if (!isAuthenticated) {
      console.log('[Dashboard] Not authenticated, redirecting to login');
      navigate("/login");
      return;
    }
    
    if (user) {
      console.log('[Dashboard] User data:', { 
        role: user.role, 
        region: user.region, 
        district: user.district 
      });
      
      // Check if user has access to dashboard
      const hasAccess = permissionService.canAccessFeature(user.role, 'analytics_dashboard');
      console.log('[Dashboard] User has access to dashboard:', hasAccess);
      
      if (!hasAccess) {
        console.log('[Dashboard] User does not have access to dashboard, redirecting');
        navigate("/unauthorized");
        return;
      }
      
      // Only set region/district filters if user is not a system admin or global engineer
      if (user.role !== 'system_admin' && user.role !== 'global_engineer') {
        const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
        console.log('[Dashboard] Region/District IDs:', { regionId, districtId });
        
        if (regionId) {
          setFilterRegion(regionId);
          setSelectedRegion(regionId);
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
          setSelectedDistrict(districtId);
        }
      }
    }
  }, [isAuthenticated, navigate, user, regions, districts]);
  
  useEffect(() => {
    console.log('[Dashboard] Loading faults with filters:', { 
      filterRegion, 
      filterDistrict, 
      filterStatus,
      filterFaultType,
      dateFilterType,
      dateRange,
      selectedDay,
      selectedMonth,
      selectedMonthYear,
      selectedYear
    });
    loadFaults();
  }, [
    filterRegion, 
    filterDistrict, 
    filterStatus, 
    filterFaultType,
    dateFilterType,
    dateRange,
    selectedDay,
    selectedMonth,
    selectedMonthYear,
    selectedYear,
    getFilteredFaults
  ]);
  
  const loadFaults = () => {
    console.log('[Dashboard] loadFaults called');
    console.log('[Dashboard] Current filter states:', { 
      filterRegion, 
      filterDistrict, 
      filterStatus,
      filterFaultType,
      dateFilterType,
      dateRange,
      selectedDay,
      selectedMonth,
      selectedMonthYear,
      selectedYear
    });
    const filteredFaults = getFilteredFaults(filterRegion, filterDistrict);
    console.log('[Dashboard] Filtered faults:', { 
      op5Count: filteredFaults.op5Faults.length,
      controlCount: filteredFaults.controlOutages.length
    });
    
    // Apply status filter
    let statusFilteredOP5 = filteredFaults.op5Faults;
    let statusFilteredControl = filteredFaults.controlOutages;
    
    if (filterStatus !== "all") {
      statusFilteredOP5 = filteredFaults.op5Faults.filter(f => f.status === filterStatus);
      statusFilteredControl = filteredFaults.controlOutages.filter(f => f.status === filterStatus);
    }
    console.log('[Dashboard] After status filter:', { 
      op5Count: statusFilteredOP5.length,
      controlCount: statusFilteredControl.length
    });
    
    // Apply fault type filter
    let typeFilteredOP5 = statusFilteredOP5;
    let typeFilteredControl = statusFilteredControl;
    
    if (filterFaultType !== "all") {
      typeFilteredOP5 = statusFilteredOP5.filter(f => f.faultType === filterFaultType);
      typeFilteredControl = statusFilteredControl.filter(f => f.faultType === filterFaultType);
    }
    console.log('[Dashboard] After fault type filter:', { 
      op5Count: typeFilteredOP5.length,
      controlCount: typeFilteredControl.length
    });
    
    // Apply date filters
    let dateFilteredOP5 = typeFilteredOP5;
    let dateFilteredControl = typeFilteredControl;
    
    if (dateFilterType === "range" && dateRange.from && dateRange.to) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isWithinInterval(faultDate, { start: dateRange.from, end: dateRange.to });
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isWithinInterval(faultDate, { start: dateRange.from, end: dateRange.to });
      });
    } else if (dateFilterType === "day" && selectedDay) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameDay(faultDate, selectedDay);
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameDay(faultDate, selectedDay);
      });
    } else if (dateFilterType === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameMonth(faultDate, new Date(selectedMonthYear, selectedMonth));
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameMonth(faultDate, new Date(selectedMonthYear, selectedMonth));
      });
    } else if (dateFilterType === "year" && selectedYear !== undefined) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameYear(faultDate, new Date(selectedYear, 0));
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameYear(faultDate, new Date(selectedYear, 0));
      });
    }
    console.log('[Dashboard] After date filter:', { 
      op5Count: dateFilteredOP5.length,
      controlCount: dateFilteredControl.length
    });
    
    setFaults({
      op5Faults: dateFilteredOP5,
      controlOutages: dateFilteredControl
    });
  };
  
  const handleRefresh = () => {
    console.log('[Dashboard] Refreshing data');
    setIsRefreshing(true);
    setTimeout(() => {
      loadFaults();
      setIsRefreshing(false);
    }, 1000);
  };
  
  if (!isAuthenticated) {
    console.log('[Dashboard] Not authenticated, returning null');
    return null;
  }
  
  console.log('[Dashboard] Rendering with faults:', { 
    op5Count: faults.op5Faults.length,
    controlCount: faults.controlOutages.length
  });
  
  return (
    <Layout>
      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor and manage power distribution faults
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </Button>
            <Button asChild>
              <Link to="/report-fault" className="flex items-center">
                <PlusCircle size={16} className="mr-2" />
                Report New Fault
              </Link>
            </Button>
          </div>
        </div>
        
        <StatsOverview 
          op5Faults={faults.op5Faults} 
          controlOutages={faults.controlOutages} 
        />
        
        <FilterBar 
          setFilterRegion={setFilterRegion}
          setFilterDistrict={setFilterDistrict}
          setFilterStatus={setFilterStatus}
          filterStatus={filterStatus}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          // Pass advanced filter props
          setFilterFaultType={setFilterFaultType}
          setDateRange={setDateRange}
          setSelectedDay={setSelectedDay}
          setSelectedMonth={setSelectedMonth}
          setSelectedMonthYear={setSelectedMonthYear}
          setSelectedYear={setSelectedYear}
          setDateFilterType={setDateFilterType}
          // Pass current values
          filterFaultType={filterFaultType}
          dateRange={dateRange}
          selectedDay={selectedDay}
          selectedMonth={selectedMonth}
          selectedMonthYear={selectedMonthYear}
          selectedYear={selectedYear}
          dateFilterType={dateFilterType}
        />
        
        <Tabs defaultValue="all" className="mt-8">
          <TabsList className="mb-6 grid w-full grid-cols-3 max-w-xs sm:max-w-sm md:max-w-md mx-auto bg-muted p-1 rounded-lg">
            <TabsTrigger 
              value="all"
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-colors duration-150"
            >
              All Faults
            </TabsTrigger>
            <TabsTrigger 
              value="op5" 
              className="flex items-center justify-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors duration-150"
            >
              <AlertTriangle size={16} className="mr-2" />
              OP5 Faults
            </TabsTrigger>
            <TabsTrigger 
              value="control" 
              className="flex items-center justify-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors duration-150"
            >
              <ZapOff size={16} className="mr-2" />
              Control System
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            {faults.op5Faults.length === 0 && faults.controlOutages.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20 shadow-sm">
                <p className="text-muted-foreground">No faults found with the current filters</p>
                <Button variant="link" onClick={() => {
                  console.log('[Dashboard] Clearing filters for user role:', user?.role);
                  if (user?.role === "global_engineer") {
                    setFilterRegion(undefined);
                    setFilterDistrict(undefined);
                  } else if (user?.role === "regional_engineer") {
                    setFilterDistrict(undefined);
                  }
                  setFilterStatus("all");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...faults.op5Faults, ...faults.controlOutages]
                  .sort((a, b) => {
                    // Sort by status (active first) then by date (newest first)
                    if (a.status === "active" && b.status !== "active") return -1;
                    if (a.status !== "active" && b.status === "active") return 1;
                    return new Date(b.occurrenceDate).getTime() - new Date(a.occurrenceDate).getTime();
                  })
                  .map(fault => (
                    <FaultCard 
                      key={fault.id} 
                      fault={fault} 
                      type={faults.op5Faults.some(f => f.id === fault.id) ? "op5" : "control"} 
                    />
                  ))
                }
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="op5">
            {faults.op5Faults.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20 shadow-sm">
                <p className="text-muted-foreground">No OP5 faults found with the current filters</p>
                <Button variant="link" onClick={() => {
                  setFilterRegion(undefined);
                  setFilterDistrict(undefined);
                  setFilterStatus("all");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {faults.op5Faults
                  .sort((a, b) => {
                    // Sort by status (active first) then by date (newest first)
                    if (a.status === "active" && b.status !== "active") return -1;
                    if (a.status !== "active" && b.status === "active") return 1;
                    return new Date(b.occurrenceDate).getTime() - new Date(a.occurrenceDate).getTime();
                  })
                  .map(fault => (
                    <FaultCard key={fault.id} fault={fault} type="op5" />
                  ))
                }
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="control">
            {faults.controlOutages.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20 shadow-sm">
                <p className="text-muted-foreground">No control system outages found with the current filters</p>
                <Button variant="link" onClick={() => {
                  setFilterRegion(undefined);
                  setFilterDistrict(undefined);
                  setFilterStatus("all");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {faults.controlOutages
                  .sort((a, b) => {
                    // Sort by status (active first) then by date (newest first)
                    if (a.status === "active" && b.status !== "active") return -1;
                    if (a.status !== "active" && b.status === "active") return 1;
                    return new Date(b.occurrenceDate).getTime() - new Date(a.occurrenceDate).getTime();
                  })
                  .map(fault => (
                    <FaultCard key={fault.id} fault={fault} type="control" />
                  ))
                }
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

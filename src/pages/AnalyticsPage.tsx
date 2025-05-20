import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import AnalyticsCharts from "@/components/analytics/AnalyticsCharts";
import { useData } from "@/contexts/DataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, parse, startOfWeek, endOfWeek } from "date-fns";
import { Download, FileText, Filter, Eye, Calendar, MapPin, AlertTriangle, BarChart as ChartIcon, ActivityIcon, TrendingUp, Clock, Users, Wrench, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { exportAnalyticsToPDF } from "@/utils/pdfExport";
import { useToast } from "@/components/ui/use-toast";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { LineChart, Line } from 'recharts';
import { OP5Fault, ControlSystemOutage } from '@/lib/types';
import MaterialsAnalysis from '@/components/analytics/MaterialsAnalysis';
import { calculateOutageDuration, calculateMTTR } from "@/lib/calculations";
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { LoadMonitoringData } from '@/lib/asset-types';

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const formatSafeDate = (dateString: string | undefined | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    return 'N/A';
  }
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { isAuthenticated, user, users } = useAuth(); // Get the list of all users
  const navigate = useNavigate();
  const { regions, districts, getFilteredFaults, op5Faults, controlSystemOutages } = useData();
  const [filteredFaults, setFilteredFaults] = useState([]);
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [filterFaultType, setFilterFaultType] = useState<string | undefined>(undefined);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedFaultType, setSelectedFaultType] = useState<string>("all");
  const [selectedFault, setSelectedFault] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<Date | undefined>(undefined);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [startMonth, setStartMonth] = useState<Date | undefined>(undefined);
  const [endMonth, setEndMonth] = useState<Date | undefined>(undefined);
  const [startYear, setStartYear] = useState<Date | undefined>(undefined);
  const [endYear, setEndYear] = useState<Date | undefined>(undefined);
  const [isStartMonthPickerOpen, setIsStartMonthPickerOpen] = useState(false);
  const [isEndMonthPickerOpen, setIsEndMonthPickerOpen] = useState(false);
  const [isStartYearPickerOpen, setIsStartYearPickerOpen] = useState(false);
  const [isEndYearPickerOpen, setIsEndYearPickerOpen] = useState(false);
  const [startWeek, setStartWeek] = useState<number | undefined>(undefined);
  const [endWeek, setEndWeek] = useState<number | undefined>(undefined);
  const [isStartWeekPickerOpen, setIsStartWeekPickerOpen] = useState(false);
  const [isEndWeekPickerOpen, setIsEndWeekPickerOpen] = useState(false);
  const [reliabilityIndices, setReliabilityIndices] = useState<any>(null);
  const [materialsStats, setMaterialsStats] = useState({
    totalMaterials: 0,
    byType: [] as { name: string; value: number }[],
    byMonth: [] as { name: string; value: number }[],
    topMaterials: [] as { name: string; value: number }[]
  });
  const [overviewRecentFaultsTab, setOverviewRecentFaultsTab] = useState<'all' | 'op5' | 'control'>('all');
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<'all' | 'op5' | 'control'>('all');
  const [loadMonitoringRecords, setLoadMonitoringRecords] = useState<LoadMonitoringData[]>([]);
  const [loadStats, setLoadStats] = useState({
    total: 0,
    overloaded: 0,
    okay: 0,
    avgLoad: 0,
    urgent: 0,
  });
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  
  // Use the same logic as DashboardPage for paginatedFaults
  const paginatedFaults = useMemo(() => {
    // Get the latest filtered faults from context
    const { op5Faults: op5, controlOutages: control } = getFilteredFaults(
      selectedRegion === "all" ? undefined : filterRegion,
      selectedDistrict === "all" ? undefined : filterDistrict
    );
    let faultsToDisplay: (OP5Fault | ControlSystemOutage)[] = [];
    if (overviewRecentFaultsTab === 'op5') {
      faultsToDisplay = op5;
    } else if (overviewRecentFaultsTab === 'control') {
      faultsToDisplay = control;
    } else {
      // Combine both, but ensure uniqueness by id
      const seenIds = new Set<string>();
      faultsToDisplay = [...op5, ...control].filter(fault => {
        if (seenIds.has(fault.id)) return false;
        seenIds.add(fault.id);
        return true;
      });
    }

    // Apply status filter if needed
    if (filterStatus) {
      faultsToDisplay = faultsToDisplay.filter(fault => fault.status === filterStatus);
    }

    // Sort by occurrenceDate descending
    faultsToDisplay.sort((a, b) => new Date(b.occurrenceDate).getTime() - new Date(a.occurrenceDate).getTime());
    // Pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return faultsToDisplay.slice(startIndex, endIndex);
  }, [getFilteredFaults, selectedRegion, filterRegion, selectedDistrict, filterDistrict, overviewRecentFaultsTab, currentPage, pageSize, filterStatus]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    let totalItems = filteredFaults.length;
    if (overviewRecentFaultsTab === 'op5') {
      totalItems = filteredFaults.filter((f): f is OP5Fault => 'faultLocation' in f).length;
    } else if (overviewRecentFaultsTab === 'control') {
      totalItems = filteredFaults.filter((f): f is ControlSystemOutage => 'loadMW' in f).length;
    }
    return Math.ceil(totalItems / pageSize);
  }, [filteredFaults, overviewRecentFaultsTab, pageSize]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterRegion, filterDistrict, filterFaultType, dateRange, startDate, endDate, overviewRecentFaultsTab]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    
    // Initialize filters based on user role
    if (user) {
      // Only set region/district filters if user is not a system admin or global engineer
      if (user.role !== 'system_admin' && user.role !== 'global_engineer') {
        const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
        
        if (regionId) {
          setFilterRegion(regionId);
          setSelectedRegion(regionId);
        } else {
          // Set to "all" if no specific region
          setFilterRegion(undefined);
          setSelectedRegion("all");
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
          setSelectedDistrict(districtId);
        }
      } else {
        // For system admins and global engineers, set to "all" by default
        setFilterRegion(undefined);
        setSelectedRegion("all");
        setFilterDistrict(undefined);
        setSelectedDistrict("all");
      }
    } else {
      // Set default to "all" when no user role restrictions
      setFilterRegion(undefined);
      setSelectedRegion("all");
    }
  }, [isAuthenticated, user, navigate, regions, districts]);

  // Single effect for data loading
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[AnalyticsPage] filteredFaults:', filteredFaults);
      filteredFaults.forEach((fault, idx) => {
        console.log(`[AnalyticsPage] Fault #${idx + 1}:`, fault);
        console.log(`[AnalyticsPage] Fault #${idx + 1} keys:`, Object.keys(fault));
      });
      // Use either 'faultLocation' or 'substationName' to identify OP5 faults
      const op5WithDates = filteredFaults.filter(f => 
        ('faultLocation' in f || 'substationName' in f) && 
        f.repairDate && f.restorationDate
      );
      console.log('[AnalyticsPage] OP5 faults with repairDate and restorationDate:', op5WithDates);
      loadData();
    }
  }, [isAuthenticated, filterRegion, filterDistrict, filterFaultType, dateRange, startDate, endDate]);

  const loadData = () => {
    console.log('[loadData] Starting with filters:', {
      filterRegion,
      filterDistrict,
      filterFaultType,
      filterStatus,
      dateRange,
      startDate,
      endDate,
      selectedRegion,
      selectedMonth,
      selectedYear,
      startWeek,
      endWeek
    });

    // Get filtered faults for analytics - handle "all" case properly
    const { op5Faults, controlOutages } = getFilteredFaults(
      selectedRegion === "all" ? undefined : filterRegion,
      selectedDistrict === "all" ? undefined : filterDistrict
    );
    
    // Apply date range filter
    let filteredByDate = [...op5Faults, ...controlOutages];

    // Apply fault type filter if needed
    if (filterFaultType && filterFaultType !== "all") {
      filteredByDate = filteredByDate.filter(fault => {
        if ('faultType' in fault) {
          return fault.faultType === filterFaultType;
        }
        return false;
      });
    }

    // Apply status filter if needed
    if (filterStatus) {
      filteredByDate = filteredByDate.filter(fault => fault.status === filterStatus);
    }

    // Apply date range filter if needed
    if (dateRange !== "all") {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);

      switch (dateRange) {
        case "today":
          start = startOfDay(now);
          break;
        case "week":
          // Get the start of 7 days ago
          start = startOfDay(subDays(now, 6)); // 6 because today counts as 1
          break;
        case "month":
          // Get the start of 30 days ago
          start = startOfDay(subDays(now, 29)); // 29 because today counts as 1
          break;
        case "year":
          // Get the start of 365 days ago
          start = startOfDay(subDays(now, 364)); // 364 because today counts as 1
          break;
        case "custom":
          if (startDate && endDate) {
            start = startOfDay(startDate);
            end = endOfDay(endDate);
          } else {
            start = startOfYear(now);
          }
          break;
        case "custom-month":
          if (startMonth && endMonth) {
            start = startOfMonth(startMonth);
            end = endOfMonth(endMonth);
            console.log('[loadData] Custom month range:', {
              start: start.toISOString(),
              end: end.toISOString()
            });
          } else if (selectedMonth) {
            start = startOfMonth(selectedMonth);
            end = endOfMonth(selectedMonth);
            console.log('[loadData] Single month:', {
              start: start.toISOString(),
              end: end.toISOString()
            });
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
          break;
        case "custom-year":
          if (startYear && endYear) {
            start = startOfYear(startYear);
            end = endOfYear(endYear);
            console.log('[loadData] Custom year range:', {
              start: start.toISOString(),
              end: end.toISOString()
            });
          } else if (selectedYear) {
            start = startOfYear(selectedYear);
            end = endOfYear(selectedYear);
            console.log('[loadData] Single year:', {
              start: start.toISOString(),
              end: end.toISOString()
            });
          } else {
            start = startOfYear(now);
            end = endOfYear(now);
          }
          break;
        case "custom-week":
          if (startWeek && endWeek && selectedYear) {
            // Convert week numbers to dates
            start = startOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (startWeek - 1) * 7));
            end = endOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (endWeek - 1) * 7));
            console.log('[loadData] Custom week range:', {
              start: start.toISOString(),
              end: end.toISOString(),
              startWeek,
              endWeek,
              year: selectedYear.getFullYear()
            });
          } else {
            start = startOfWeek(now);
            end = endOfWeek(now);
          }
          break;
        default:
          start = startOfYear(now);
      }

      console.log('[loadData] Date filter:', {
        dateRange,
        start: start.toISOString(),
        end: end.toISOString()
      });

      filteredByDate = filteredByDate.filter(fault => {
        try {
          const faultDate = new Date(fault.occurrenceDate);
          const isInRange = faultDate >= start && faultDate <= end;
          
          if (!isInRange) {
            console.log('[loadData] Fault filtered out:', {
              faultId: fault.id,
              faultDate: faultDate.toISOString(),
              start: start.toISOString(),
              end: end.toISOString()
            });
          }
          
          return isInRange;
        } catch (error) {
          console.error('[loadData] Error processing fault date:', {
            faultId: fault.id,
            occurrenceDate: fault.occurrenceDate,
            error
          });
          return false;
        }
      });
    }

    console.log('[loadData] Filtered results:', {
      totalFaults: filteredByDate.length,
      op5Faults: filteredByDate.filter(f => 'faultLocation' in f).length,
      controlOutages: filteredByDate.filter(f => !('faultLocation' in f)).length,
      dateRange,
      region: filterRegion,
      district: filterDistrict,
      sampleDates: filteredByDate.slice(0, 3).map(f => ({
        id: f.id,
        date: f.occurrenceDate
      }))
    });

    setFilteredFaults(filteredByDate);

    // Calculate reliability indices based on selected level
    const reliabilityIndices = calculateReliabilityIndicesByLevel(
      filteredByDate,
      districts,
      filterRegion,
      filterDistrict
    );
    setReliabilityIndices(reliabilityIndices);
  };

  const calculateReliabilityIndicesByLevel = (
    faults: any[],
    districts: any[],
    regionId: string | undefined,
    districtId: string | undefined
  ) => {
    const indices = {
      rural: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      urban: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      metro: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      total: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 }
    };

    // Filter only OP5 faults with valid dates
    const op5Faults = faults.filter(fault => 
      ('faultLocation' in fault || 'substationName' in fault) && 
      fault.occurrenceDate && 
      fault.restorationDate &&
      fault.repairDate &&
      fault.repairEndDate
    );

    // Get total population based on level
    let totalPopulation = { rural: 0, urban: 0, metro: 0 };
    if (districtId) {
      // District level
      const district = districts.find(d => d.id === districtId);
      if (district?.population) {
        totalPopulation = district.population;
      }
    } else if (regionId) {
      // Regional level
      const regionDistricts = districts.filter(d => d.regionId === regionId);
      totalPopulation = regionDistricts.reduce((acc, district) => ({
        rural: acc.rural + (district.population?.rural || 0),
        urban: acc.urban + (district.population?.urban || 0),
        metro: acc.metro + (district.population?.metro || 0)
      }), { rural: 0, urban: 0, metro: 0 });
    } else {
      // Global level
      totalPopulation = districts.reduce((acc, district) => ({
        rural: acc.rural + (district.population?.rural || 0),
        urban: acc.urban + (district.population?.urban || 0),
        metro: acc.metro + (district.population?.metro || 0)
      }), { rural: 0, urban: 0, metro: 0 });
    }

    // Initialize tracking objects
    let customerHoursLost = { rural: 0, urban: 0, metro: 0 };
    let affectedCustomers = { rural: 0, urban: 0, metro: 0 };
    let momentaryInterruptions = { rural: 0, urban: 0, metro: 0 };
    let sustainedInterruptions = { rural: 0, urban: 0, metro: 0 };
    let customerInterruptions = { rural: 0, urban: 0, metro: 0 };
    // Track unique customers by district
    let distinctCustomersByDistrict = new Map<string, Set<string>>();
    let totalInterruptions = { rural: 0, urban: 0, metro: 0 };
    let outageDetails: { id: string; affected: number; districtId: string }[] = [];

    // Add debug logging
    console.log('Starting CAIFI calculation with faults:', op5Faults.length);

    // Process each fault
    op5Faults.forEach((fault, index) => {
      if (fault.affectedPopulation) {
        const { rural, urban, metro } = fault.affectedPopulation;
        const duration = calculateOutageDuration(fault.occurrenceDate, fault.restorationDate);
        const isMomentary = duration <= 5; // Consider interruptions ≤ 5 minutes as momentary

        // Track total affected customers for this outage
        const totalAffected = rural + urban + metro;
        outageDetails.push({
          id: fault.id,
          affected: totalAffected,
          districtId: fault.districtId
        });

        console.log(`Processing fault ${index + 1}:`, {
          faultId: fault.id,
          districtId: fault.districtId,
          rural,
          urban,
          metro,
          totalAffected,
          duration,
          isMomentary
        });

        // Update customer hours lost
        customerHoursLost.rural += duration * rural;
        customerHoursLost.urban += duration * urban;
        customerHoursLost.metro += duration * metro;

        // Update affected customers
        affectedCustomers.rural += rural;
        affectedCustomers.urban += urban;
        affectedCustomers.metro += metro;

        // Update total interruptions
        totalInterruptions.rural += rural;
        totalInterruptions.urban += urban;
        totalInterruptions.metro += metro;

        // Update momentary interruptions
        if (isMomentary) {
          momentaryInterruptions.rural += rural;
          momentaryInterruptions.urban += urban;
          momentaryInterruptions.metro += metro;
        }

        // Track distinct customers by district
        if (!distinctCustomersByDistrict.has(fault.districtId)) {
          distinctCustomersByDistrict.set(fault.districtId, new Set());
        }
        const districtCustomers = distinctCustomersByDistrict.get(fault.districtId)!;

        // Add customers to the district's set
        for (let i = 0; i < rural; i++) {
          districtCustomers.add(`rural-${i}`);
        }
        for (let i = 0; i < urban; i++) {
          districtCustomers.add(`urban-${i}`);
        }
        for (let i = 0; i < metro; i++) {
          districtCustomers.add(`metro-${i}`);
        }
      }
    });

    // Calculate total distinct customers by type
    let distinctCustomersByType = { rural: 0, urban: 0, metro: 0 };
    distinctCustomersByDistrict.forEach((customers, districtId) => {
      customers.forEach(customerId => {
        if (customerId.startsWith('rural-')) distinctCustomersByType.rural++;
        else if (customerId.startsWith('urban-')) distinctCustomersByType.urban++;
        else if (customerId.startsWith('metro-')) distinctCustomersByType.metro++;
      });
    });

    // Detailed CAIFI analysis
    console.log('=== Detailed CAIFI Analysis ===');
    console.log('Outage Details:', outageDetails);
    console.log('Total Interruptions:', {
      rural: totalInterruptions.rural,
      urban: totalInterruptions.urban,
      metro: totalInterruptions.metro,
      total: totalInterruptions.rural + totalInterruptions.urban + totalInterruptions.metro
    });
    console.log('Distinct Customers:', {
      rural: distinctCustomersByType.rural,
      urban: distinctCustomersByType.urban,
      metro: distinctCustomersByType.metro,
      total: distinctCustomersByType.rural + distinctCustomersByType.urban + distinctCustomersByType.metro
    });
    console.log('CAIFI Values:', {
      rural: distinctCustomersByType.rural > 0 ? (totalInterruptions.rural / distinctCustomersByType.rural).toFixed(2) : '0.00',
      urban: distinctCustomersByType.urban > 0 ? (totalInterruptions.urban / distinctCustomersByType.urban).toFixed(2) : '0.00',
      metro: distinctCustomersByType.metro > 0 ? (totalInterruptions.metro / distinctCustomersByType.metro).toFixed(2) : '0.00',
      total: ((totalInterruptions.rural + totalInterruptions.urban + totalInterruptions.metro) / 
              (distinctCustomersByType.rural + distinctCustomersByType.urban + distinctCustomersByType.metro)).toFixed(2)
    });
    console.log('District-wise Analysis:', 
      Array.from(distinctCustomersByDistrict.entries()).map(([districtId, customers]) => ({
        districtId,
        totalCustomers: customers.size,
        customerTypes: {
          rural: Array.from(customers).filter(id => id.startsWith('rural-')).length,
          urban: Array.from(customers).filter(id => id.startsWith('urban-')).length,
          metro: Array.from(customers).filter(id => id.startsWith('metro-')).length
        }
      }))
    );
    console.log('=============================');

    // Log intermediate values
    console.log('CAIFI calculation values:', {
      totalInterruptions,
      distinctCustomersByType,
      districts: Array.from(distinctCustomersByDistrict.entries()).map(([districtId, customers]) => ({
        districtId,
        customerCount: customers.size
      }))
    });

    // Calculate indices for each population type
    ['rural', 'urban', 'metro'].forEach(type => {
      const t = type as keyof typeof totalPopulation;
      if (totalPopulation[t] > 0) {
        // SAIDI = Total Customer Hours Lost / Total Number of Customers
        indices[t].saidi = Number((customerHoursLost[t] / totalPopulation[t]).toFixed(2));
        
        // SAIFI = Total Customers Affected / Total Number of Customers
        indices[t].saifi = Number((affectedCustomers[t] / totalPopulation[t]).toFixed(2));
        
        // CAIDI = SAIDI / SAIFI
        indices[t].caidi = indices[t].saifi > 0 ? 
          Number((indices[t].saidi / indices[t].saifi).toFixed(2)) : 0;

        // CAIFI = Total Number of Customer Interruptions / Number of Distinct Customers Interrupted
        const distinctCount = distinctCustomersByType[t];
        const totalInterruptionCount = totalInterruptions[t];
        
        console.log(`CAIFI calculation for ${type}:`, {
          totalInterruptions: totalInterruptionCount,
          distinctCount,
          caifi: distinctCount > 0 ? Number((totalInterruptionCount / distinctCount).toFixed(2)) : 0
        });

        indices[t].caifi = distinctCount > 0 ? 
          Number((totalInterruptionCount / distinctCount).toFixed(2)) : 0;

        // MAIFI = Number of customers with momentary interruptions / Total Number of Customers
        indices[t].maifi = Number((momentaryInterruptions[t] / totalPopulation[t]).toFixed(2));
      }
    });

    // Calculate total indices
    const totalPopulationAll = totalPopulation.rural + totalPopulation.urban + totalPopulation.metro;
    const totalCustomerHoursLost = customerHoursLost.rural + customerHoursLost.urban + customerHoursLost.metro;
    const totalAffectedCustomers = affectedCustomers.rural + affectedCustomers.urban + affectedCustomers.metro;
    const totalMomentaryInterruptions = momentaryInterruptions.rural + momentaryInterruptions.urban + momentaryInterruptions.metro;
    const totalCustomerInterruptions = totalInterruptions.rural + totalInterruptions.urban + totalInterruptions.metro;
    const totalDistinctCustomers = distinctCustomersByType.rural + distinctCustomersByType.urban + distinctCustomersByType.metro;

    if (totalPopulationAll > 0) {
      indices.total.saidi = Number((totalCustomerHoursLost / totalPopulationAll).toFixed(2));
      indices.total.saifi = Number((totalAffectedCustomers / totalPopulationAll).toFixed(2));
      indices.total.caidi = indices.total.saifi > 0 ? 
        Number((indices.total.saidi / indices.total.saifi).toFixed(2)) : 0;
      indices.total.caifi = totalDistinctCustomers > 0 ? 
        Number((totalCustomerInterruptions / totalDistinctCustomers).toFixed(2)) : 0;
      indices.total.maifi = Number((totalMomentaryInterruptions / totalPopulationAll).toFixed(2));
    }

    return indices;
  };

  const handleRegionChange = (value: string) => {
    console.log('[handleRegionChange] New region:', value, 'Previous:', selectedRegion);
    
    if (value === "all") {
      // Clear both region and district filters
      setFilterRegion(undefined);
      setFilterDistrict(undefined);
      setSelectedDistrict("");
    } else {
      // Set new region filter
      setFilterRegion(value);
      // Reset district when changing region
      setFilterDistrict(undefined);
      setSelectedDistrict("");
    }
    setSelectedRegion(value);
  };

  const handleDistrictChange = (value: string) => {
    console.log('[handleDistrictChange] New district:', value);
    
    if (value === "all") {
      setFilterDistrict(undefined);
    } else {
      setFilterDistrict(value);
    }
    setSelectedDistrict(value);
  };
  
  const handleDateRangeChange = (value: string) => {
    console.log('[handleDateRangeChange] New date range:', value);
    
    setDateRange(value);
    // Reset custom date selections when changing date range type
    if (value !== "custom") {
      setStartDate(null);
      setEndDate(null);
    }
    // Reset custom period selections
    setStartMonth(undefined);
    setEndMonth(undefined);
    setStartYear(undefined);
    setEndYear(undefined);
    setStartWeek(undefined);
    setEndWeek(undefined);
  };

  const handleStartMonthSelect = (date: Date | undefined) => {
    setStartMonth(date);
    setIsStartMonthPickerOpen(false);
    if (date && endMonth) {
      loadData();
    }
  };

  const handleEndMonthSelect = (date: Date | undefined) => {
    setEndMonth(date);
    setIsEndMonthPickerOpen(false);
    if (date && startMonth) {
      loadData();
    }
  };

  const handleStartYearSelect = (date: Date | undefined) => {
    setStartYear(date);
    setIsStartYearPickerOpen(false);
    if (date && endYear) {
      loadData();
    }
  };

  const handleEndYearSelect = (date: Date | undefined) => {
    setEndYear(date);
    setIsEndYearPickerOpen(false);
    if (date && startYear) {
      loadData();
    }
  };

  const handleStartWeekSelect = (week: number) => {
    setStartWeek(week);
    if (week && endWeek && selectedYear) {
      loadData();
    }
  };

  const handleEndWeekSelect = (week: number) => {
    setEndWeek(week);
    if (week && startWeek && selectedYear) {
      loadData();
    }
  };

  const handleYearSelect = (date: Date | undefined) => {
    setSelectedYear(date);
    if (date && startWeek && endWeek) {
      loadData();
    }
  };
  
  const handleFaultTypeChange = (value: string) => {
    console.log('[handleFaultTypeChange] New fault type:', value);
    
    if (value === "all") {
      setFilterFaultType(undefined);
    } else {
      setFilterFaultType(value);
    }
    setSelectedFaultType(value);
  };
  
  const handleStatusChange = (value: string) => {
    setFilterStatus(value === "all" ? undefined : value);
  };
  
  // Add useEffect to watch for date range changes
  useEffect(() => {
    if (dateRange === "custom-month" && startMonth && endMonth) {
      loadData();
    } else if (dateRange === "custom-year" && startYear && endYear) {
      loadData();
    } else if (dateRange === "custom-week" && startWeek && endWeek) {
      loadData();
    }
  }, [dateRange, startMonth, endMonth, startYear, endYear, startWeek, endWeek]);
  
  const exportDetailed = () => {
    const headers = [
      'ID', 'Type', 'Region', 'District', 'Occurrence Date', 'Restoration Date', 
      'Status', 'Fault Type', 'Specific Fault Type', 'Duration (hours)', 'Created By', 'Created At',
      // Common fields for both types
      'Rural Customers Affected', 'Urban Customers Affected', 'Metro Customers Affected',
      // OP5 specific fields
      'Fault Location', 'MTTR', 'SAIDI', 'SAIFI', 'CAIDI',
      // Control outage specific fields
      'Load (MW)', 'Unserved Energy (MWh)', 'Area Affected', 'Reason', 'Control Panel Indications'
    ];
    
    const dataRows = filteredFaults.map((fault: any) => {
      const type = 'faultLocation' in fault ? 'OP5 Fault' : 'Control Outage';
      // Calculate duration properly
      const duration = fault.occurrenceDate && fault.restorationDate ? 
        calculateOutageDuration(fault.occurrenceDate, fault.restorationDate) : 0;
      const region = regions.find(r => r.id === fault.regionId)?.name || fault.regionId;
      const district = districts.find(d => d.id === fault.districtId)?.name || fault.districtId;
      
      // Common fields
      const row = [
        fault.id,
        type,
        region,
        district,
        formatSafeDate(fault.occurrenceDate),
        fault.restorationDate ? formatSafeDate(fault.restorationDate) : 'N/A',
        fault.status,
        fault.faultType,
        fault.specificFaultType || 'N/A',
        duration.toFixed(2), // Format duration to 2 decimal places
        fault.createdBy,
        formatSafeDate(fault.createdAt),
        // Population affected
        fault.affectedPopulation?.rural || fault.customersAffected?.rural || 0,
        fault.affectedPopulation?.urban || fault.customersAffected?.urban || 0,
        fault.affectedPopulation?.metro || fault.customersAffected?.metro || 0,
      ];

      // Add OP5 specific fields
      if ('faultLocation' in fault) {
        row.push(
          fault.faultLocation || 'N/A',
          fault.mttr || 'N/A',
          fault.reliabilityIndices?.saidi || 'N/A',
          fault.reliabilityIndices?.saifi || 'N/A',
          fault.reliabilityIndices?.caidi || 'N/A',
          'N/A', // Load MW
          'N/A', // Unserved Energy
          'N/A', // Area Affected
          'N/A', // Reason
          'N/A'  // Control Panel Indications
        );
      } else {
        // Add Control outage specific fields
        row.push(
          'N/A', // Fault Location
          'N/A', // MTTR
          'N/A', // SAIDI
          'N/A', // SAIFI
          'N/A', // CAIDI
          fault.loadMW || 0,
          fault.unservedEnergyMWh || 0,
          fault.areaAffected || 'N/A',
          fault.reason || 'N/A',
          fault.controlPanelIndications || 'N/A'
        );
      }
      
      // Handle values that might contain commas by wrapping in quotes
      return row.map(value => {
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          // Escape any existing quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    // Combine headers and data
    const csvContent = [headers.join(','), ...dataRows].join('\n');
    
    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fault-analysis-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const exportToPDF = async () => {
    try {
      await exportAnalyticsToPDF(
        filteredFaults,
        reliabilityIndices,
        dateRange,
        startDate,
        endDate,
        selectedRegion,
        selectedDistrict,
        regions,
        districts
      );
    } catch (error) {
      console.error("Error exporting to PDF:", error);
    }
  };
  
  const exportMaterialsToCSV = () => {
    try {
      console.log('Starting material export with faults:', filteredFaults);

      // Get all OP5 faults with materials used
      const faultsWithMaterials = filteredFaults.filter(fault => {
        const isOP5Fault = 'faultLocation' in fault || 'substationName' in fault || fault.type === 'OP5';
        const hasMaterials = Array.isArray(fault.materialsUsed) && fault.materialsUsed.length > 0;
        if (isOP5Fault && hasMaterials) {
          console.log('[MaterialsAnalysis] Fault with materials:', fault);
        }
        return isOP5Fault && hasMaterials;
      });

      if (faultsWithMaterials.length === 0) {
        toast({
          title: "Export Failed",
          description: "No material data found to export",
          variant: "destructive",
        });
        return;
      }

      // Prepare headers
      const headers = [
        'Fault ID',
        'Fault Type',
        'Region',
        'District',
        'Fault Location',
        'Material Type',
        'Material Details',
        'Quantity',
        'Date'
      ];

      // Prepare data rows
      const dataRows = faultsWithMaterials.flatMap(fault => {
        const region = regions.find(r => r.id === fault.regionId)?.name || 'Unknown';
        const district = districts.find(d => d.id === fault.districtId)?.name || 'Unknown';
        const faultType = fault.faultType || 'OP5 Fault'; // Default to 'OP5 Fault' if faultType is not available
        
        return fault.materialsUsed.map(material => {
          let materialDetails = 'N/A';
          let quantity = material.quantity || material.details?.quantity || 1;
          
          // Handle different material types
          switch (material.type) {
            case 'Fuse':
              const rating = material.details?.rating || material.details?.fuseRating || material.rating || 'N/A';
              materialDetails = `Rating: ${rating}A`;
              break;
            case 'Conductor':
              const type = material.details?.type || material.conductorType || 'N/A';
              const length = material.details?.length || material.length || 'N/A';
              materialDetails = `Type: ${type}, Length: ${length}m`;
              break;
            case 'Others':
              materialDetails = material.details?.description || material.description || 'N/A';
              break;
            default:
              materialDetails = 'Unknown material type';
          }

          console.log('Processing material:', {
            faultId: fault.id,
            materialType: material.type,
            quantity: quantity,
            rawMaterial: material
          });

          return [
            fault.id || 'N/A',
            faultType,
            region,
            district,
            fault.faultLocation || 'N/A',
            material.type || 'Unknown',
            materialDetails,
            quantity.toString(),
            formatSafeDate(fault.occurrenceDate)
          ];
        });
      });

      // Create CSV content with proper escaping
      const csvContent = [
        headers.join(','),
        ...dataRows.map(row => 
          row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `materials_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "Materials report has been exported",
      });
    } catch (error) {
      console.error('Error exporting materials to CSV:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export materials report",
        variant: "destructive",
      });
    }
  };
  
  const renderMaterialsContent = () => {
    // Get all OP5 faults with materials used
    const op5Faults = filteredFaults.filter(fault => {
      // Check if it's an OP5 fault and has materials
      const isOP5Fault = 'faultLocation' in fault || 'substationName' in fault || fault.type === 'OP5';
      const hasMaterials = Array.isArray(fault.materialsUsed) && fault.materialsUsed.length > 0;
      
      if (isOP5Fault && hasMaterials) {
        console.log('OP5 Fault with materials:', {
          id: fault.id,
          type: fault.type,
          materialsCount: fault.materialsUsed.length,
          materials: fault.materialsUsed
        });
      }
      
      return isOP5Fault && hasMaterials;
    });

    // Calculate materials statistics
    const materialsStats = {
      totalMaterials: op5Faults.reduce((sum, fault) => sum + fault.materialsUsed.length, 0),
      byType: [] as { name: string; value: number }[],
      byMonth: [] as { name: string; value: number }[],
      topMaterials: [] as { name: string; value: number }[]
    };

    // Group materials by type
    const materialsByType = new Map<string, number>();
    const materialsByMonth = new Map<string, number>();
    const materialCounts = new Map<string, number>();

    op5Faults.forEach(fault => {
      try {
        // Use occurrenceDate instead of date
        const faultDate = fault.occurrenceDate ? new Date(fault.occurrenceDate) : null;
        if (!faultDate || isNaN(faultDate.getTime())) {
          console.warn(`Invalid date for fault ${fault.id}:`, {
            occurrenceDate: fault.occurrenceDate,
            type: fault.type
          });
          return;
        }
        
        const month = format(faultDate, 'MMM yyyy');
        
        fault.materialsUsed.forEach(material => {
          // Log the complete material object for debugging
          console.log('Processing material:', {
            type: material.type,
            details: material.details,
            raw: material
          });

          // Count by type
          materialsByType.set(
            material.type,
            (materialsByType.get(material.type) || 0) + 1
          );

          // Count by month
          materialsByMonth.set(
            month,
            (materialsByMonth.get(month) || 0) + 1
          );

          // Count individual materials with safe property access
          let materialKey = material.type;
          
          if (material.type === 'Fuse') {
            // Check both the details object and direct properties
            const rating = material.details?.rating || 
                         material.details?.fuseRating || 
                         material.rating || 
                         material.fuseRating || 
                         'Unknown Rating';
            materialKey = `${material.type} - ${rating}`;
          } else if (material.type === 'Conductor') {
            const type = material.details?.type || 
                        material.type || 
                        'Unknown Type';
            materialKey = `${material.type} - ${type}`;
          } else if (material.type === 'Others') {
            const description = material.details?.description || 
                              material.description || 
                              'Unknown Description';
            materialKey = `${material.type} - ${description}`;
          }

          materialCounts.set(
            materialKey,
            (materialCounts.get(materialKey) || 0) + 1
          );
        });
      } catch (error) {
        console.error(`Error processing fault ${fault.id}:`, error, {
          occurrenceDate: fault.occurrenceDate,
          type: fault.type,
          materials: fault.materialsUsed
        });
      }
    });

    // Convert to arrays for charts
    materialsStats.byType = Array.from(materialsByType.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    materialsStats.byMonth = Array.from(materialsByMonth.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        try {
          const dateA = new Date(a.name);
          const dateB = new Date(b.name);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            console.warn('Invalid date in month sorting:', { a: a.name, b: b.name });
            return 0;
          }
          return dateA.getTime() - dateB.getTime();
        } catch (error) {
          console.error('Error sorting dates:', error);
          return 0;
        }
      });

    materialsStats.topMaterials = Array.from(materialCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    console.log('Materials Analysis Stats:', {
      totalFaults: op5Faults.length,
      totalMaterials: materialsStats.totalMaterials,
      byType: materialsStats.byType,
      byMonth: materialsStats.byMonth,
      topMaterials: materialsStats.topMaterials,
      sampleFault: op5Faults[0] ? {
        id: op5Faults[0].id,
        materials: op5Faults[0].materialsUsed
      } : null
    });

    return (
      <TabsContent value="materials" className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Materials Analysis</h2>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportMaterialsToCSV}
          >
            <Package className="h-4 w-4" />
            <span>Export Materials Report</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Materials Used</CardTitle>
              <CardDescription>Across all OP5 faults</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{materialsStats.totalMaterials}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Materials by Type</CardTitle>
              <CardDescription>Distribution of material types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={materialsStats.byType}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {materialsStats.byType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Usage</CardTitle>
              <CardDescription>Materials used over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={materialsStats.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Top Materials Used</CardTitle>
              <CardDescription>Most frequently used materials</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={materialsStats.topMaterials}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    );
  };
  
  // For district engineers, we restrict them to only see their district data
  const canChangeFilters = user?.role !== "district_engineer";
  
  // Filter the districts based on selected region
  const availableDistricts = filterRegion 
    ? districts.filter(d => d.regionId === filterRegion) 
    : districts;
  
  // Function to get region and district names
  const getRegionName = (regionId: string) => {
    return regions.find(r => r.id === regionId)?.name || regionId;
  };
  
  const getDistrictName = (districtId: string) => {
    return districts.find(d => d.id === districtId)?.name || districtId;
  };
  
  const showFaultDetails = (fault: any) => {
    setSelectedFault(fault);
    setDetailsOpen(true);
    console.log('Selected fault:', fault);
  };
  
  // Function to export only the recent faults shown in the overview table
  const exportRecentFaultsToCSV = () => {
    if (!paginatedFaults || paginatedFaults.length === 0) {
      toast({ title: "No data to export", description: "The recent faults table is empty." });
      return;
    }

    const headers = [
      'ID', 'Type', 'Region', 'District', 'Occurrence Date', 'Status', 'Outage Duration', 'Estimated Resolution', 'Resolution Status', 'Customers Affected', 'Fault Description'
    ];

    const dataRows = paginatedFaults.map((fault: any) => {
      const type = 'faultLocation' in fault || 'substationName' in fault ? 'OP5' : 'Control';
      const region = getRegionName(fault.regionId);
      const district = getDistrictName(fault.districtId);
      const date = formatSafeDate(fault.occurrenceDate);
      const status = fault.status;
      const outageDuration = fault.occurrenceDate && fault.restorationDate
        ? `${((new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
        : 'N/A';
      const estimatedResolution = fault.estimatedResolutionTime
        ? `${((new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
        : 'N/A';
      const resolutionStatus = fault.occurrenceDate && fault.restorationDate && fault.estimatedResolutionTime
        ? (new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) <= (new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime())
          ? 'Within Estimate'
          : 'Exceeded Estimate'
        : 'N/A';
      const faultDescription = fault.outageDescription || fault.description || 'N/A';
      return [
        fault.id,
        type,
        region,
        district,
        date,
        status,
        outageDuration,
        estimatedResolution,
        resolutionStatus,
        fault.affectedPopulation
          ? (fault.affectedPopulation.rural + fault.affectedPopulation.urban + fault.affectedPopulation.metro)
          : fault.customersAffected
            ? (fault.customersAffected.rural + fault.customersAffected.urban + fault.customersAffected.metro)
            : 'N/A',
        faultDescription
      ].map(value => {
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"')) {
           // Correctly escape double quotes for CSV
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',');
    });

    const csvContent = [headers.join(','), ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `recent-faults-${overviewRecentFaultsTab}-${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Correct the toast call to pass a single options object
    toast({ title: "Export Successful", description: "Recent faults exported to CSV." }); 
  };
  
  // Add a helper function to find user name by ID
  const getUserNameById = (userId: string | undefined): string => {
    if (!userId || userId === 'offline_user' || userId === 'unknown') return userId || 'N/A';
    const foundUser = users.find(u => u.id === userId);
    return foundUser ? foundUser.name || foundUser.email || userId : userId;
  };
  
  // Fetch load monitoring data with role-based filtering
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    async function fetchLoadMonitoring() {
      let qRef = collection(db, 'loadMonitoring');
      let q = query(qRef);

      // Apply region filter (use regionId)
      if (selectedRegion && selectedRegion !== "all") {
        q = query(q, where('regionId', '==', selectedRegion));
      } else if (user.role === 'regional_engineer') {
        q = query(q, where('regionId', '==', user.region));
      }

      // Apply district filter (use districtId)
      if (selectedDistrict && selectedDistrict !== "all") {
        q = query(q, where('districtId', '==', selectedDistrict));
      } else if (user.role === 'district_engineer' || user.role === 'technician') {
        q = query(q, where('districtId', '==', user.district));
      }

      const snapshot = await getDocs(q);
      let records: LoadMonitoringData[] = snapshot.docs.map(doc => ({ id: doc.id, ...Object.assign({}, doc.data()) } as LoadMonitoringData));

      // Date range filtering (client-side)
      if (dateRange !== "all") {
        let start: Date, end: Date;
        const now = new Date();
        switch (dateRange) {
          case "week":
            start = startOfDay(subDays(now, 6));
            end = endOfDay(now);
            break;
          case "month":
            start = startOfDay(subDays(now, 29));
            end = endOfDay(now);
            break;
          case "year":
            start = startOfDay(subDays(now, 364));
            end = endOfDay(now);
            break;
          case "custom":
            if (startDate && endDate) {
              start = startOfDay(startDate);
              end = endOfDay(endDate);
            }
            break;
          case "custom-month":
            if (startMonth && endMonth) {
              start = startOfMonth(startMonth);
              end = endOfMonth(endMonth);
            }
            break;
          case "custom-year":
            if (startYear && endYear) {
              start = startOfYear(startYear);
              end = endOfYear(endYear);
            }
            break;
          case "custom-week":
            if (startWeek && endWeek && selectedYear) {
              start = startOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (startWeek - 1) * 7));
              end = endOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (endWeek - 1) * 7));
            }
            break;
          default:
            start = startOfYear(now);
            end = endOfDay(now);
        }
        if (start && end) {
          records = records.filter(r => {
            const recordDate = new Date(r.date);
            return recordDate >= start && recordDate <= end;
          });
        }
      }

      setLoadMonitoringRecords(records);
    }
    fetchLoadMonitoring();
  }, [
    isAuthenticated,
    user,
    selectedRegion,
    selectedDistrict,
    dateRange,
    startDate,
    endDate,
    startMonth,
    endMonth,
    startYear,
    endYear,
    startWeek,
    endWeek,
    selectedYear
  ]);

  // Compute statistics
  useEffect(() => {
    if (!loadMonitoringRecords.length) {
      setLoadStats({ total: 0, overloaded: 0, okay: 0, avgLoad: 0, urgent: 0 });
      return;
    }
    const total = loadMonitoringRecords.length;
    const overloaded = loadMonitoringRecords.filter(r => r.percentageLoad > 100).length;
    const okay = loadMonitoringRecords.filter(r => r.percentageLoad <= 100).length;
    const avgLoad = total ? Number((loadMonitoringRecords.reduce((sum, r) => sum + (r.percentageLoad || 0), 0) / total).toFixed(2)) : 0;
    const urgent = loadMonitoringRecords.filter(r => r.neutralWarningLevel === 'critical').length;
    setLoadStats({ total, overloaded, okay, avgLoad, urgent });
  }, [loadMonitoringRecords]);
  
  const handleClearFilters = () => {
    setSelectedRegion("all");
    setFilterRegion(undefined);
    setSelectedDistrict("all");
    setFilterDistrict(undefined);
    setSelectedFaultType("all");
    setFilterFaultType(undefined);
    setFilterStatus(undefined);
    setDateRange("all");
    setStartDate(null);
    setEndDate(null);
    setStartMonth(undefined);
    setEndMonth(undefined);
    setStartYear(undefined);
    setEndYear(undefined);
    setStartWeek(undefined);
    setEndWeek(undefined);
    setSelectedYear(undefined);
  };
  
  // Set initial filters based on user role
  useEffect(() => {
    if (user?.role === "regional_engineer" && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setFilterRegion(userRegion.id);
        setSelectedRegion(userRegion.id);
      }
    }
  }, [user, regions]);
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 space-y-6 sm:space-y-8">
        {/* Enhanced Page Header */}
        <div className="pb-4 border-b border-border/40">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Analytics & Reporting
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {user?.role === "district_engineer" 
              ? `Analysis for ${user.district}` 
              : user?.role === "regional_engineer"
              ? `Analysis for ${user.region}`
              : "Analyze fault patterns and generate insights for better decision making"}
          </p>
        </div>

        {/* Filters Section */}
        <Card className="p-4 sm:p-6 bg-muted/30 border shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" /> Filters
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="ml-auto"
            >
              Clear Filters
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Region Select */}
            <div>
              <Label htmlFor="region-select" className="text-xs text-muted-foreground">Region</Label>
              <Select
                value={selectedRegion}
                onValueChange={handleRegionChange}
                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer"}
              >
                <SelectTrigger id="region-select" className="mt-1">
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* District Select */}
            <div>
              <Label htmlFor="district-select" className="text-xs text-muted-foreground">District</Label>
              <Select
                value={selectedDistrict}
                onValueChange={handleDistrictChange}
                disabled={!selectedRegion || user?.role === "district_engineer"}
              >
                <SelectTrigger id="district-select" className="mt-1">
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts
                    .filter((d) => !selectedRegion || d.regionId === selectedRegion)
                    .map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {/* Fault Type Select */}
            <div>
               <Label htmlFor="fault-type-select" className="text-xs text-muted-foreground">Outage Type</Label>
              <Select
                value={selectedFaultType}
                onValueChange={handleFaultTypeChange}
              >
                <SelectTrigger id="fault-type-select" className="mt-1">
                  <SelectValue placeholder="Select Outage Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outage Types</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Unplanned">Unplanned</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Load Shedding">Load Shedding</SelectItem>
                  <SelectItem value="GridCo Outage">GridCo Outage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Status Select */}
            <div>
              <Label htmlFor="status-select" className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={filterStatus || "all"}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger id="status-select" className="mt-1">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Date Range Filters */}
          <div className="mt-4">
             <Label className="text-xs text-muted-foreground">Date Range</Label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Select value={dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by Date Range">
                    {dateRange === "custom-month" && startMonth && endMonth
                      ? `${format(startMonth, "MMM yyyy")} - ${format(endMonth, "MMM yyyy")}`
                      : dateRange === "custom-year" && startYear && endYear
                      ? `${format(startYear, "yyyy")} - ${format(endYear, "yyyy")}`
                      : dateRange === "custom-week" && startWeek && endWeek && selectedYear
                      ? `Week ${startWeek} - Week ${endWeek}, ${format(selectedYear, "yyyy")}`
                      : dateRange === "all"
                      ? "All Time"
                      : dateRange === "week"
                      ? "Last 7 Days"
                      : "Last Year"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                  <SelectItem value="custom-week">Select Week Range</SelectItem>
                  <SelectItem value="custom-month">Select Month Range</SelectItem>
                  <SelectItem value="custom-year">Select Year Range</SelectItem>
                </SelectContent>
              </Select>

              {dateRange === "custom-week" && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Select value={selectedYear?.getFullYear()?.toString()} onValueChange={(value) => handleYearSelect(new Date(parseInt(value), 0))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={startWeek?.toString()} onValueChange={(value) => handleStartWeekSelect(parseInt(value))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="Start Week" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 52 }, (_, i) => i + 1).map(week => (
                        <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="hidden sm:inline">to</span>

                  <Select value={endWeek?.toString()} onValueChange={(value) => handleEndWeekSelect(parseInt(value))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="End Week" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 52 }, (_, i) => i + 1).map(week => (
                        <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {dateRange === "custom-month" && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Popover open={isStartMonthPickerOpen} onOpenChange={setIsStartMonthPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] sm:w-[200px] justify-start text-left font-normal">
                        {startMonth ? format(startMonth, "MMMM yyyy") : "Start Month"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startMonth}
                        onSelect={handleStartMonthSelect}
                        initialFocus
                        disabled={(date) => endMonth ? date > endMonth : false}
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="hidden sm:inline">to</span>

                  <Popover open={isEndMonthPickerOpen} onOpenChange={setIsEndMonthPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] sm:w-[200px] justify-start text-left font-normal">
                        {endMonth ? format(endMonth, "MMMM yyyy") : "End Month"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endMonth}
                        onSelect={handleEndMonthSelect}
                        initialFocus
                        disabled={(date) => startMonth ? date < startMonth : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {dateRange === "custom-year" && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Select value={startYear?.getFullYear()?.toString()} onValueChange={(value) => handleStartYearSelect(new Date(parseInt(value), 0))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="Start Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="hidden sm:inline">to</span>

                  <Select value={endYear?.getFullYear()?.toString()} onValueChange={(value) => handleEndYearSelect(new Date(parseInt(value), 0))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="End Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Export Buttons moved here for better grouping */}
          <div className="flex flex-wrap items-center gap-2 mt-6 border-t pt-4">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportDetailed}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Export Detailed CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportToPDF}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export PDF Report</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportMaterialsToCSV}
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Export Materials CSV</span>
              <span className="sm:hidden">Materials</span>
            </Button>
          </div>
        </Card>

        {/* Showing data range info - kept subtle */}
        {dateRange !== "all" && startDate && endDate && (
          <div className="mb-4 sm:mb-6 text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              Showing data from {format(startDate, 'MMM dd, yyyy')} to {format(endDate, 'MMM dd, yyyy')}
            </span>
          </div>
        )}
        
        {/* Summary Cards Section - unchanged */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="bg-red-50 dark:bg-[#2a2325] border border-red-200 dark:border-red-900 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-red-700 dark:text-red-200">Total Faults</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-red-900 dark:text-red-100">{filteredFaults.length}</div>
              <p className="text-xs text-red-700 dark:text-red-200">
                {filteredFaults.filter((f: any) => f.status === "pending").length} pending
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-50 dark:bg-[#20232a] border border-blue-200 dark:border-blue-900 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-blue-700 dark:text-blue-200">OP5 Faults</CardTitle>
              <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100">
                {filteredFaults.filter((f: any) => 'substationNo' in f).length}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-200">
                {filterRegion || filterDistrict ? `In selected area` : 'Across all regions'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 dark:bg-[#241f2e] border border-purple-200 dark:border-purple-900 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-purple-700 dark:text-purple-200">Control Outages</CardTitle>
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-purple-900 dark:text-purple-100">
                {filteredFaults.filter((f: any) => 'loadMW' in f).length}
              </div>
              <p className="text-xs text-purple-700 dark:text-purple-200">
                {filterRegion || filterDistrict ? `In selected area` : 'Across all regions'}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* MTTR Report Card */}
        <Card className="mb-4 sm:mb-8 border shadow-sm hover:shadow-md transition-shadow duration-200 dark:bg-[#181a1b] dark:border-gray-800">
          <CardHeader className="bg-muted/30 border-b p-4 dark:bg-[#23272e] dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 dark:text-gray-100">
                  <Clock className="h-5 w-5 text-primary dark:text-primary-200" />
                  Mean Time To Repair (MTTR) Report
                  {user?.role === "district_engineer" && user.district && (
                    <span className="text-sm font-normal text-muted-foreground">
                      - {districts.find(d => d.id === user.district)?.name || user.district}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1 dark:text-gray-300">Analysis of repair times for OP5 faults</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs sm:text-sm dark:text-gray-200 dark:border-gray-600">
                {filteredFaults.filter(f => 
                  ('faultLocation' in f || 'substationName' in f) && 
                  f.repairDate && 
                  f.repairEndDate
                ).length} Faults Analyzed
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <Card className="bg-yellow-50 dark:bg-[#2a281f] border border-yellow-200 dark:border-yellow-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-200">Average MTTR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    {(() => {
                      const op5FaultsWithMTTR = filteredFaults.filter(f => 
                        ('faultLocation' in f || 'substationName' in f) && 
                        f.repairDate && 
                        f.repairEndDate
                      );
                      const totalMTTR = op5FaultsWithMTTR.reduce((sum, fault) => {
                        const repairDate = new Date(fault.repairDate);
                        const repairEndDate = new Date(fault.repairEndDate);
                        const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                        return sum + mttr;
                      }, 0);
                      const averageMTTR = op5FaultsWithMTTR.length > 0 ? totalMTTR / op5FaultsWithMTTR.length : 0;
                      return `${averageMTTR.toFixed(2)} hours`;
                    })()}
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-200 mt-1">
                    Across all regions
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 dark:bg-[#2a2820] border border-orange-200 dark:border-orange-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-200">Total Repair Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {(() => {
                      const op5FaultsWithMTTR = filteredFaults.filter(f => 
                        ('faultLocation' in f || 'substationName' in f) && 
                        f.repairDate && 
                        f.repairEndDate
                      );
                      const totalMTTR = op5FaultsWithMTTR.reduce((sum, fault) => {
                        const repairDate = new Date(fault.repairDate);
                        const repairEndDate = new Date(fault.repairEndDate);
                        const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                        return sum + mttr;
                      }, 0);
                      return `${totalMTTR.toFixed(2)} hours`;
                    })()}
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-200 mt-1">
                    Combined repair time
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-50 dark:bg-[#23272e] border border-gray-200 dark:border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-200">Faults with MTTR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {filteredFaults.filter(f => 
                      ('faultLocation' in f || 'substationName' in f) && 
                      f.repairDate && 
                      f.restorationDate
                    ).length}
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-200 mt-1">
                    Out of {filteredFaults.filter(f => 'faultLocation' in f).length} total OP5 faults
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h3 className="text-base font-semibold">
                  {selectedDistrict && selectedDistrict !== "all"
                    ? `MTTR for ${districts.find(d => d.id === selectedDistrict)?.name || selectedDistrict}`
                    : selectedRegion && selectedRegion !== "all"
                      ? `MTTR by District in ${regions.find(r => r.id === selectedRegion)?.name || selectedRegion}`
                      : "MTTR by Region"}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  Average Repair Time (Lower is Better)
                </Badge>
              </div>
              <div className="space-y-4">
                {(() => {
                  let itemsToDisplay: any[] = [];
                  let isDisplayingDistricts = false;

                  if (selectedDistrict && selectedDistrict !== "all") {
                    // Case 1: Specific district selected (by DE or RE)
                    itemsToDisplay = districts.filter(d => d.id === selectedDistrict);
                    isDisplayingDistricts = true;
                  } else if (selectedRegion && selectedRegion !== "all") {
                    // Case 2: Specific region selected, show districts within
                    itemsToDisplay = districts.filter(d => d.regionId === selectedRegion);
                    isDisplayingDistricts = true;
                  } else {
                    // Case 3: No specific region/district, show regions
                    itemsToDisplay = showAllRegions ? regions : regions.slice(0, 1);
                    isDisplayingDistricts = false;
                  }

                  // Filter faults based on the current item (region or district)
                  return itemsToDisplay.map(item => {
                    const itemFaults = filteredFaults.filter(f => 
                      ('faultLocation' in f || 'substationName' in f) && 
                      f.repairDate && 
                      f.repairEndDate && 
                      (isDisplayingDistricts ? f.districtId === item.id : f.regionId === item.id)
                    );
                    const itemMTTR = itemFaults.reduce((sum, fault) => {
                      const repairDate = new Date(fault.repairDate);
                      const repairEndDate = new Date(fault.repairEndDate);
                      const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                      return sum + mttr;
                    }, 0);
                    const avgMTTR = itemFaults.length > 0 ? itemMTTR / itemFaults.length : 0;
                    const totalFaultsInArea = filteredFaults.filter(f => 
                       ('faultLocation' in f) && (isDisplayingDistricts ? f.districtId === item.id : f.regionId === item.id)
                    ).length;
                    return (
                      <div key={item.id} className="space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            {/* Display item name (region or district) */}
                            <span className="font-medium text-sm sm:text-base">{item.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {itemFaults.length} faults
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="font-medium text-sm sm:text-base">{avgMTTR.toFixed(2)} hours</span>
                            <div className="flex-1 sm:w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ 
                                  width: `${(avgMTTR / 5) * 100}%`,  // Scale for 5 hours max
                                  maxWidth: '100%'
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {itemFaults.length} of {totalFaultsInArea} OP5 faults have MTTR data
                        </div>
                      </div>
                    );
                  });
                })()}
                {/* Only show Expand/Collapse button for the default 'MTTR by Region' view */}
                {regions.length > 1 && !(selectedDistrict && selectedDistrict !== "all") && !(selectedRegion && selectedRegion !== "all") && (
                  <div className="flex justify-center mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllRegions(v => !v)}
                    >
                      {showAllRegions ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section with enhanced styling and responsiveness */}
        <div className="mt-8 sm:mt-12">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-1 h-auto bg-muted/50 rounded-lg border border-border/50 shadow-sm mb-6">
              <TabsTrigger value="overview" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <ActivityIcon className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="faults" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Faults</span>
              </TabsTrigger>
              <TabsTrigger value="reliability" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <TrendingUp className="h-4 w-4" />
                <span>Reliability</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Clock className="h-4 w-4" />
                <span>Performance</span>
              </TabsTrigger>
              <TabsTrigger value="materials" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Package className="h-4 w-4" />
                <span>Materials</span>
              </TabsTrigger>
            </TabsList>

            {/* Add padding and subtle background to Tab Content areas */}
            <TabsContent value="overview" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-4">
              {/* Nested Tabs for Recent Faults Table - with active color */}
              <Tabs 
                defaultValue="all" 
                value={overviewRecentFaultsTab} 
                onValueChange={(value) => setOverviewRecentFaultsTab(value as 'all' | 'op5' | 'control')} 
                className="w-full"
              >
                {/* Add framing bg/padding to TabsList */}
                <TabsList className="grid w-full grid-cols-3 max-w-sm mx-auto bg-muted p-1 h-auto rounded-md mb-4"> 
                  <TabsTrigger 
                    value="all" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-colors duration-150"
                  >
                    All Recent
                  </TabsTrigger>
                  <TabsTrigger 
                    value="op5" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-orange-600 transition-colors duration-150"
                  >
                    OP5 Recent
                  </TabsTrigger>
                  <TabsTrigger 
                    value="control" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-purple-600 transition-colors duration-150"
                  >
                    Control Recent
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Recent Faults Card - Now uses filtered data */}
              <Card>
                <CardHeader className="pt-2 pb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base sm:text-lg">Recent Faults</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Latest fault reports based on selected tab
                      </CardDescription>
                    </div>
                    {/* Re-added Export button for this specific table */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-2"
                      onClick={exportRecentFaultsToCSV} // Call the new function
                    >
                      <Download className="mr-1 h-4 w-4" />
                      Export Recent
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Region</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">District</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Occurrence Date</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Type</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Status</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Outage Duration</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Repair Duration</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Estimated Resolution</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Resolution Status</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Customers Affected</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Description</TableHead>
                          <TableHead className="text-xs sm:text-sm py-2 px-2 sm:px-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedFaults.length > 0 ? (
                          paginatedFaults.map((fault: any) => (
                            <TableRow key={fault.id}>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{getRegionName(fault.regionId)}</TableCell>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{getDistrictName(fault.districtId)}</TableCell>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{formatSafeDate(fault.occurrenceDate)}</TableCell>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{
                                op5Faults.some(f => f.id === fault.id) ? 'OP5' : 'Control'
                              }</TableCell>
                              <TableCell className="py-2 px-2 sm:px-4">
                                <span className={`px-2 py-1 rounded-full text-xs ${fault.status === 'pending' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                  {fault.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{
                                fault.occurrenceDate && fault.restorationDate
                                  ? `${((new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                  : 'N/A'
                              }</TableCell>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{
                                fault.repairDate && fault.repairEndDate
                                  ? `${((new Date(fault.repairEndDate).getTime() - new Date(fault.repairDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                  : 'N/A'
                              }</TableCell>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{
                                fault.occurrenceDate && fault.estimatedResolutionTime
                                  ? `${((new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                  : 'N/A'
                              }</TableCell>
                              <TableCell className="py-2 px-2 sm:px-4">
                                {(() => {
                                  if (!fault.occurrenceDate || !fault.restorationDate || !fault.estimatedResolutionTime) {
                                    return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">N/A</span>;
                                  }
                                  const outageDuration = (new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
                                  const estimatedDuration = (new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
                                  
                                  if (outageDuration <= estimatedDuration) {
                                    return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Within Estimate</span>;
                                  } else {
                                    return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Exceeded Estimate</span>;
                                  }
                                })()}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{
                                fault.affectedPopulation
                                  ? (fault.affectedPopulation.rural + fault.affectedPopulation.urban + fault.affectedPopulation.metro)
                                  : fault.customersAffected
                                    ? (fault.customersAffected.rural + fault.customersAffected.urban + fault.customersAffected.metro)
                                    : 'N/A'
                              }</TableCell>
                              <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{
                                fault.outageDescription || fault.description || 'N/A'
                              }</TableCell>
                              <TableCell className="py-2 px-2 sm:px-4">
                                <Button variant="ghost" size="sm" className="h-7 px-1 sm:px-2" onClick={() => showFaultDetails(fault)}>
                                  <Eye size={14} />
                                  <span className="ml-1 hidden sm:inline">View</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                              No recent faults found for the selected type.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
                
                {/* Add pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="flex-1 text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredFaults.length)} of {filteredFaults.length} results
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => (
                          <Button
                            key={i + 1}
                            variant={currentPage === i + 1 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(i + 1)}
                          >
                            {i + 1}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="faults" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              <AnalyticsCharts filteredFaults={filteredFaults} />
            </TabsContent>

            <TabsContent value="reliability" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Updated Rural Reliability Card with color */}
                <Card className="bg-green-50 dark:bg-[#202a23] border border-green-200 dark:border-green-900 hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                      Rural Reliability
                    </CardTitle>
                    <CardDescription className="text-green-700 dark:text-green-200">Indices for rural areas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-green-900 dark:text-green-100">
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">SAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.saidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Avg. Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">SAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.saifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">CAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.caidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Avg. Customer Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">CAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.caifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Customer Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">MAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.maifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Momentary Avg. Interruption Frequency</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Updated Urban Reliability Card with color */}
                <Card className="bg-blue-50 dark:bg-[#20232a] border border-blue-200 dark:border-blue-900 hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      Urban Reliability
                    </CardTitle>
                    <CardDescription className="text-blue-700 dark:text-blue-200">Indices for urban areas</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-4 text-blue-900 dark:text-blue-100">
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">SAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.saidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">SAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.saifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">CAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.caidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Customer Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">CAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.caifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Customer Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">MAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.maifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Momentary Avg. Interruption Frequency</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Updated Metro Reliability Card with color */}
                <Card className="bg-purple-50 dark:bg-[#241f2e] border border-purple-200 dark:border-purple-900 hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-800 dark:text-purple-200">
                      <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                      Metro Reliability
                    </CardTitle>
                    <CardDescription className="text-purple-700 dark:text-purple-200">Indices for metro areas</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-4 text-purple-900 dark:text-purple-100">
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">SAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.saidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">SAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.saifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">CAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.caidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Customer Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">CAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.caifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Customer Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">MAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.maifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Momentary Avg. Interruption Frequency</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              {/* Add Performance Content Here */}
              <p>Performance metrics will be displayed here.</p>
            </TabsContent>

            {renderMaterialsContent()}
          </Tabs>
        </div>
        
        {/* Fault Details Dialog - improved responsiveness */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-md sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedFault && (
              <>
                {/* {console.log('Selected Fault Data:', selectedFault)} */}
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedFault.faultType === 'Unplanned' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                    {selectedFault.faultType === 'Planned' && <Calendar className="h-5 w-5 text-blue-500" />}
                    {selectedFault.faultType === 'Emergency' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                    {selectedFault.faultType === 'Load Shedding' && <ChartIcon className="h-5 w-5 text-purple-500" />}
                    {'loadMW' in selectedFault ? 'Control System Outage Details' : 'OP5 Fault Details'}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{getRegionName(selectedFault.regionId)}, {getDistrictName(selectedFault.districtId)}</span>
                    </div>
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Fault Information</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-muted-foreground">ID</span>
                        <p className="text-sm">{selectedFault.id}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Type</span>
                        <p className="text-sm">
                          <Badge variant="outline" className="mt-1">
                            {selectedFault.faultType}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Status</span>
                        <p className="text-sm">
                          <Badge className={`mt-1 ${
                            selectedFault.status === 'pending' 
                              ? 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-900' 
                              : 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-900'
                          }`}>
                            {selectedFault.status.toUpperCase()}
                          </Badge>
                        </p>
                      </div>
                      {'faultLocation' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Location</span>
                          <p className="text-sm">{selectedFault.faultLocation}</p>
                        </div>
                      )}
                      {'reason' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Reason</span>
                          <p className="text-sm">{selectedFault.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Time & Impact</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Occurrence Date</span>
                        <p className="text-sm">{formatSafeDate(selectedFault.occurrenceDate)}</p>
                      </div>
                      {selectedFault.restorationDate && (
                        <div>
                          <span className="text-xs text-muted-foreground">Restoration Date</span>
                          <p className="text-sm">{formatSafeDate(selectedFault.restorationDate)}</p>
                        </div>
                      )}
                      {'outrageDuration' in selectedFault && selectedFault.outrageDuration && (
                        <div>
                          <span className="text-xs text-muted-foreground">Duration</span>
                          <p className="text-sm">{selectedFault.outrageDuration} minutes</p>
                        </div>
                      )}
                      {'affectedPopulation' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Affected Population</span>
                          <p className="text-sm">
                            Rural: {selectedFault.affectedPopulation.rural}, 
                            Urban: {selectedFault.affectedPopulation.urban}, 
                            Metro: {selectedFault.affectedPopulation.metro}
                          </p>
                        </div>
                      )}
                      {'customersAffected' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Customers Affected</span>
                          <p className="text-sm">
                            Rural: {selectedFault.customersAffected.rural}, 
                            Urban: {selectedFault.customersAffected.urban}, 
                            Metro: {selectedFault.customersAffected.metro}
                          </p>
                        </div>
                      )}
                      {'loadMW' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Load</span>
                          <p className="text-sm">{selectedFault.loadMW} MW</p>
                        </div>
                      )}
                      {'unservedEnergyMWh' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Unserved Energy</span>
                          <p className="text-sm">{selectedFault.unservedEnergyMWh.toFixed(2)} MWh</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Audit Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Created By</span>
                      <p className="text-sm">{getUserNameById(selectedFault.createdBy)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Created At</span>
                      <p className="text-sm">{formatSafeDate(selectedFault.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Updated By</span>
                      <p className="text-sm">{getUserNameById(selectedFault.updatedBy)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Updated At</span>
                      <p className="text-sm">{formatSafeDate(selectedFault.updatedAt)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Link to={`/dashboard?id=${selectedFault.id}`} className="text-primary hover:underline text-sm">
                    View on Dashboard
                  </Link>
                </div>
                {/* Show all fault data for debugging/inspection */}
                <div className="mt-6">
                  <h3 className="text-base sm:text-lg font-bold text-primary mb-4">All Fault Data</h3>
                  {(() => {
                    // Helper functions
                    function formatValue(value) {
                      if (value === null || value === undefined || value === '') return '—';
                      // Firestore timestamp
                      if (typeof value === 'object' && value.seconds && value.nanoseconds) {
                        const date = new Date(value.seconds * 1000);
                        return date.toLocaleString();
                      }
                      // ISO date string
                      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
                        return new Date(value).toLocaleString();
                      }
                      // Object (like affectedPopulation)
                      if (typeof value === 'object' && !Array.isArray(value)) {
                        return (
                          <ul className="ml-2 list-none">
                            {Object.entries(value).map(([k, v]) => (
                              <li key={k}><span className="font-semibold text-gray-500">{formatKey(k)}:</span> {formatValue(v)}</li>
                            ))}
                          </ul>
                        );
                      }
                      // Array
                      if (Array.isArray(value)) {
                        return value.length === 0 ? '—' : (
                          <ul className="ml-2 list-disc">
                            {value.map((v, i) => <li key={i}>{formatValue(v)}</li>)}
                          </ul>
                        );
                      }
                      return String(value);
                    }
                    function formatKey(key) {
                      return key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())
                        .replace(/_/g, ' ');
                    }
                    // Group fields
                    const { regionId, districtId, ...rest } = selectedFault;
                    const groups = [
                      {
                        title: 'General Info',
                        fields: ['id', 'faultType', 'status', 'description', 'createdAt', 'updatedAt', 'mttr'],
                      },
                      {
                        title: 'Location',
                        fields: ['region', 'district', 'substationName', 'substationNo', 'faultLocation'],
                      },
                      {
                        title: 'Timing',
                        fields: ['occurrenceDate', 'repairDate', 'restorationDate'],
                      },
                      {
                        title: 'Impact',
                        fields: ['affectedPopulation', 'materialsUsed', 'loadMW', 'reason'],
                      },
                      // Add Audit Info group for createdBy and updatedBy
                      {
                        title: 'Audit Info',
                        fields: ['createdBy', 'updatedBy'],
                      },
                    ];
                    // Find any extra fields not in groups
                    const groupedFields = groups.flatMap(g => g.fields);
                    const exclude = [];
                    const extraFields = Object.keys(rest)
                      .filter(k => !groupedFields.includes(k) && !exclude.includes(k));
                    if (extraFields.length > 0) {
                      groups.push({ title: 'Other', fields: extraFields });
                    }
                    return (
                      <div className="space-y-4">
                        {groups.map(group => {
                          const groupEntries = group.fields.filter(f => f in rest).map(f => [f, rest[f]]);
                          if (groupEntries.length === 0) return null;
                          return (
                            <section
                              key={group.title}
                              className="bg-gray-50 rounded-lg shadow-sm p-4 sm:p-6 dark:bg-gray-700 dark:shadow-md"
                            >
                              <div className="flex items-center mb-3">
                                <h4 className="text-base sm:text-lg font-bold text-blue-700 tracking-wide uppercase dark:text-blue-300">
                                  {group.title}
                                </h4>
                              </div>
                              <dl className="divide-y divide-gray-200 dark:divide-gray-600">
                                {groupEntries.map(([key, value]) => (
                                  <div key={key} className="py-2 flex flex-col sm:flex-row sm:items-center">
                                    <dt className="text-xs sm:text-sm font-semibold text-gray-500 uppercase w-40 sm:w-56 flex-shrink-0 dark:text-gray-400">
                                      {formatKey(key)}
                                    </dt>
                                    <dd className="ml-0 sm:ml-4 text-sm sm:text-base text-gray-900 break-words dark:text-gray-200">
                                      { /* Use helper function for createdBy and updatedBy */ }
                                      { (key === 'createdBy' || key === 'updatedBy') 
                                          ? getUserNameById(value as string) 
                                          : formatValue(value)
                                      }
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </section>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

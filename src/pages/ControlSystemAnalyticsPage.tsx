import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { Download, FileText, Filter, AlertTriangle, Users, Zap, Clock, TrendingUp, Table, BarChart3, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  Cell,
  LineChart,
  Line
} from 'recharts';
import { FeederManagement } from "@/components/analytics/FeederManagement";
import { useNavigate } from "react-router-dom";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ControlSystemAnalyticsPage() {
  const { user, isAuthenticated } = useAuth();
  const { controlSystemOutages, regions, districts } = useData();
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedWeekYear, setSelectedWeekYear] = useState<number | undefined>(undefined);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | undefined>(undefined);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [outageType, setOutageType] = useState<'all' | 'sustained' | 'momentary'>('all');
  const [filterFaultType, setFilterFaultType] = useState<string>("all");
  const [view, setView] = useState<'charts' | 'table'>('charts');
  const [sortField, setSortField] = useState<string>('occurrenceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>("overview");
  const navigate = useNavigate();

  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [paginatedOutages, setPaginatedOutages] = useState<any[]>([]);

  // Cache for total count
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Add page size options
  const pageSizeOptions = [10, 25, 50, 100];

  // Add loading state for total count
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  // Add column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    occurrenceDate: true,
    region: true,
    district: true,
    faultType: true,
    specificFaultType: true,
    description: true,
    feederName: true,
    voltageLevel: true,
    ruralCustomers: true,
    urbanCustomers: true,
    metroCustomers: true,
    totalCustomers: true,
    ruralCID: true,
    urbanCID: true,
    metroCID: true,
    customerInterruptionDuration: true,
    ruralCIF: true,
    urbanCIF: true,
    metroCIF: true,
    customerInterruptionFrequency: true,
    totalFeederCustomers: true,
    unservedEnergy: true,
    repairDuration: true,
    outageDuration: true,
    load: true,
    status: true,
    controlPanelIndications: true,
    areaAffected: true,
    restorationDateTime: true
  });

  // Add clear filters function
  const clearFilters = () => {
    setFilterRegion(undefined);
    setFilterDistrict(undefined);
    setDateRange("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedWeek(undefined);
    setSelectedMonth(undefined);
    setSelectedYear(undefined);
    setSelectedWeekYear(undefined);
    setSelectedMonthYear(undefined);
    setOutageType("all");
    setFilterFaultType("all");
    setSearchQuery("");
    setSortField("occurrenceDate");
    setSortDirection("desc");
    setCurrentPage(1);
    loadData(true);
  };

  // Column definitions
  const columns = [
    { id: 'occurrenceDate', label: 'Occurrence Date', sortField: 'occurrenceDate' },
    { id: 'region', label: 'Region', sortField: 'regionId' },
    { id: 'district', label: 'District', sortField: 'districtId' },
    { id: 'faultType', label: 'Fault Type', sortField: 'faultType' },
    { id: 'specificFaultType', label: 'Specific Fault Type', sortField: 'specificFaultType' },
    { id: 'description', label: 'Description', sortField: 'description' },
    { id: 'feederName', label: 'Feeder Name', sortField: 'feederName' },
    { id: 'voltageLevel', label: 'Voltage Level', sortField: 'voltageLevel' },
    { id: 'ruralCustomers', label: 'Rural Customers Affected', sortField: 'customersAffected.rural' },
    { id: 'urbanCustomers', label: 'Urban Customers Affected', sortField: 'customersAffected.urban' },
    { id: 'metroCustomers', label: 'Metro Customers Affected', sortField: 'customersAffected.metro' },
    { id: 'totalCustomers', label: 'Total Customers Affected', sortField: 'customersAffected' },
    { id: 'ruralCID', label: 'Rural CID (hrs)', sortField: 'customerInterruptionDuration.rural' },
    { id: 'urbanCID', label: 'Urban CID (hrs)', sortField: 'customerInterruptionDuration.urban' },
    { id: 'metroCID', label: 'Metro CID (hrs)', sortField: 'customerInterruptionDuration.metro' },
    { id: 'customerInterruptionDuration', label: 'Total CID (hrs)', sortField: 'customerInterruptionDuration' },
    { id: 'ruralCIF', label: 'Rural CIF', sortField: 'customerInterruptionFrequency.rural' },
    { id: 'urbanCIF', label: 'Urban CIF', sortField: 'customerInterruptionFrequency.urban' },
    { id: 'metroCIF', label: 'Metro CIF', sortField: 'customerInterruptionFrequency.metro' },
    { id: 'customerInterruptionFrequency', label: 'Total CIF', sortField: 'customerInterruptionFrequency' },
    { id: 'totalFeederCustomers', label: 'Total Feeder Customers', sortField: 'feederCustomers' },
    { id: 'repairDuration', label: 'Repair Duration (hrs)', sortField: 'repairStartDate' },
    { id: 'outageDuration', label: 'Outage Duration (hrs)', sortField: 'restorationDate' },
    { id: 'load', label: 'Load (MW)', sortField: 'loadMW' },
    { id: 'unservedEnergy', label: 'Unserved Energy (MWh)', sortField: 'unservedEnergyMWh' },
    { id: 'status', label: 'Status' },
    { id: 'controlPanelIndications', label: 'Indications on Control Panel', sortField: 'controlPanelIndications' },
    { id: 'areaAffected', label: 'Area Affected', sortField: 'areaAffected' },
    { id: 'restorationDateTime', label: 'Restoration Date & Time', sortField: 'restorationDate' }
  ];

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId as keyof typeof prev]
    }));
  };

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${filterRegion}-${filterDistrict}-${dateRange}-${outageType}-${filterFaultType}-${user?.role}-${user?.region}-${user?.district}`;
  }, [filterRegion, filterDistrict, dateRange, outageType, filterFaultType, user]);

  // Load data with server-side pagination
  const loadData = useCallback(async (resetPagination = false) => {
    setIsLoading(true);
    try {
      console.log('[loadData] Starting data load with filters:', {
        filterRegion,
        filterDistrict,
        dateRange,
        startDate,
        endDate,
        selectedWeek,
        selectedMonth,
        selectedYear,
        filterFaultType,
        userRole: user?.role,
        userRegion: user?.region,
        userDistrict: user?.district,
        pageSize
      });

      const outagesRef = collection(db, "controlOutages");
      let q = query(outagesRef);

      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        q = query(q, where("regionId", "==", user.region));
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager') {
        q = query(q, where("districtId", "==", user.district));
      }

      // Apply filters
      if (filterRegion && filterRegion !== "all") {
        q = query(q, where("regionId", "==", filterRegion));
      }
      if (filterDistrict && filterDistrict !== "all") {
        q = query(q, where("districtId", "==", filterDistrict));
      }
      if (filterFaultType && filterFaultType !== "all") {
        q = query(q, where("faultType", "==", filterFaultType));
      }

      // Apply date range filter
      if (dateRange !== "all") {
        let start, end;
        
        if (dateRange === "custom" && startDate && endDate) {
          start = startOfDay(startDate);
          end = endOfDay(endDate);
        } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
          const year = selectedWeekYear;
          const weekStart = startOfWeek(new Date(year, 0, 1));
          weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
          start = startOfWeek(weekStart);
          end = endOfWeek(weekStart);
        } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
          const year = selectedMonthYear;
          const monthStart = new Date(year, selectedMonth, 1);
          start = startOfMonth(monthStart);
          end = endOfMonth(monthStart);
        } else if (dateRange === "year" && selectedYear !== undefined) {
          start = startOfYear(new Date(selectedYear, 0, 1));
          end = endOfYear(new Date(selectedYear, 0, 1));
        } else {
          const now = new Date();
          const cutoff = new Date();
          
          if (dateRange === "7days") {
            cutoff.setDate(now.getDate() - 7);
          } else if (dateRange === "30days") {
            cutoff.setDate(now.getDate() - 30);
          } else if (dateRange === "90days") {
            cutoff.setDate(now.getDate() - 90);
          }
          
          start = startOfDay(cutoff);
          end = endOfDay(now);
        }
        
        q = query(q, where("occurrenceDate", ">=", start));
        q = query(q, where("occurrenceDate", "<=", end));
      }

      // Get total count from cache or server
      const cacheKey = getCacheKey();
      let totalCount = totalCountCache[cacheKey];
      
      if (!totalCount) {
        setIsLoadingCount(true);
        try {
          console.log('[loadData] Getting count from server');
          const countSnapshot = await getCountFromServer(q);
          totalCount = countSnapshot.data().count;
          setTotalCountCache(prev => ({ ...prev, [cacheKey]: totalCount }));
        } finally {
          setIsLoadingCount(false);
        }
      }
      
      console.log('[loadData] Total count:', totalCount);
      setTotalItems(totalCount);
      
      // Reset pagination if filters changed
      if (resetPagination) {
        setCurrentPage(1);
        setLastVisible(null);
        setHasMore(true);
      }
      
      // Apply pagination
      q = query(
        q,
        orderBy(sortField, sortDirection),
        limit(pageSize)
      );
      
      if (lastVisible && !resetPagination) {
        q = query(q, startAfter(lastVisible));
      }

      console.log('[loadData] Executing final query');
      const querySnapshot = await getDocs(q);
      console.log('[loadData] Query results:', {
        docsCount: querySnapshot.docs.length,
        firstDoc: querySnapshot.docs[0]?.data(),
        lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1]?.data()
      });

      const lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastVisibleDoc);
      setHasMore(querySnapshot.docs.length === pageSize);

      const outages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('[loadData] Setting paginated outages:', outages.length);
      setPaginatedOutages(outages);
    } catch (error) {
      console.error('[loadData] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    filterRegion,
    filterDistrict,
    dateRange,
    startDate,
    endDate,
    selectedWeek,
    selectedMonth,
    selectedYear,
    filterFaultType,
    user,
    sortField,
    sortDirection,
    pageSize,
    lastVisible,
    getCacheKey
  ]);

  // Add initial data load
  useEffect(() => {
    console.log('[Initial Load] Starting initial data load');
    loadData(true);
  }, []); // Empty dependency array for initial load only

  // Load data when filters change
  useEffect(() => {
    loadData(true);
  }, [filterRegion, filterDistrict, dateRange, filterFaultType, sortField, sortDirection]);

  // Load next page
  const loadNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  };

  // Load previous page
  const loadPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      loadData(true);
    }
  };

  // Define all possible fault types
  const faultTypes = [
    "Planned",
    "Unplanned",
    "Emergency",
    "ECG Load Shedding",
    "GridCo Outages"
  ];

  // Filter outages based on selected criteria
  const filteredOutages = controlSystemOutages?.filter(outage => {
    if (filterRegion && filterRegion !== "all" && outage.regionId !== filterRegion) return false;
    if (filterDistrict && filterDistrict !== "all" && outage.districtId !== filterDistrict) return false;
    if (filterFaultType && filterFaultType !== "all" && outage.faultType !== filterFaultType) return false;
    
    if (dateRange !== "all") {
      const now = new Date();
      const cutoff = new Date();
      
      if (dateRange === "7days") {
        cutoff.setDate(now.getDate() - 7);
      } else if (dateRange === "30days") {
        cutoff.setDate(now.getDate() - 30);
      } else if (dateRange === "90days") {
        cutoff.setDate(now.getDate() - 90);
      }
      
      return new Date(outage.occurrenceDate) >= cutoff;
    }

    // Filter by outage type (sustained/momentary)
    if (outageType !== 'all' && outage.occurrenceDate && outage.restorationDate) {
      const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60); // duration in minutes
      if (outageType === 'sustained' && duration <= 5) return false;
      if (outageType === 'momentary' && duration > 5) return false;
    }
    
    return true;
  }) || [];

  // Calculate metrics
  const calculateMetrics = () => {
    const totalOutages = filteredOutages.length;
    const totalCustomersAffected = filteredOutages.reduce((sum, outage) => {
      const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
      return sum + rural + urban + metro;
    }, 0);
    
    const totalUnservedEnergy = filteredOutages.reduce((sum, outage) => 
      sum + (outage.unservedEnergyMWh || 0), 0
    );
    
    const avgOutageDuration = filteredOutages.reduce((sum, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime();
        return sum + duration;
      }
      return sum;
    }, 0) / (totalOutages || 1);

    // Calculate Customer Interruption Duration (CID)
    const customerInterruptionDuration = filteredOutages.reduce((sum, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60); // hours
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        return sum + (duration * (rural + urban + metro));
      }
      return sum;
    }, 0);

    // Calculate Customer Interruption Frequency (CIF)
    const customerInterruptionFrequency = filteredOutages.reduce((sum, outage) => {
      const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
      return sum + (rural > 0 ? 1 : 0) + (urban > 0 ? 1 : 0) + (metro > 0 ? 1 : 0);
    }, 0);

    // Calculate Repair Durations
    const repairDurations = filteredOutages.reduce((sum, outage) => {
      if (outage.repairStartDate && outage.repairEndDate) {
        const duration = new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime();
        return sum + duration;
      }
      return sum;
    }, 0) / (totalOutages || 1);

    return {
      totalOutages,
      totalCustomersAffected,
      totalUnservedEnergy,
      avgOutageDuration: avgOutageDuration / (1000 * 60 * 60), // Convert to hours
      customerInterruptionDuration,
      customerInterruptionFrequency,
      repairDurations: repairDurations / (1000 * 60 * 60) // Convert to hours
    };
  };

  const metrics = calculateMetrics();

  // Prepare chart data
  const prepareChartData = () => {
    // Outages by type
    const outagesByType = filteredOutages.reduce((acc, outage) => {
      acc[outage.faultType] = (acc[outage.faultType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Outages by voltage level
    const outagesByVoltage = filteredOutages.reduce((acc, outage) => {
      acc[outage.voltageLevel || 'Unknown'] = (acc[outage.voltageLevel || 'Unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Monthly trend
    const monthlyTrend = filteredOutages.reduce((acc, outage) => {
      const month = format(new Date(outage.occurrenceDate), 'MMM yyyy');
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Add repair duration by type
    const repairDurationByType = filteredOutages.reduce((acc, outage) => {
      if (outage.repairStartDate && outage.repairEndDate) {
        const duration = (new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60); // hours
        acc[outage.faultType] = (acc[outage.faultType] || 0) + duration;
      }
      return acc;
    }, {} as Record<string, number>);

    // Add customer interruption duration by type
    const customerInterruptionDurationByType = filteredOutages.reduce((acc, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60); // hours
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        const totalCustomers = rural + urban + metro;
        acc[outage.faultType] = (acc[outage.faultType] || 0) + (duration * totalCustomers);
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      byType: Object.entries(outagesByType).map(([name, value]) => ({ name, value })),
      byVoltage: Object.entries(outagesByVoltage).map(([name, value]) => ({ name, value })),
      monthlyTrend: Object.entries(monthlyTrend).map(([name, value]) => ({ name, value })),
      repairDurationByType: Object.entries(repairDurationByType).map(([name, value]) => ({ name, value })),
      customerInterruptionDurationByType: Object.entries(customerInterruptionDurationByType).map(([name, value]) => ({ name, value }))
    };
  };

  const chartData = prepareChartData();

  // Export functions
  const exportToCSV = () => {
    const formatDate = (dateString: string | undefined | null) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd HH:mm');
    };

    // Define all possible headers with their corresponding data accessors
    const allColumns = [
      { id: 'occurrenceDate', label: 'Occurrence Date', accessor: (outage: any) => formatDate(outage.occurrenceDate) },
      { id: 'region', label: 'Region', accessor: (outage: any) => regions.find(r => r.id === outage.regionId)?.name || '' },
      { id: 'district', label: 'District', accessor: (outage: any) => districts.find(d => d.id === outage.districtId)?.name || '' },
      { id: 'faultType', label: 'Fault Type', accessor: (outage: any) => outage.faultType || '' },
      { id: 'specificFaultType', label: 'Specific Fault Type', accessor: (outage: any) => outage.specificFaultType || '' },
      { id: 'description', label: 'Description', accessor: (outage: any) => outage.description || '' },
      { id: 'feederName', label: 'Feeder Name', accessor: (outage: any) => outage.feederName || '' },
      { id: 'voltageLevel', label: 'Voltage Level', accessor: (outage: any) => outage.voltageLevel || '' },
      { id: 'ruralCustomers', label: 'Rural Customers Affected', accessor: (outage: any) => (outage.customersAffected?.rural || 0).toString() },
      { id: 'urbanCustomers', label: 'Urban Customers Affected', accessor: (outage: any) => (outage.customersAffected?.urban || 0).toString() },
      { id: 'metroCustomers', label: 'Metro Customers Affected', accessor: (outage: any) => (outage.customersAffected?.metro || 0).toString() },
      { id: 'totalCustomers', label: 'Total Customers Affected', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        return (rural + urban + metro).toString();
      }},
      { id: 'ruralCID', label: 'Rural CID (hrs)', accessor: (outage: any) => {
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * (outage.customersAffected?.rural || 0)).toFixed(2);
      }},
      { id: 'urbanCID', label: 'Urban CID (hrs)', accessor: (outage: any) => {
      const outageDuration = outage.occurrenceDate && outage.restorationDate
        ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * (outage.customersAffected?.urban || 0)).toFixed(2);
      }},
      { id: 'metroCID', label: 'Metro CID (hrs)', accessor: (outage: any) => {
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
          : 0;
        return (outageDuration * (outage.customersAffected?.metro || 0)).toFixed(2);
      }},
      { id: 'customerInterruptionDuration', label: 'Total CID (hrs)', accessor: (outage: any) => {
      const totalCustomers = (outage.customersAffected?.rural || 0) + 
                           (outage.customersAffected?.urban || 0) + 
                           (outage.customersAffected?.metro || 0);
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * totalCustomers).toFixed(2);
      }},
      { id: 'ruralCIF', label: 'Rural CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.rural > 0 ? '1' : '0');
      }},
      { id: 'urbanCIF', label: 'Urban CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.urban > 0 ? '1' : '0');
      }},
      { id: 'metroCIF', label: 'Metro CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.metro > 0 ? '1' : '0');
      }},
      { id: 'customerInterruptionFrequency', label: 'Total CIF', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        return ((rural > 0 ? 1 : 0) + (urban > 0 ? 1 : 0) + (metro > 0 ? 1 : 0)).toString();
      }},
      { id: 'totalFeederCustomers', label: 'Total Feeder Customers', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.feederCustomers || {};
        return (rural + urban + metro).toString();
      }},
      { id: 'repairDuration', label: 'Repair Duration (hrs)', accessor: (outage: any) => {
        if (outage.repairStartDate && outage.repairEndDate) {
          return ((new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60)).toFixed(2);
        }
        return '0.00';
      }},
      { id: 'outageDuration', label: 'Outage Duration (hrs)', accessor: (outage: any) => {
        if (outage.occurrenceDate && outage.restorationDate) {
          return ((new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2);
        }
        return '0.00';
      }},
      { id: 'load', label: 'Load (MW)', accessor: (outage: any) => outage.loadMW?.toFixed(2) || '' },
      { id: 'unservedEnergy', label: 'Unserved Energy (MWh)', accessor: (outage: any) => outage.unservedEnergyMWh?.toFixed(2) || '0.00' },
      { id: 'status', label: 'Status', accessor: (outage: any) => outage.status || '' },
      { id: 'controlPanelIndications', label: 'Indications on Control Panel', accessor: (outage: any) => outage.controlPanelIndications || '' },
      { id: 'areaAffected', label: 'Area Affected', accessor: (outage: any) => outage.areaAffected || '' },
      { id: 'restorationDateTime', label: 'Restoration Date & Time', accessor: (outage: any) => formatDate(outage.restorationDate) }
    ];

    // Filter columns based on visibility
    const visibleColumnDefinitions = allColumns.filter(col => visibleColumns[col.id as keyof typeof visibleColumns]);

    // Get headers from visible columns
    const headers = visibleColumnDefinitions.map(col => col.label);

    // Generate data rows
    const dataRows = filteredOutages.map(outage => {
      return visibleColumnDefinitions
        .map(col => `"${col.accessor(outage)}"`)
        .join(',');
    });

    const csvContent = [headers.join(','), ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `control-system-outages-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderChart = (data: any[], dataKey: string = 'value', nameKey: string = 'name') => {
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={dataKey} fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey={dataKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  // Sort and filter table data
  const getSortedAndFilteredData = () => {
    let data = [...filteredOutages];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(outage => 
        outage.faultType?.toLowerCase().includes(query) ||
        outage.description?.toLowerCase().includes(query) ||
        outage.feederName?.toLowerCase().includes(query) ||
        outage.voltageLevel?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    data.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle date fields
      if (sortField === 'occurrenceDate' || sortField === 'restorationDate' || 
          sortField === 'repairStartDate' || sortField === 'repairEndDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle customer affected fields
      if (sortField === 'customersAffected') {
        const aTotal = (a.customersAffected?.rural || 0) + (a.customersAffected?.urban || 0) + (a.customersAffected?.metro || 0);
        const bTotal = (b.customersAffected?.rural || 0) + (b.customersAffected?.urban || 0) + (b.customersAffected?.metro || 0);
        aValue = aTotal;
        bValue = bTotal;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return data;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderTable = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search outages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[300px] max-h-[400px] overflow-y-auto">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Search input */}
                <div className="px-2 py-2">
                  <Input
                    placeholder="Search columns..."
                    className="h-8"
                    onChange={(e) => {
                      const searchTerm = e.target.value.toLowerCase();
                      const filteredColumns = columns.filter(col => 
                        col.label.toLowerCase().includes(searchTerm)
                      );
                      // Update visible columns based on search
                      const newVisibleColumns = { ...visibleColumns };
                      Object.keys(newVisibleColumns).forEach(key => {
                        newVisibleColumns[key as keyof typeof newVisibleColumns] = 
                          filteredColumns.some(col => col.id === key);
                      });
                      setVisibleColumns(newVisibleColumns);
                    }}
                  />
                </div>
                
                {/* Basic Information */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Basic Information
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['occurrenceDate', 'region', 'district', 'faultType', 'specificFaultType', 'description'].includes(col.id)
                  ).map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                      onCheckedChange={() => toggleColumn(col.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Checkbox
                          checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                          onCheckedChange={() => toggleColumn(col.id)}
                          className="h-4 w-4"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        />
                        <span 
                          className="flex-1 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleColumn(col.id);
                          }}
                        >
                          {col.label}
                        </span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                
                {/* Technical Details */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Technical Details
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['feederName', 'voltageLevel', 'load', 'unservedEnergy', 'controlPanelIndications', 'areaAffected'].includes(col.id)
                  ).map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                      onCheckedChange={() => toggleColumn(col.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Checkbox
                          checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                          onCheckedChange={() => toggleColumn(col.id)}
                          className="h-4 w-4"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        />
                        <span 
                          className="flex-1 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleColumn(col.id);
                          }}
                        >
                          {col.label}
                        </span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                
                {/* Customer Impact */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Customer Impact
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['ruralCustomers', 'urbanCustomers', 'metroCustomers', 'totalCustomers', 
                     'ruralCID', 'urbanCID', 'metroCID', 'customerInterruptionDuration',
                     'ruralCIF', 'urbanCIF', 'metroCIF', 'customerInterruptionFrequency',
                     'totalFeederCustomers'].includes(col.id)
                  ).map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                      onCheckedChange={() => toggleColumn(col.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Checkbox
                          checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                          onCheckedChange={() => toggleColumn(col.id)}
                          className="h-4 w-4"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        />
                        <span 
                          className="flex-1 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleColumn(col.id);
                          }}
                        >
                          {col.label}
                        </span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                
                {/* Duration & Status */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Duration & Status
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['repairDuration', 'outageDuration', 'status', 'restorationDateTime'].includes(col.id)
                  ).map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                      onCheckedChange={() => toggleColumn(col.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Checkbox
                          checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                          onCheckedChange={() => toggleColumn(col.id)}
                          className="h-4 w-4"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        />
                        <span 
                          className="flex-1 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleColumn(col.id);
                          }}
                        >
                          {col.label}
                        </span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                
                {/* Quick Actions */}
                <div className="px-2 py-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const newVisibleColumns = { ...visibleColumns };
                      Object.keys(newVisibleColumns).forEach(key => {
                        newVisibleColumns[key as keyof typeof newVisibleColumns] = true;
                      });
                      setVisibleColumns(newVisibleColumns);
                    }}
                  >
                    Show All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const newVisibleColumns = { ...visibleColumns };
                      Object.keys(newVisibleColumns).forEach(key => {
                        newVisibleColumns[key as keyof typeof newVisibleColumns] = false;
                      });
                      setVisibleColumns(newVisibleColumns);
                    }}
                  >
                    Hide All
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </div>
        <div className="rounded-md border">
          <TableComponent>
            <TableHeader>
              <TableRow>
                {columns.map((column) => 
                  visibleColumns[column.id as keyof typeof visibleColumns] && (
                <TableHead 
                      key={column.id}
                      className={column.sortField ? "cursor-pointer" : ""}
                      onClick={() => column.sortField && handleSort(column.sortField)}
                >
                      {column.label}
                      {column.sortField && sortField === column.sortField && (
                        sortDirection === 'asc' ? ' ↑' : ' ↓'
                      )}
                </TableHead>
                  )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading data...
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedOutages.length > 0 ? (
                paginatedOutages.map((outage) => {
                  const totalCustomers = (outage.customersAffected?.rural || 0) + 
                                      (outage.customersAffected?.urban || 0) + 
                                      (outage.customersAffected?.metro || 0);
                
                const outageDuration = outage.occurrenceDate && outage.restorationDate
                  ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
                  : 0;

                  const customerInterruptionDuration = outage.occurrenceDate && outage.restorationDate
                    ? (outageDuration * totalCustomers)
                    : 0;

                  const customerInterruptionFrequency = 
                    (outage.customersAffected?.rural > 0 ? 1 : 0) +
                    (outage.customersAffected?.urban > 0 ? 1 : 0) +
                    (outage.customersAffected?.metro > 0 ? 1 : 0);

                  const totalFeederCustomers = (outage.feederCustomers?.rural || 0) + 
                                            (outage.feederCustomers?.urban || 0) + 
                                            (outage.feederCustomers?.metro || 0);

                return (
                  <TableRow key={outage.id}>
                      {visibleColumns.occurrenceDate && (
                    <TableCell>{format(new Date(outage.occurrenceDate), 'yyyy-MM-dd HH:mm')}</TableCell>
                      )}
                      {visibleColumns.region && (
                        <TableCell>{regions.find(r => r.id === outage.regionId)?.name || '-'}</TableCell>
                      )}
                      {visibleColumns.district && (
                        <TableCell>{districts.find(d => d.id === outage.districtId)?.name || '-'}</TableCell>
                      )}
                      {visibleColumns.faultType && (
                        <TableCell>{outage.faultType || '-'}</TableCell>
                      )}
                      {visibleColumns.specificFaultType && (
                    <TableCell>{outage.specificFaultType || '-'}</TableCell>
                      )}
                      {visibleColumns.description && (
                        <TableCell className="max-w-[200px] truncate" title={outage.description || ''}>
                          {outage.description || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.feederName && (
                        <TableCell>{outage.feederName || '-'}</TableCell>
                      )}
                      {visibleColumns.voltageLevel && (
                        <TableCell>{outage.voltageLevel || '-'}</TableCell>
                      )}
                      {visibleColumns.ruralCustomers && (
                        <TableCell>{outage.customersAffected?.rural || 0}</TableCell>
                      )}
                      {visibleColumns.urbanCustomers && (
                        <TableCell>{outage.customersAffected?.urban || 0}</TableCell>
                      )}
                      {visibleColumns.metroCustomers && (
                        <TableCell>{outage.customersAffected?.metro || 0}</TableCell>
                      )}
                      {visibleColumns.totalCustomers && (
                    <TableCell>{totalCustomers}</TableCell>
                      )}
                      {visibleColumns.ruralCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.rural || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.urbanCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.urban || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.metroCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.metro || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.customerInterruptionDuration && (
                        <TableCell>{customerInterruptionDuration.toFixed(2)}</TableCell>
                      )}
                      {visibleColumns.ruralCIF && (
                        <TableCell>
                          {outage.customersAffected?.rural > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.urbanCIF && (
                        <TableCell>
                          {outage.customersAffected?.urban > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.metroCIF && (
                        <TableCell>
                          {outage.customersAffected?.metro > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.customerInterruptionFrequency && (
                        <TableCell>{customerInterruptionFrequency}</TableCell>
                      )}
                      {visibleColumns.totalFeederCustomers && (
                        <TableCell>{totalFeederCustomers}</TableCell>
                      )}
                      {visibleColumns.repairDuration && (
                        <TableCell>
                          {outage.repairStartDate && outage.repairEndDate 
                            ? ((new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.outageDuration && (
                        <TableCell>{outageDuration.toFixed(2)}</TableCell>
                      )}
                      {visibleColumns.load && (
                        <TableCell>{outage.loadMW?.toFixed(2) || '-'}</TableCell>
                      )}
                      {visibleColumns.unservedEnergy && (
                        <TableCell>{outage.unservedEnergyMWh?.toFixed(2) || '0.00'}</TableCell>
                      )}
                      {visibleColumns.status && (
                    <TableCell>
                      <Badge variant={outage.status === 'resolved' ? 'default' : 'destructive'}>
                        {outage.status}
                      </Badge>
                    </TableCell>
                      )}
                      {visibleColumns.controlPanelIndications && (
                        <TableCell className="max-w-[200px] truncate" title={outage.controlPanelIndications || ''}>
                          {outage.controlPanelIndications || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.areaAffected && (
                        <TableCell className="max-w-[200px] truncate" title={outage.areaAffected || ''}>
                          {outage.areaAffected || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.restorationDateTime && (
                        <TableCell>
                          {outage.restorationDate ? format(new Date(outage.restorationDate), 'yyyy-MM-dd HH:mm') : '-'}
                        </TableCell>
                      )}
                  </TableRow>
                );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center text-muted-foreground">
                    No outages found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </TableComponent>
        </div>
        
        {/* Pagination controls */}
        {totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex-1 text-sm text-muted-foreground">
              {isLoadingCount ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading total count...
                </div>
              ) : (
                `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} results`
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreviousPage}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadNextPage}
                disabled={!hasMore || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
        } else {
          // Set to "all" if no specific region
          setFilterRegion(undefined);
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
        }
      } else {
        // For system admins and global engineers, set to "all" by default
        setFilterRegion(undefined);
        setFilterDistrict(undefined);
      }
    } else {
      // Set default to "all" when no user role restrictions
      setFilterRegion(undefined);
    }
  }, [isAuthenticated, user, navigate, regions, districts]);

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Control System Analytics</h1>
            <p className="text-muted-foreground">Analyze control system outages and their impact</p>
          </div>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportToCSV}
          >
            <Download className="h-4 w-4" />
            Export to CSV
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="overview" className="text-base">Overview</TabsTrigger>
            <TabsTrigger value="feeder" className="text-base">
              <span className="block md:hidden">Feeder</span>
              <span className="hidden md:inline">Feeder Management</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Filters Section */}
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Filters</h3>
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select
                    value={filterRegion || ""}
                    onValueChange={setFilterRegion}
                    disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "district_manager" || user?.role === "regional_general_manager"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {regions.map(region => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  <Select
                    value={filterDistrict || ""}
                    onValueChange={setFilterDistrict}
                    disabled={user?.role === "district_engineer" || user?.role === "district_manager"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts
                        .filter(d => !filterRegion || d.regionId === filterRegion)
                        .map(district => (
                          <SelectItem key={district.id} value={district.id}>
                            {district.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                      <SelectItem value="week">By Week</SelectItem>
                      <SelectItem value="month">By Month</SelectItem>
                      <SelectItem value="year">By Year</SelectItem>
                    </SelectContent>
                  </Select>
                  {dateRange === "custom" && (
                    <RangePicker
                      allowClear
                      value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
                      onChange={(dates) => {
                        if (dates && dates[0] && dates[1]) {
                          setStartDate(dates[0].toDate());
                          setEndDate(dates[1].toDate());
                        } else {
                          setStartDate(undefined);
                          setEndDate(undefined);
                        }
                      }}
                      format="YYYY-MM-DD"
                      className="w-full"
                    />
                  )}
                  {dateRange === "week" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Week</Label>
                        <Select
                          value={selectedWeek?.toString()}
                          onValueChange={(value) => setSelectedWeek(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select week" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 52 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                Week {i + 1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Year</Label>
                        <Select
                          value={selectedWeekYear?.toString()}
                          onValueChange={(value) => setSelectedWeekYear(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => {
                              const year = new Date().getFullYear() - i;
                              return (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {dateRange === "month" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Month</Label>
                        <Select
                          value={selectedMonth?.toString()}
                          onValueChange={(value) => setSelectedMonth(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {format(new Date(2024, i, 1), "MMMM")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Year</Label>
                        <Select
                          value={selectedMonthYear?.toString()}
                          onValueChange={(value) => setSelectedMonthYear(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => {
                              const year = new Date().getFullYear() - i;
                              return (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {dateRange === "year" && (
                    <Select
                      value={selectedYear?.toString()}
                      onValueChange={(value) => setSelectedYear(Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Outage Type</Label>
                  <Select 
                    value={outageType} 
                    onValueChange={(value: 'all' | 'sustained' | 'momentary') => setOutageType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outage type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outages</SelectItem>
                      <SelectItem value="sustained">Sustained ({'>'}5 min)</SelectItem>
                      <SelectItem value="momentary">Momentary (≤5 min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fault Type</Label>
                  <Select value={filterFaultType} onValueChange={setFilterFaultType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fault type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fault Types</SelectItem>
                      {faultTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <Card className="p-6 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Outages</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{metrics.totalOutages}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Customers Affected</CardTitle>
                  <Users className="h-4 w-4 text-green-500 dark:text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">{metrics.totalCustomersAffected}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Customer Interruption Duration</CardTitle>
                  <Clock className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{metrics.customerInterruptionDuration.toFixed(2)} hrs</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Customer Interruption Frequency</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{metrics.customerInterruptionFrequency}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-300">Avg. Repair Duration</CardTitle>
                  <Clock className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{metrics.repairDurations.toFixed(2)} hrs</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Unserved Energy</CardTitle>
                  <Zap className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{metrics.totalUnservedEnergy.toFixed(2)} MWh</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Outages by Type</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Distribution of outage types</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderChart(chartData.byType)}
                </CardContent>
              </Card>
              <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Outages by Voltage Level</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Distribution by voltage level</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderChart(chartData.byVoltage)}
                </CardContent>
              </Card>
              <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Repair Duration by Type</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Average repair duration for each outage type</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderChart(chartData.repairDurationByType)}
                </CardContent>
              </Card>
              <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Customer Interruption Duration by Type</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Total customer interruption duration by outage type</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderChart(chartData.customerInterruptionDurationByType)}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2 p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Monthly Trend</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Number of outages over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderChart(chartData.monthlyTrend)}
                </CardContent>
              </Card>
            </div>

            {/* Table Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Outage Details Table</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pageSize">Rows per page:</Label>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setCurrentPage(1);
                        loadData(true);
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {pageSizeOptions.map(size => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {renderTable()}
            </div>
          </TabsContent>

          <TabsContent value="feeder">
            <FeederManagement />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
} 
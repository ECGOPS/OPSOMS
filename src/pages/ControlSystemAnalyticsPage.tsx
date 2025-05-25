import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, subDays, subMonths, subYears } from "date-fns";
import { Download, FileText, Filter, AlertTriangle, Users, Zap, Clock, TrendingUp, Table, BarChart3 } from "lucide-react";
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ControlSystemAnalyticsPage() {
  const { user } = useAuth();
  const { controlSystemOutages, regions, districts } = useData();
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<string>("all");
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [outageType, setOutageType] = useState<'all' | 'sustained' | 'momentary'>('all');
  const [filterFaultType, setFilterFaultType] = useState<string>("all");
  const [view, setView] = useState<'charts' | 'table'>('charts');
  const [sortField, setSortField] = useState<string>('occurrenceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Define all possible fault types
  const faultTypes = [
    "Planned",
    "Unplanned",
    "Emergency",
    "Load Shedding",
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

    const headers = [
      'Occurrence Date',
      'Region',
      'District',
      'Fault Type',
      'Description',
      'Feeder Name',
      'Voltage Level',
      'Rural Customers',
      'Urban Customers',
      'Metro Customers',
      'Total Customers',
      'Customer Interruption Duration (hrs)',
      'Customer Interruption Frequency',
      'Feeder Rural Customers',
      'Feeder Urban Customers',
      'Feeder Metro Customers',
      'Total Feeder Customers',
      'Unserved Energy (MWh)',
      'Repair Start Date',
      'Repair End Date',
      'Repair Duration (hrs)',
      'Restoration Date',
      'Outage Duration (hrs)',
      'Status',
      'Load MW',
      'Created By',
      'Created At',
      'Updated At'
    ];

    const dataRows = filteredOutages.map(outage => {
      const repairDuration = outage.repairStartDate && outage.repairEndDate
        ? (new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60)
        : 0;
      
      const outageDuration = outage.occurrenceDate && outage.restorationDate
        ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;

      const totalCustomers = (outage.customersAffected?.rural || 0) + 
                           (outage.customersAffected?.urban || 0) + 
                           (outage.customersAffected?.metro || 0);

      // Calculate Customer Interruption Duration (CID)
      const customerInterruptionDuration = outage.occurrenceDate && outage.restorationDate
        ? (outageDuration * totalCustomers)
        : 0;

      // Calculate Customer Interruption Frequency (CIF)
      const customerInterruptionFrequency = 
        (outage.customersAffected?.rural > 0 ? 1 : 0) +
        (outage.customersAffected?.urban > 0 ? 1 : 0) +
        (outage.customersAffected?.metro > 0 ? 1 : 0);

      // Calculate feeder customers
      const feederRural = outage.feederCustomers?.rural || 0;
      const feederUrban = outage.feederCustomers?.urban || 0;
      const feederMetro = outage.feederCustomers?.metro || 0;
      const totalFeederCustomers = feederRural + feederUrban + feederMetro;

      return [
        formatDate(outage.occurrenceDate),
        regions.find(r => r.id === outage.regionId)?.name || '',
        districts.find(d => d.id === outage.districtId)?.name || '',
        outage.faultType || '',
        outage.description || '',
        outage.feederName || '',
        outage.voltageLevel || '',
        outage.customersAffected?.rural || 0,
        outage.customersAffected?.urban || 0,
        outage.customersAffected?.metro || 0,
        totalCustomers,
        customerInterruptionDuration.toFixed(2),
        customerInterruptionFrequency,
        feederRural,
        feederUrban,
        feederMetro,
        totalFeederCustomers,
        outage.unservedEnergyMWh?.toFixed(2) || 0,
        formatDate(outage.repairStartDate),
        formatDate(outage.repairEndDate),
        repairDuration.toFixed(2),
        formatDate(outage.restorationDate),
        outageDuration.toFixed(2),
        outage.status || '',
        outage.loadMW?.toFixed(2) || '',
        outage.createdBy || '',
        formatDate(outage.createdAt),
        formatDate(outage.updatedAt)
      ].map(value => `"${value}"`).join(',');
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
    const data = getSortedAndFilteredData();

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search outages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
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
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('occurrenceDate')}
                >
                  Occurrence Date {sortField === 'occurrenceDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('faultType')}
                >
                  Fault Type {sortField === 'faultType' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('specificFaultType')}
                >
                  Specific Fault Type {sortField === 'specificFaultType' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('customersAffected')}
                >
                  Customers Affected {sortField === 'customersAffected' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('unservedEnergyMWh')}
                >
                  Unserved Energy {sortField === 'unservedEnergyMWh' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('repairStartDate')}
                >
                  Repair Duration {sortField === 'repairStartDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('restorationDate')}
                >
                  Outage Duration {sortField === 'restorationDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((outage) => {
                const repairDuration = outage.repairStartDate && outage.repairEndDate
                  ? (new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60)
                  : 0;
                
                const outageDuration = outage.occurrenceDate && outage.restorationDate
                  ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
                  : 0;

                const totalCustomers = (outage.customersAffected?.rural || 0) + 
                                    (outage.customersAffected?.urban || 0) + 
                                    (outage.customersAffected?.metro || 0);

                return (
                  <TableRow key={outage.id}>
                    <TableCell>{format(new Date(outage.occurrenceDate), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>{outage.faultType}</TableCell>
                    <TableCell>{outage.specificFaultType || '-'}</TableCell>
                    <TableCell>{totalCustomers}</TableCell>
                    <TableCell>{outage.unservedEnergyMWh?.toFixed(2) || 0} MWh</TableCell>
                    <TableCell>{repairDuration.toFixed(2)} hrs</TableCell>
                    <TableCell>{outageDuration.toFixed(2)} hrs</TableCell>
                    <TableCell>
                      <Badge variant={outage.status === 'resolved' ? 'default' : 'destructive'}>
                        {outage.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </TableComponent>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Control System Analytics</h1>
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

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Region</Label>
              <Select
                value={filterRegion || ""}
                onValueChange={setFilterRegion}
                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer"}
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
            <div>
              <Label>District</Label>
              <Select
                value={filterDistrict || ""}
                onValueChange={setFilterDistrict}
                disabled={user?.role === "district_engineer" || !filterRegion}
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
            <div>
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
                </SelectContent>
              </Select>
            </div>
            <div>
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
            <div>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outages</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalOutages}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers Affected</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalCustomersAffected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer Interruption Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.customerInterruptionDuration.toFixed(2)} hrs</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer Interruption Frequency</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.customerInterruptionFrequency}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Repair Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.repairDurations.toFixed(2)} hrs</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unserved Energy</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalUnservedEnergy.toFixed(2)} MWh</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Outages by Type</CardTitle>
              <CardDescription>Distribution of outage types</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart(chartData.byType)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Outages by Voltage Level</CardTitle>
              <CardDescription>Distribution by voltage level</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart(chartData.byVoltage)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Repair Duration by Type</CardTitle>
              <CardDescription>Average repair duration for each outage type</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart(chartData.repairDurationByType)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer Interruption Duration by Type</CardTitle>
              <CardDescription>Total customer interruption duration by outage type</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart(chartData.customerInterruptionDurationByType)}
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Monthly Trend</CardTitle>
              <CardDescription>Number of outages over time</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart(chartData.monthlyTrend)}
            </CardContent>
          </Card>
        </div>

        {/* Table View */}
        <Card>
          <CardHeader>
            <CardTitle>Outage Details</CardTitle>
            <CardDescription>Detailed view of all control system outages</CardDescription>
          </CardHeader>
          <CardContent>
            {renderTable()}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 
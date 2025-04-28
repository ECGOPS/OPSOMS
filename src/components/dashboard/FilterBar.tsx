import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DayPicker } from "react-day-picker";
import 'react-day-picker/dist/style.css';
import { CalendarIcon, FilterIcon, XIcon } from "lucide-react";
import { format, getYear, getMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { FilterBarProps } from "@/lib/types";
import { DateRange } from "react-day-picker";
import { Label } from "@/components/ui/label";

// Define type for date filter granularity
type DateFilterType = "range" | "day" | "month" | "year";

// Helper to generate year options
const currentYear = getYear(new Date());
const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i);

// Helper for month names
const monthNames = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export function FilterBar({ 
  setFilterRegion, 
  setFilterDistrict, 
  setFilterStatus, 
  filterStatus, 
  onRefresh, 
  isRefreshing 
}: FilterBarProps) {
  const { regions, districts } = useData();
  const { user } = useAuth();
  
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedFaultType, setSelectedFaultType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("range");
  // State for specific pickers
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined); // 0-11 for month index
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  
  // Set initial values based on user role
  useEffect(() => {
    if (user) {
      if ((user.role === "district_engineer" || user.role === "technician") && user.region && user.district) {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          setSelectedRegion(userRegion.id);
          setFilterRegion(userRegion.id);
          
          const userDistrict = districts.find(d => d.name === user.district);
          if (userDistrict) {
            setSelectedDistrict(userDistrict.id);
            setFilterDistrict(userDistrict.id);
          }
        }
      } else if (user.role === "regional_engineer" && user.region) {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          setSelectedRegion(userRegion.id);
          setFilterRegion(userRegion.id);
        }
      }
    }
  }, [user, regions, districts, setFilterRegion, setFilterDistrict]);
  
  // Update filters when selections change
  useEffect(() => {
    setFilterRegion(selectedRegion);
  }, [selectedRegion, setFilterRegion]);
  
  useEffect(() => {
    setFilterDistrict(selectedDistrict);
  }, [selectedDistrict, setFilterDistrict]);
  
  const handleRegionChange = (selectedRegionId: string) => {
    setSelectedRegion(selectedRegionId);
    setSelectedDistrict("");  // Reset district when region changes
  };

  const handleStatusChange = (value: string) => {
    // Cast the string value to the expected type
    setFilterStatus(value as "all" | "active" | "resolved");
  };
  
  const handleClearFilters = () => {
    // Don't clear region/district for district/regional engineers and technicians
    if (user?.role === "global_engineer" || user?.role === "system_admin") {
      setSelectedRegion("");
      setFilterRegion("");
      setSelectedDistrict("");
      setFilterDistrict("");
    } else if (user?.role === "regional_engineer") {
      setSelectedDistrict("");
      setFilterDistrict("");
    }
    
    setSelectedFaultType("all");
    setFilterStatus("all");
    setDateFilterType("range");
    setDateRange({ from: undefined, to: undefined });
    setSelectedDay(undefined);
    setSelectedMonth(undefined);
    setSelectedMonthYear(undefined);
    setSelectedYear(undefined);
  };
  
  // Filter regions based on user role
  const filteredRegions = (user?.role === "global_engineer" || user?.role === "system_admin")
    ? regions 
    : regions.filter(r => user?.region ? r.name === user.region : true);
  
  // Filter districts based on selected region and user role
  const filteredDistricts = selectedRegion
    ? districts.filter(d => {
        // First check if district belongs to selected region
        if (d.regionId !== selectedRegion) return false;
        
        // For district engineers and technicians, only show their assigned district
        if (user?.role === "district_engineer" || user?.role === "technician") {
          return d.name === user.district;
        }
        
        // For regional engineers, only show districts in their region
        if (user?.role === "regional_engineer") {
          const userRegion = regions.find(r => r.name === user.region);
          return userRegion ? d.regionId === userRegion.id : false;
        }
        
        // For other roles, show all districts in the selected region
        return true;
      })
    : [];
  
  // Handlers for specific date pickers
  const handleDaySelect = (day: Date | undefined) => {
    setSelectedDay(day);
    // Potentially close popover here if needed
  };

  const handleMonthSelect = (monthIndex: string) => {
    setSelectedMonth(parseInt(monthIndex, 10));
  };

  const handleMonthYearSelect = (year: string) => {
     setSelectedMonthYear(parseInt(year, 10));
  };
  
  const handleYearSelect = (year: string) => {
     setSelectedYear(parseInt(year, 10));
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium flex items-center">
            <FilterIcon className="mr-2 h-5 w-5" />
            Filter Faults
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearFilters}
            className="h-8 px-2 lg:px-3"
          >
            <XIcon className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        </div>
        
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic Filters</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Filters</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="region-select-basic" className="text-xs text-muted-foreground">Region</Label>
                <Select 
                  value={selectedRegion} 
                  onValueChange={handleRegionChange}
                >
                  <SelectTrigger id="region-select-basic" className="mt-1">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRegions.map(region => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="district-select-basic" className="text-xs text-muted-foreground">District</Label>
                <Select 
                  value={selectedDistrict} 
                  onValueChange={setSelectedDistrict}
                  disabled={!selectedRegion}
                >
                  <SelectTrigger id="district-select-basic" className="mt-1">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDistricts.map(district => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="status-select-basic" className="text-xs text-muted-foreground">Status</Label>
                <Select 
                  value={filterStatus} 
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger id="status-select-basic" className="mt-1">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="fault-type-select" className="text-xs text-muted-foreground">Fault Type</Label>
                <Select value={selectedFaultType} onValueChange={setSelectedFaultType}>
                  <SelectTrigger id="fault-type-select" className="mt-1">
                    <SelectValue placeholder="Fault Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="Unplanned">Unplanned</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
                    <SelectItem value="Load Shedding">Load Shedding</SelectItem>
                    <SelectItem value="GridCo Outages">GridCo Outages</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="date-filter-type" className="text-xs text-muted-foreground">Filter Period By</Label>
                <Select 
                  value={dateFilterType} 
                  onValueChange={(value) => setDateFilterType(value as DateFilterType)}
                >
                  <SelectTrigger id="date-filter-type" className="mt-1">
                    <SelectValue placeholder="Select period type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="range">Date Range</SelectItem>
                    <SelectItem value="day">Specific Day</SelectItem>
                    <SelectItem value="month">Specific Month</SelectItem>
                    <SelectItem value="year">Specific Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateFilterType === 'range' && (
                <div>
                  <Label htmlFor="date-range-picker" className="text-xs text-muted-foreground">Date Range</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date-range-picker"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DayPicker
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {dateFilterType === 'day' && (
                <div>
                  <Label htmlFor="day-picker" className="text-xs text-muted-foreground">Select Day</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="day-picker"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !selectedDay && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDay ? format(selectedDay, "PPP") : <span>Pick a day</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <DayPicker
                        mode="single"
                        selected={selectedDay}
                        onSelect={handleDaySelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              
              {dateFilterType === 'month' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="month-select" className="text-xs text-muted-foreground">Month</Label>
                    <Select 
                      value={selectedMonth?.toString() ?? ""} 
                      onValueChange={handleMonthSelect}
                    >
                      <SelectTrigger id="month-select" className="mt-1">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthNames.map((name, index) => (
                          <SelectItem key={index} value={index.toString()}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="month-year-select" className="text-xs text-muted-foreground">Year</Label>
                    <Select 
                      value={selectedMonthYear?.toString() ?? ""} 
                      onValueChange={handleMonthYearSelect}
                    >
                      <SelectTrigger id="month-year-select" className="mt-1">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {dateFilterType === 'year' && (
                <div>
                  <Label htmlFor="year-select" className="text-xs text-muted-foreground">Select Year</Label>
                  <Select 
                    value={selectedYear?.toString() ?? ""} 
                    onValueChange={handleYearSelect}
                  >
                    <SelectTrigger id="year-select" className="mt-1">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="md:col-span-3">
                <Button
                  variant="outline"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="w-full mt-4"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh Data"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

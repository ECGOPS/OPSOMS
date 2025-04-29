import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import { Zap, Users, Clock, MonitorSmartphone } from "lucide-react";
import { OP5Fault, ControlSystemOutage, StatsOverviewProps } from "@/lib/types";
import { calculateOutageDuration } from "@/lib/calculations";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export function StatsOverview({ op5Faults, controlOutages }: StatsOverviewProps) {
  const [totalFaults, setTotalFaults] = useState(0);
  const [totalOutages, setTotalOutages] = useState(0);
  const [affectedPopulation, setAffectedPopulation] = useState(0);
  const [averageOutageTime, setAverageOutageTime] = useState(0);

  useEffect(() => {
    // Calculate total faults and outages
    setTotalFaults(op5Faults.length);
    setTotalOutages(controlOutages.length);

    // Calculate total affected population
    let totalAffected = 0;
    op5Faults.forEach(fault => {
      if (fault.affectedPopulation) {
        totalAffected += fault.affectedPopulation.rural + fault.affectedPopulation.urban + fault.affectedPopulation.metro;
      }
    });
    setAffectedPopulation(totalAffected);

    // Calculate average outage time (in hours)
    let totalDuration = 0;
    const faultsWithDuration = op5Faults.filter(fault => 
      fault.occurrenceDate && fault.restorationDate && 
      new Date(fault.restorationDate) > new Date(fault.occurrenceDate)
    );
    
    faultsWithDuration.forEach(fault => {
      const duration = calculateOutageDuration(fault.occurrenceDate, fault.restorationDate);
      totalDuration += duration;
    });
    
    const avgDuration = faultsWithDuration.length > 0 ? totalDuration / faultsWithDuration.length : 0;
    setAverageOutageTime(avgDuration);

  }, [op5Faults, controlOutages]);

  const iconClass = "h-8 w-8 animate-pulse";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-red-50 border border-red-200 shadow-md animate-fade-up animate-duration-500 animate-delay-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Total Faults</CardTitle>
          <CardDescription>Number of reported OP5 faults</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center space-x-4">
          <Zap className={cn(iconClass, "text-red-500")} />
          <div className="text-3xl font-bold">
            <AnimatedNumber value={totalFaults} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-orange-50 border border-orange-200 shadow-md animate-fade-up animate-duration-500 animate-delay-100">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Total Outages</CardTitle>
          <CardDescription>Number of control system outages</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center space-x-4">
          <MonitorSmartphone className={cn(iconClass, "text-orange-500")} />
          <div className="text-3xl font-bold">
            <AnimatedNumber value={totalOutages} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border border-blue-200 shadow-md animate-fade-up animate-duration-500 animate-delay-200">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Affected Population</CardTitle>
          <CardDescription>Total population affected by faults</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center space-x-4">
          <Users className={cn(iconClass, "text-blue-500")} />
          <div className="text-3xl font-bold">
            <AnimatedNumber value={affectedPopulation} formatValue={(val) => val.toLocaleString()} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-green-50 border border-green-200 shadow-md animate-fade-up animate-duration-500 animate-delay-300">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Avg. Outage Time</CardTitle>
          <CardDescription>Average time to resolve a fault (hours)</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center space-x-4">
          <Clock className={cn(iconClass, "text-green-500")} />
          <div className="text-3xl font-bold">
            <AnimatedNumber value={averageOutageTime} formatValue={(val) => val.toFixed(1)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

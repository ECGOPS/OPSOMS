// Outage Duration Calculation (in hours)
export const calculateOutageDuration = (occurrenceDate: string, restorationDate: string): number => {
  const start = new Date(occurrenceDate).getTime();
  const end = new Date(restorationDate).getTime();
  const hours = (end - start) / (1000 * 60 * 60); // Convert milliseconds to hours
  return Number(hours.toFixed(2)); // Round to 2 decimal places
};

// MTTR Calculation (Mean Time To Repair) in hours
export const calculateMTTR = (occurrenceDate: string, repairDate: string): number => {
  const start = new Date(occurrenceDate).getTime();
  const end = new Date(repairDate).getTime();
  const hours = (end - start) / (1000 * 60 * 60); // Convert milliseconds to hours
  return Number(hours.toFixed(2)); // Round to 2 decimal places
};

// Calculate SAIDI (System Average Interruption Duration Index)
export const calculateSAIDI = (
  outages: { occurrenceDate: string; restorationDate: string; affectedCustomers: number }[],
  totalCustomers: number
): number => {
  if (outages.length === 0 || totalCustomers === 0) return 0;
  
  const totalCustomerMinutes = outages.reduce((sum, outage) => {
    const duration = calculateOutageDuration(outage.occurrenceDate, outage.restorationDate);
    return sum + (duration * outage.affectedCustomers);
  }, 0);
  
  return totalCustomerMinutes / totalCustomers;
};

// Calculate SAIFI (System Average Interruption Frequency Index)
export const calculateSAIFI = (
  outages: { affectedCustomers: number }[],
  totalCustomers: number
): number => {
  if (outages.length === 0 || totalCustomers === 0) return 0;
  
  const totalCustomerInterruptions = outages.reduce((sum, outage) => {
    return sum + outage.affectedCustomers;
  }, 0);
  
  return totalCustomerInterruptions / totalCustomers;
};

// Calculate CAIDI (Customer Average Interruption Duration Index) = SAIDI/SAIFI
export const calculateCAIDI = (saidi: number, saifi: number): number => {
  if (saifi === 0) return 0;
  return saidi / saifi;
};

// Calculate Unserved Energy (MWh)
// @param loadMW - Load in Megawatts (must be positive)
// @param durationHours - Duration in hours (must be positive)
// @returns Unserved Energy in Megawatt-hours (MWh)
export const calculateUnservedEnergy = (loadMW: number, durationHours: number): number => {
  // Validate inputs
  if (loadMW <= 0) {
    console.warn('Load must be positive');
    return 0;
  }
  
  if (durationHours <= 0) {
    console.warn('Duration must be positive');
    return 0;
  }
  
  // Calculate unserved energy and round to 2 decimal places
  const unservedEnergy = loadMW * durationHours;
  return Number(unservedEnergy.toFixed(2));
};

// Calculate Duration in Hours from dates
export const calculateDurationHours = (occurrenceDate: string, restorationDate: string): number => {
  const start = new Date(occurrenceDate).getTime();
  const end = new Date(restorationDate).getTime();
  return (end - start) / (1000 * 60 * 60); // Convert milliseconds to hours
};

// Format a date object to a readable string
export const formatDate = (timestamp: any) => {
  if (!timestamp) return "Not available";
  
  try {
    // Handle Firestore timestamp
    if (timestamp?.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    
    // Handle string date
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) 
      ? date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : "Invalid date";
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

// Format duration in hours to hours with two decimal places
export const formatDuration = (hours: number): string => {
  return `${hours.toFixed(2)} hours`;
};

// Calculate Customer Lost Hours
export const calculateCustomerLostHours = (
  outrageDuration: number, // in hours
  affectedPopulation: { rural: number; urban: number; metro: number }
): number => {
  const totalAffectedCustomers = affectedPopulation.rural + affectedPopulation.urban + affectedPopulation.metro;
  const lostHours = outrageDuration * totalAffectedCustomers;
  return Number(lostHours.toFixed(2)); // Round to 2 decimal places
};

// Calculate SAIDI for specific population type
export const calculateSAIDIByType = (
  outages: { occurrenceDate: string; restorationDate: string; affectedCustomers: number }[],
  totalCustomers: number
): number => {
  if (outages.length === 0 || totalCustomers === 0) return 0;
  
  const totalCustomerMinutes = outages.reduce((sum, outage) => {
    const duration = calculateOutageDuration(outage.occurrenceDate, outage.restorationDate);
    return sum + (duration * outage.affectedCustomers);
  }, 0);
  
  return totalCustomerMinutes / totalCustomers;
};

// Calculate SAIFI for specific population type
export const calculateSAIFIByType = (
  outages: { affectedCustomers: number }[],
  totalCustomers: number
): number => {
  if (outages.length === 0 || totalCustomers === 0) return 0;
  
  const totalCustomerInterruptions = outages.reduce((sum, outage) => {
    return sum + outage.affectedCustomers;
  }, 0);
  
  return totalCustomerInterruptions / totalCustomers;
};

// Calculate reliability indices by population type
export const calculateReliabilityIndicesByType = (
  occurrenceDate: string,
  restorationDate: string,
  affected: { rural: number; urban: number; metro: number },
  total: { rural: number; urban: number; metro: number }
) => {
  const indices = {
    rural: { saidi: 0, saifi: 0, caidi: 0 },
    urban: { saidi: 0, saifi: 0, caidi: 0 },
    metro: { saidi: 0, saifi: 0, caidi: 0 }
  };

  // Calculate for rural population
  if (total.rural > 0) {
    indices.rural.saidi = calculateSAIDIByType(
      [{ occurrenceDate, restorationDate, affectedCustomers: affected.rural }],
      total.rural
    );
    indices.rural.saifi = calculateSAIFIByType(
      [{ affectedCustomers: affected.rural }],
      total.rural
    );
    indices.rural.caidi = calculateCAIDI(indices.rural.saidi, indices.rural.saifi);
  }

  // Calculate for urban population
  if (total.urban > 0) {
    indices.urban.saidi = calculateSAIDIByType(
      [{ occurrenceDate, restorationDate, affectedCustomers: affected.urban }],
      total.urban
    );
    indices.urban.saifi = calculateSAIFIByType(
      [{ affectedCustomers: affected.urban }],
      total.urban
    );
    indices.urban.caidi = calculateCAIDI(indices.urban.saidi, indices.urban.saifi);
  }

  // Calculate for metro population
  if (total.metro > 0) {
    indices.metro.saidi = calculateSAIDIByType(
      [{ occurrenceDate, restorationDate, affectedCustomers: affected.metro }],
      total.metro
    );
    indices.metro.saifi = calculateSAIFIByType(
      [{ affectedCustomers: affected.metro }],
      total.metro
    );
    indices.metro.caidi = calculateCAIDI(indices.metro.saidi, indices.metro.saifi);
  }

  return indices;
};

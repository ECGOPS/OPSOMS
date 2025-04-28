import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export function DistrictPopulationForm() {
  const { regions, districts, updateDistrict } = useData();
  const { user } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [ruralPopulation, setRuralPopulation] = useState<number>(0);
  const [urbanPopulation, setUrbanPopulation] = useState<number>(0);
  const [metroPopulation, setMetroPopulation] = useState<number>(0);
  
  // Set initial values based on user role
  useEffect(() => {
    console.log("User role:", user?.role);
    console.log("User region:", user?.region);
    console.log("User district:", user?.district);
    
    if ((user?.role === "district_engineer" || user?.role === "regional_engineer") && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      console.log("Found user region:", userRegion);
      
      if (userRegion) {
        setSelectedRegion(userRegion.id);
        
        // For district engineer, also set the district
        if (user.role === "district_engineer" && user.district) {
          const userDistrict = districts.find(d => d.name === user.district);
          console.log("Found user district:", userDistrict);
          
          if (userDistrict) {
            setSelectedDistrict(userDistrict.id);
            // Add null checks and default values for population data
            setRuralPopulation(userDistrict.population?.rural ?? 0);
            setUrbanPopulation(userDistrict.population?.urban ?? 0);
            setMetroPopulation(userDistrict.population?.metro ?? 0);
          }
        }
      }
    }
  }, [user, regions, districts]);
  
  // Ensure district is set for district engineers
  useEffect(() => {
    if (user?.role === "district_engineer" && user.district && selectedRegion && !selectedDistrict) {
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        setSelectedDistrict(userDistrict.id);
        // Add null checks and default values for population data
        setRuralPopulation(userDistrict.population?.rural ?? 0);
        setUrbanPopulation(userDistrict.population?.urban ?? 0);
        setMetroPopulation(userDistrict.population?.metro ?? 0);
      }
    }
  }, [user, selectedRegion, selectedDistrict, districts]);
  
  // Update population fields when district changes
  useEffect(() => {
    if (selectedDistrict) {
      const district = districts.find(d => d.id === selectedDistrict);
      if (district) {
        // Add null checks and default values for population data
        setRuralPopulation(district.population?.rural ?? 0);
        setUrbanPopulation(district.population?.urban ?? 0);
        setMetroPopulation(district.population?.metro ?? 0);
      } else {
        setRuralPopulation(0);
        setUrbanPopulation(0);
        setMetroPopulation(0);
      }
    } else {
      setRuralPopulation(0);
      setUrbanPopulation(0);
      setMetroPopulation(0);
    }
  }, [selectedDistrict, districts]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDistrict) {
      toast.error("Please select a district");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await updateDistrict(selectedDistrict, {
        population: {
          rural: ruralPopulation,
          urban: urbanPopulation,
          metro: metroPopulation
        }
      });
      
      toast.success("District population updated successfully");
    } catch (error) {
      console.error("Error updating district population:", error);
      toast.error("Failed to update district population");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Filter regions for regional and global engineers
  const filteredRegions = user?.role === "global_engineer" 
    ? regions 
    : regions.filter(r => user?.region ? r.name === user.region : true);
  
  // Filter districts for district engineers
  const filteredDistricts = selectedRegion
    ? districts.filter(d => {
        return d.regionId === selectedRegion && (
          user?.role === "district_engineer" 
            ? d.name === user.district 
            : true
        );
      })
    : [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Update District Population</CardTitle>
        <CardDescription>
          Set population figures for district segmentation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select 
                value={selectedRegion} 
                onValueChange={setSelectedRegion}
                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer"}
              >
                <SelectTrigger>
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
            
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Select 
                value={selectedDistrict} 
                onValueChange={setSelectedDistrict}
                disabled={!selectedRegion || user?.role === "district_engineer"}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedRegion ? "Select district" : "Select region first"} />
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
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="ruralPopulation">Rural Population</Label>
              <Input
                id="ruralPopulation"
                type="number"
                min="0"
                value={ruralPopulation}
                onChange={(e) => setRuralPopulation(parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="urbanPopulation">Urban Population</Label>
              <Input
                id="urbanPopulation"
                type="number"
                min="0"
                value={urbanPopulation}
                onChange={(e) => setUrbanPopulation(parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="metroPopulation">Metro Population</Label>
              <Input
                id="metroPopulation"
                type="number"
                min="0"
                value={metroPopulation}
                onChange={(e) => setMetroPopulation(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Population Data"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

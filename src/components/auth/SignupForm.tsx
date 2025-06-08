import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { UserRole } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";

export function SignupForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    staffId: "",
    name: "",
    role: "",
    region: "",
    district: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFieldsLocked, setIsFieldsLocked] = useState(false);
  const [errors, setErrors] = useState({
    password: "",
    staffId: "",
    role: "",
    region: "",
    district: ""
  });
  const { signup, verifyStaffId, staffIds } = useAuth();
  const { 
    regions, 
    districts, 
    isLoadingRegions, 
    isLoadingDistricts,
    regionsError,
    districtsError,
    retryRegionsAndDistricts
  } = useData();
  const navigate = useNavigate();

  const handleStaffIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStaffId = e.target.value;
    setFormData(prev => ({ ...prev, staffId: newStaffId }));
    setErrors(prev => ({ ...prev, staffId: "" }));

    // Clear previous information when a new staff ID is entered
    if (newStaffId) {
      const { isValid, staffInfo } = verifyStaffId(newStaffId);
      
      if (isValid && staffInfo) {
        // Auto-populate fields
        setFormData(prev => ({
          ...prev,
          name: staffInfo.name,
          role: staffInfo.role,
          region: staffInfo.region || "",
          district: staffInfo.district || ""
        }));
        setIsFieldsLocked(true);
      } else {
        // Reset fields if staff ID is invalid
        setFormData(prev => ({
          ...prev,
          name: "",
          role: "",
          region: "",
          district: ""
        }));
        setIsFieldsLocked(false);
        setErrors(prev => ({ ...prev, staffId: "Sorry, your staff ID was not found in the ECG Operations database. Please contact your administrator to complete your enrollment." }));
      }
    } else {
      // Reset fields if staff ID is empty
      setFormData(prev => ({
        ...prev,
        name: "",
        role: "",
        region: "",
        district: ""
      }));
      setIsFieldsLocked(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    const newErrors = {
      password: "",
      staffId: "",
      role: "",
      region: "",
      district: ""
    };

    // Password validation
    if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = "Password must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = "Password must contain at least one number";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.password = "Passwords do not match";
    }

    // Staff ID validation
    if (!formData.staffId) {
      newErrors.staffId = "Staff ID is required";
    } else {
      const { isValid } = verifyStaffId(formData.staffId);
      if (!isValid) {
        newErrors.staffId = "Sorry, your staff ID was not found in the ECG Operations database. Please contact your administrator to complete your enrollment.";
      }
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = "Role is required";
    }

    // Region validation for applicable roles
    if (formData.role && formData.role !== "global_engineer" && formData.role !== "system_admin") {
      if (!formData.region) {
        newErrors.region = "Region is required";
      }
    }

    // District validation for applicable roles
    if (formData.role === "district_engineer" || formData.role === "technician") {
      if (!formData.district) {
        newErrors.district = "District is required";
      }
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!validateForm()) {
      setIsLoading(false);
      return;
    }
    
    try {
      await signup(
        formData.email,
        formData.password,
        formData.name,
        formData.role as UserRole,
        formData.region || undefined,
        formData.district || undefined,
        formData.staffId
      );

      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter districts based on selected region
  const filteredDistricts = districts.filter(
    district => district.regionId === regions.find(r => r.name === formData.region)?.id
  );

  if (isLoadingRegions || isLoadingDistricts) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading regions and districts...</p>
      </div>
    );
  }

  if (regionsError || districtsError) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <p className="text-sm text-destructive">{regionsError || districtsError}</p>
        <Button onClick={retryRegionsAndDistricts} variant="outline">
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Create an Account</CardTitle>
        <CardDescription>
          Sign up to access ECG Outage Management System
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="staffId">Staff ID</Label>
              <Input
                id="staffId"
                value={formData.staffId}
                onChange={handleStaffIdChange}
                placeholder="Enter your staff ID"
              />
              {errors.staffId && <p className="text-sm text-red-500 mt-1">{errors.staffId}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Used for ECG staff identity verification.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter your name"
                disabled={isFieldsLocked}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Enter your email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleChange("role", value)}
                disabled={isFieldsLocked}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system_admin">System Admin</SelectItem>
                  <SelectItem value="global_engineer">Global Engineer</SelectItem>
                  <SelectItem value="regional_general_manager">Regional General Manager</SelectItem>
                  <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                  <SelectItem value="district_manager">District Manager</SelectItem>
                  <SelectItem value="district_engineer">District Engineer</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-sm text-red-500 mt-1">{errors.role}</p>}
            </div>
            
            {/* Region Select (if applicable) */}
            {(formData.role && formData.role !== "global_engineer" && formData.role !== "system_admin") && (
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select 
                  value={formData.region} 
                  onValueChange={(value) => {
                    handleChange("region", value);
                    handleChange("district", ""); // Reset district when region changes
                  }}
                  disabled={isFieldsLocked}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map(region => (
                      <SelectItem key={region.id} value={region.name}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.region && <p className="text-sm text-red-500 mt-1">{errors.region}</p>}
              </div>
            )}
            
            {/* District Select (if applicable) */}
            {(formData.role === "district_engineer" || formData.role === "technician") && (
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Select 
                  value={formData.district} 
                  onValueChange={(value) => handleChange("district", value)}
                  disabled={!formData.region || isFieldsLocked}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDistricts.map(district => (
                      <SelectItem key={district.id} value={district.name}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.district && <p className="text-sm text-red-500 mt-1">{errors.district}</p>}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder="Enter your password"
              />
              {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                placeholder="Confirm your password"
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-ecg-blue hover:underline">
            Login
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

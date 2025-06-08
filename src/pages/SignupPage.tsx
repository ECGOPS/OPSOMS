import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { SignupForm } from "@/components/auth/SignupForm";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SignupPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);
  
  return (
    <div className="relative min-h-screen">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: "url('/images/ops.png')",
          zIndex: -1
        }}
      />
      <Layout>
        <div className="container mx-auto py-10 px-4">
          <div className="max-w-md mx-auto">
            <div className="flex justify-center mb-6">
              <img src="/ecg-images/ecg-logo.png" alt="ECG Logo" className="h-16 w-auto" />
            </div>
            <h1 className="text-2xl font-bold mb-6 text-center">Sign Up for ECG Outage Management System</h1>
            <SignupForm />
          </div>
        </div>
      </Layout>
    </div>
  );
}

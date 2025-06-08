import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loginAttempts >= 5) {
      setIsLocked(true);
      const timer = setTimeout(() => {
        setIsLocked(false);
        setLoginAttempts(0);
      }, 15 * 60 * 1000); // 15 minutes lockout
      return () => clearTimeout(timer);
    }
  }, [loginAttempts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      toast.error("Too many login attempts. Please try again later.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);
      setLoginAttempts(0);
      // Don't navigate here - let the LoginPage handle navigation
    } catch (error: any) {
      setLoginAttempts(prev => prev + 1);
      console.error("Login failed. Error details:", {
        code: error.code,
        message: error.message,
        fullError: error
      });
      
      // More specific error messages based on the error code
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/wrong-password' || 
          error.code === 'auth/invalid-email' ||
          error.code === 'auth/invalid-login-credentials') {
        toast.error("Invalid email or password. Please try again.");
      } else if (error.code === 'auth/user-not-found') {
        toast.error("No account found with this email.");
      } else if (error.code === 'auth/too-many-requests') {
        toast.error("Too many login attempts. Please try again later.");
      } else if (error.code === 'auth/user-disabled') {
        toast.error("This account has been disabled. Please contact support.");
      } else if (error.code === 'auth/network-request-failed') {
        toast.error("Network error. Please check your internet connection.");
      } else {
        toast.error(`Login failed: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <img 
            src="/ecg-images/ecg-logo.png" 
            alt="ECG Logo" 
            className="h-16 w-auto mx-auto"
          />
        </div>
        <CardTitle className="text-2xl">Login to ECG Outage Management System</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLocked}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-sm text-ecg-blue hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLocked}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || isLocked}
          >
            {isLocked 
              ? "Account locked. Try again later" 
              : isSubmitting 
                ? "Logging in..." 
                : "Login"
            }
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-ecg-blue hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

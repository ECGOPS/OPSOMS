import React, { createContext, useContext, useEffect, useState } from "react";
import { User, UserRole } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { auth, db, functions } from "@/config/firebase";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  updatePassword
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { StaffIdEntry } from "@/components/user-management/StaffIdManagement";
import { httpsCallable } from "firebase/functions";
import { securityMonitoringService, EVENT_TYPES } from "@/services/SecurityMonitoringService";
import LoggingService from "@/services/LoggingService";

// Export the interface
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole, region?: string, district?: string, staffId?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  addUser: (user: Omit<User, "id">) => Promise<string>;
  updateUser: (id: string, userData: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  toggleUserStatus: (id: string, disabled: boolean) => Promise<void>;
  resetUserPassword: (email: string) => void;
  adminResetUserPassword: (userId: string) => Promise<{ tempPassword: string; email: string }>;
  verifyStaffId: (staffId: string) => { isValid: boolean; staffInfo?: { name: string; role: UserRole; region?: string; district?: string } };
  staffIds: StaffIdEntry[];
  setStaffIds: React.Dispatch<React.SetStateAction<StaffIdEntry[]>>;
  addStaffId: (entry: Omit<StaffIdEntry, "id"> & { customId?: string }) => Promise<string>;
  updateStaffId: (id: string, entry: Omit<StaffIdEntry, "id">) => void;
  deleteStaffId: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [staffIds, setStaffIds] = useState<StaffIdEntry[]>([]);

  useEffect(() => {
    setLoading(true);
    console.log('[AuthContext] Initializing auth state');

    // Load staff IDs immediately for signup verification
    const loadStaffIds = async () => {
      try {
        const staffIdsSnapshot = await getDocs(collection(db, "staffIds"));
        const staffIdsList: StaffIdEntry[] = [];
        staffIdsSnapshot.forEach((doc) => {
          staffIdsList.push({ id: doc.id, ...doc.data() } as StaffIdEntry);
        });
        console.log(`[AuthContext] Loaded ${staffIdsList.length} staff IDs`);
        setStaffIds(staffIdsList);
      } catch (error) {
        console.error("[AuthContext] Error loading staff IDs:", error);
        toast.error("Error loading staff IDs");
      }
    };

    // Call loadStaffIds immediately
    loadStaffIds();

    // Subscribe to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthContext] Auth state changed:', { 
        hasUser: !!firebaseUser,
        uid: firebaseUser?.uid,
        email: firebaseUser?.email,
        emailVerified: firebaseUser?.emailVerified
      });
      
      if (firebaseUser) {
        try {
          console.log('[AuthContext] Fetching user document for:', firebaseUser.uid);
          // Get user document from Firestore
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          console.log('[AuthContext] User document exists:', userDoc.exists());
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('[AuthContext] User data loaded:', { 
              role: userData.role,
              region: userData.region,
              district: userData.district,
              disabled: userData.disabled,
              name: userData.name,
              staffId: userData.staffId
            });

            // Check if user is disabled
            if (userData.disabled) {
              console.log('[AuthContext] User is disabled, signing out');
              await signOut(auth);
              toast.error("This account has been disabled");
              return;
            }
            
            // Get IP address
            const ipAddress = await fetchIpAddress();
            console.log('[AuthContext] IP address:', ipAddress);
            
            // Update last active and IP
            await updateDoc(doc(db, "users", firebaseUser.uid), {
              lastActive: serverTimestamp(),
              lastIpAddress: ipAddress
            });
            console.log('[AuthContext] Updated user last active and IP');
            
            // Initialize user state with basic data
            const userState: User = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: userData.name || "",
              name: userData.name || "",
              role: userData.role,
              staffId: userData.staffId || "",
              region: userData.region,
              regionId: userData.regionId,
              district: userData.district,
              districtId: userData.districtId,
              disabled: userData.disabled,
              mustChangePassword: userData.mustChangePassword,
              photoURL: userData.photoURL
            };

            console.log('[AuthContext] Initial user state:', userState);
            setUser(userState);
          } else {
            console.log('[AuthContext] User document not found, signing out');
            await signOut(auth);
            toast.error("User account not found");
          }
        } catch (error) {
          console.error('[AuthContext] Error in auth state change:', error);
          await signOut(auth);
          toast.error("Error loading user data");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Subscribe to users collection only if authenticated
    const usersUnsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        try {
          const usersList: User[] = [];
          snapshot.forEach((doc) => {
            usersList.push({ id: doc.id, ...doc.data() } as User);
          });
          setUsers(usersList);
        } catch (error) {
          console.error("Error processing users snapshot:", error);
          toast.error("Error loading users data");
        }
      },
      (error) => {
        console.error("Users listener error:", error);
        toast.error("Error in users connection");
      }
    );

    // Subscribe to staffIds collection with error handling
    const staffIdsUnsubscribe = onSnapshot(
      collection(db, "staffIds"),
      (snapshot) => {
        try {
          const staffIdsList: StaffIdEntry[] = [];
          snapshot.forEach((doc) => {
            staffIdsList.push({ id: doc.id, ...doc.data() } as StaffIdEntry);
          });
          setStaffIds(staffIdsList);
        } catch (error) {
          console.error("Error processing staffIds snapshot:", error);
          toast.error("Error loading staff IDs data");
        }
      },
      (error) => {
        console.error("StaffIds listener error:", error);
        toast.error("Error in staff IDs connection");
      }
    );

    return () => {
      unsubscribeAuth();
      usersUnsubscribe();
      staffIdsUnsubscribe();
    };
  }, []);

  // Add a separate effect to handle auth state changes
  useEffect(() => {
    if (user) {
      console.log('[AuthContext] User state updated:', {
        id: user.id,
        role: user.role,
        region: user.region,
        district: user.district
      });
    }
  }, [user]);

  // Add activity tracking
  useEffect(() => {
    if (!user) return;

    let activityTimeout: NodeJS.Timeout;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    const updateActivity = async () => {
      try {
        // Check connection state
        if (!navigator.onLine) {
          console.log('Device is offline, skipping activity update');
          return;
        }

        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          lastActive: serverTimestamp()
        });
        retryCount = 0;
      } catch (error) {
        console.error('Error updating activity:', error);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          setTimeout(updateActivity, RETRY_DELAY);
        }
      }
    };

    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(updateActivity, 5000);
    };

    // Add event listeners for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Initial activity update
    updateActivity();

    return () => {
      clearTimeout(activityTimeout);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [user]);

  // Add IP address fetching
  const fetchIpAddress = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Error fetching IP:', error);
      return 'unknown';
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (!userDoc.exists()) {
        throw new Error("User account not found");
      }

      const userData = userDoc.data();
      if (userData.disabled) {
        await signOut(auth);
        throw new Error("This account has been disabled");
      }

      // Log successful login
      securityMonitoringService.logEvent({
        eventType: EVENT_TYPES.LOGIN_SUCCESS,
        details: `Successful login for user ${email}`,
        severity: 'low',
        status: 'new',
        userId: userCredential.user.uid,
        timestamp: new Date().toISOString()
      });

      toast.success("Login successful");
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Log failed login attempt
      securityMonitoringService.logEvent({
        eventType: EVENT_TYPES.LOGIN_FAILURE,
        details: `Failed login attempt for user ${email}: ${error.message}`,
        severity: 'medium',
        status: 'new',
        timestamp: new Date().toISOString()
      });

      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        toast.error("Invalid email or password");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many failed attempts. Please try again later.");
      } else {
        toast.error(error.message || "Failed to login");
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string, role: UserRole, region?: string, district?: string, staffId?: string) => {
    try {
      // Validate required fields based on role
      if (role === 'technician' || role === 'district_engineer') {
        if (!region || !district) {
          throw new Error('Region and district are required for technicians and district engineers');
        }
      } else if (role === 'regional_engineer') {
        if (!region) {
          throw new Error('Region is required for regional engineers');
        }
      }

      // Check if staff ID is already in use
      if (staffId) {
        const usersWithStaffId = await getDocs(query(collection(db, "users"), where("staffId", "==", staffId)));
        if (!usersWithStaffId.empty) {
          throw new Error('This staff ID is already in use by another user');
        }
      }

      // Initialize IDs
      let regionId = '';
      let districtId = '';

      // Only query for region if it's provided
      if (region) {
        const regionQuery = query(collection(db, "regions"), where("name", "==", region));
        const regionSnapshot = await getDocs(regionQuery);
        if (!regionSnapshot.empty) {
          regionId = regionSnapshot.docs[0].id;
        } else {
          throw new Error(`Region "${region}" not found`);
        }
      }

      // Only query for district if both district and regionId are provided
      if (district && regionId) {
        const districtQuery = query(
          collection(db, "districts"),
          where("name", "==", district),
          where("regionId", "==", regionId)
        );
        const districtSnapshot = await getDocs(districtQuery);
        if (!districtSnapshot.empty) {
          districtId = districtSnapshot.docs[0].id;
        } else {
          throw new Error(`District "${district}" not found in region "${region}"`);
        }
      }

      // Reset Firestore connection before creating user to ensure clean state
      await resetFirestoreConnection();

      // Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore
      const userData = {
        email,
        name,
        role,
        region: region || "",
        regionId: regionId || "",
        district: district || "",
        districtId: districtId || "",
        staffId: staffId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        disabled: false,
        mustChangePassword: false
      };

      try {
        // Use setDoc with merge option to handle potential race conditions
        await setDoc(doc(db, "users", user.uid), userData, { merge: true });
      } catch (firestoreError) {
        // If Firestore error occurs, handle it and clean up the auth user
        handleFirestoreError(firestoreError);
        await user.delete();
        throw new Error('Failed to create user document. Please try again.');
      }

      // Set user state
      setUser({
        id: user.uid,
        uid: user.uid,
        email: user.email || "",
        displayName: name,
        name: name,
        role: role,
        region: region || "",
        regionId: regionId || "",
        district: district || "",
        districtId: districtId || "",
        staffId: staffId || "",
        disabled: false,
        mustChangePassword: false
      });

      toast.success("Account created successfully");
    } catch (error: any) {
      console.error("Error signing up:", error);
      // If there's an error, attempt to clean up the auth user
      if (auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (deleteError) {
          console.error("Error cleaning up auth user:", deleteError);
        }
      }
      toast.error(error.message || "Failed to create account");
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to logout");
    }
  };

  const resetUserPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset instructions have been sent to your email");
    } catch (error: any) {
      console.error("Error resetting password:", error);
      if (error.code === 'auth/user-not-found') {
        toast.error("No account found with this email");
      } else {
        toast.error("Failed to send password reset email. Please try again.");
      }
      throw error;
    }
  };

  const adminResetUserPassword = async (userId: string) => {
    try {
      // Check if current user is a system admin
      if (user?.role !== "system_admin") {
        toast.error("Only system administrators can reset user passwords");
        return { tempPassword: "", email: "" };
      }

      // Get the user document
      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) {
        toast.error("User not found");
        return { tempPassword: "", email: "" };
      }

      const userData = userDoc.data();
      const userEmail = userData.email;

      if (!userEmail) {
        toast.error("User email not found");
        return { tempPassword: "", email: "" };
      }

      // Generate a temporary password that meets Firebase's requirements
      const tempPassword = Math.random().toString(36).slice(-8) + "A1!"; // Add complexity requirements
      
      try {
        // Send password reset email to the user
        await sendPasswordResetEmail(auth, userEmail);
        
        // Update Firestore with the temporary password and flag
        await updateDoc(doc(db, "users", userId), {
          tempPassword: tempPassword,
          mustChangePassword: true,
          updatedAt: serverTimestamp()
        });
        
        toast.success("Password reset email sent to user");
        return { tempPassword, email: userEmail };
      } catch (error) {
        console.error("Error sending reset email:", error);
        throw error;
      }
    } catch (error: any) {
      console.error("Error resetting user password:", error);
      toast.error("Failed to reset user password");
      throw error;
    }
  };

  const verifyStaffId = (staffId: string) => {
    const staffInfo = staffIds.find(id => id.id === staffId);
    if (!staffInfo) {
      return {
        isValid: false,
        staffInfo: undefined
      };
    }

    return {
      isValid: true,
      staffInfo: {
        name: staffInfo.name,
        role: staffInfo.role,
        region: staffInfo.region,
        district: staffInfo.district
      }
    };
  };

  const addStaffId = async (entry: Omit<StaffIdEntry, "id"> & { customId?: string }) => {
    try {
      // Check if current user is a system admin
      if (user?.role !== "system_admin") {
        toast.error("Only system administrators can manage staff IDs");
        return;
      }
      
      // Generate a random ID if not provided
      const id = entry.customId || Math.random().toString(36).substr(2, 9);
      
      // Create a cleaned entry with no undefined values
      const cleanedEntry = {
        name: entry.name,
        role: entry.role,
        region: entry.region || "",
        district: entry.district || ""
      };
      
      console.log("Adding staff ID with data:", cleanedEntry);
      
      // Set the document with merge option to be safer
      await setDoc(doc(db, "staffIds", id), cleanedEntry, { merge: true });
      
      setStaffIds(prev => [...prev, { id, ...cleanedEntry }]);
      toast.success("Staff ID added successfully");
      return id; // Return the ID for duplicate checking
    } catch (error) {
      console.error("Error adding staff ID:", error);
      let errorMessage = "Failed to add staff ID";
      
      // More specific error message
      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          errorMessage = "Permission denied. Only system administrators can add staff IDs.";
        }
      }
      
      toast.error(errorMessage);
      throw error; // Re-throw the error to be caught by the caller
    }
  };

  const updateStaffId = async (id: string, entry: Omit<StaffIdEntry, "id">) => {
    try {
      // Create a cleaned entry with no undefined values
      const cleanedEntry = {
        name: entry.name,
        role: entry.role,
        region: entry.region || "",
        district: entry.district || ""
      };
      
      await updateDoc(doc(db, "staffIds", id), cleanedEntry);
      setStaffIds(prev => prev.map(s => s.id === id ? { id, ...cleanedEntry } : s));
      toast.success("Staff ID updated successfully");
    } catch (error) {
      console.error("Error updating staff ID:", error);
      toast.error("Failed to update staff ID");
    }
  };

  const deleteStaffId = async (id: string) => {
    try {
      await deleteDoc(doc(db, "staffIds", id));
      setStaffIds(prev => prev.filter(s => s.id !== id));
      toast.success("Staff ID deleted successfully");
    } catch (error) {
      console.error("Error deleting staff ID:", error);
      toast.error("Failed to delete staff ID");
    }
  };

  const addUser = async (userData: Omit<User, "id">): Promise<string> => {
    try {
      // Create a new document with auto-generated ID
      const userRef = doc(collection(db, "users"));
      
      // Find region and district IDs if not provided
      let regionId = userData.regionId;
      let districtId = userData.districtId;
      
      if (!regionId && userData.region) {
        const regionDoc = await getDocs(query(collection(db, "regions"), where("name", "==", userData.region)));
        regionId = regionDoc.docs[0]?.id || "";
      }
      
      if (!districtId && userData.district && regionId) {
        const districtDoc = await getDocs(query(collection(db, "districts"), where("name", "==", userData.district), where("regionId", "==", regionId)));
        districtId = districtDoc.docs[0]?.id || "";
      }
      
      // Clean the data to prevent undefined values
      const cleanedData = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        region: userData.region || "",
        regionId: regionId || "",
        district: userData.district || "",
        districtId: districtId || "",
        password: userData.password || "",
        tempPassword: userData.tempPassword || "",
        mustChangePassword: userData.mustChangePassword || false,
        disabled: userData.disabled || false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(userRef, cleanedData);

      // Log the action
      if (user?.uid && user?.name && user?.role) {
        console.log("[Add] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          id: userRef.id,
          userName: userData.name,
          userEmail: userData.email,
          userRole: userData.role,
          region: userData.region,
          district: userData.district
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "Create",
          "User",
          userRef.id,
          `Created new user ${userData.name} with role ${userData.role}`,
          userData.region,
          userData.district
        );
      }

      toast.success("User added successfully");
      return userRef.id;
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error("Failed to add user");
      throw error;
    }
  };
  
  const updateUser = async (id: string, userData: Partial<User>): Promise<void> => {
    try {
      const userRef = doc(db, "users", id);
      
      // Get the user data before updating
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("User not found");
      }
      const oldUserData = userDoc.data();
      
      // Find region and district IDs if not provided
      let regionId = userData.regionId;
      let districtId = userData.districtId;
      
      if (!regionId && userData.region) {
        const regionDoc = await getDocs(query(collection(db, "regions"), where("name", "==", userData.region)));
        regionId = regionDoc.docs[0]?.id || "";
      }
      
      if (!districtId && userData.district && regionId) {
        const districtDoc = await getDocs(query(collection(db, "districts"), where("name", "==", userData.district), where("regionId", "==", regionId)));
        districtId = districtDoc.docs[0]?.id || "";
      }
      
      // Remove undefined values and add updatedAt timestamp
      const updateData: any = { 
        ...userData,
        regionId: regionId || "",
        districtId: districtId || "",
        updatedAt: serverTimestamp() 
      };
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          updateData[key] = "";
        }
      });
      
      await updateDoc(userRef, updateData);

      // Log the action
      if (user?.uid && user?.name && user?.role) {
        console.log("[Update] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          id,
          oldData: oldUserData,
          newData: updateData
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "Update",
          "User",
          id,
          `Updated user ${oldUserData.name} (${oldUserData.email})`,
          oldUserData.region,
          oldUserData.district
        );
      }

      toast.success("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
      throw error;
    }
  };
  
  const deleteUser = async (id: string): Promise<void> => {
    try {
      // Get the user data before deleting
      const userRef = doc(db, "users", id);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("User not found");
      }
      const userData = userDoc.data();

      // Delete the user
      await deleteDoc(userRef);

      // Log the action
      if (user?.uid && user?.name && user?.role) {
        console.log("[Delete] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          id,
          deletedUserName: userData.name,
          deletedUserEmail: userData.email,
          deletedUserRole: userData.role
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "Delete",
          "User",
          id,
          `Deleted user ${userData.name} (${userData.email}) with role ${userData.role}`,
          userData.region,
          userData.district
        );
      }

      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
      throw error;
    }
  };
  
  const toggleUserStatus = async (id: string, disabled: boolean): Promise<void> => {
    try {
      // Get the user data before updating
      const userRef = doc(db, "users", id);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("User not found");
      }
      const userData = userDoc.data();

      // Update the user status
      await updateDoc(userRef, { 
        disabled,
        updatedAt: serverTimestamp()
      });

      // Log the action
      if (user?.uid && user?.name && user?.role) {
        console.log("[Status] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          id,
          targetUserName: userData.name,
          targetUserEmail: userData.email,
          newStatus: disabled ? 'disabled' : 'enabled'
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "Update",
          "UserStatus",
          id,
          `${disabled ? 'Disabled' : 'Enabled'} user ${userData.name} (${userData.email})`,
          userData.region,
          userData.district
        );
      }

      toast.success(`User ${disabled ? 'disabled' : 'enabled'} successfully`);
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error(`Failed to ${disabled ? 'disable' : 'enable'} user`);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        users,
        setUsers,
        setUser,
        addUser,
        updateUser,
        deleteUser,
        toggleUserStatus,
        resetUserPassword,
        adminResetUserPassword,
        verifyStaffId,
        staffIds,
        setStaffIds,
        addStaffId,
        updateStaffId,
        deleteStaffId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

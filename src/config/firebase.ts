import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, disableNetwork, enableNetwork, initializeFirestore, CACHE_SIZE_UNLIMITED, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Validate environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID'
];

// Validate all required environment variables are present
for (const envVar of requiredEnvVars) {
  if (!import.meta.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Security configuration
const securityConfig = {
  sessionTimeout: parseInt(import.meta.env.VITE_SESSION_TIMEOUT || '3600', 10),
  maxLoginAttempts: parseInt(import.meta.env.VITE_MAX_LOGIN_ATTEMPTS || '5', 10),
  rateLimitWindow: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW || '900', 10),
  rateLimitMaxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_MAX_REQUESTS || '100', 10)
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase only if it hasn't been initialized
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Auth first
const auth = getAuth(app);

// Initialize Firestore with memory-only cache to prevent state issues
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true, // Use long polling to avoid WebSocket issues
});

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] The current browser does not support persistence.');
    }
  });
}

// Reset Firestore connection to ensure clean state
const resetFirestoreConnection = async () => {
  try {
    if (!navigator.onLine) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await disableNetwork(db);
    } catch (disableError) {
      console.warn('[Firebase] Error disabling network:', disableError);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await enableNetwork(db);
    } catch (enableError) {
      console.error('[Firebase] Error enabling network:', enableError);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  } catch (error) {
    console.error('[Firebase] Error resetting Firestore connection:', error);
    if (typeof window !== 'undefined' && error.message?.includes('INTERNAL ASSERTION FAILED')) {
      window.location.reload();
    }
  }
}

// Add error handler for Firestore
const handleFirestoreError = (error: any) => {
  console.error('[Firebase] Firestore error detected:', error);
  
  if (error.message && error.message.includes('INTERNAL ASSERTION FAILED: Unexpected state')) {
    resetFirestoreConnection();
  }
};

// Initialize Functions
const functions = getFunctions(app);

// Initialize Storage
const storage = getStorage(app);

// Configure auth persistence
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('[Firebase] Error setting auth persistence:', error);
  });

  const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);
  
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && 
        event.reason.message.includes('INTERNAL ASSERTION FAILED: Unexpected state')) {
      resetFirestoreConnection();
      event.preventDefault();
    }
  });
}

// Add auth state listener for debugging
auth.onAuthStateChanged((user) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Firebase] Auth state changed:', { 
      hasUser: !!user, 
      uid: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified
    });
  }
});

export { auth, db, functions, storage, securityConfig, resetFirestoreConnection, handleFirestoreError }; 
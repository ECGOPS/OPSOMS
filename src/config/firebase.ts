import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, disableNetwork, enableNetwork, initializeFirestore, CACHE_SIZE_UNLIMITED, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFunctions } from 'firebase/functions';

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
  console.log('[Firebase] Initializing Firebase app');
  app = initializeApp(firebaseConfig);
} else {
  console.log('[Firebase] Using existing Firebase app');
  app = getApps()[0];
}

// Initialize Auth first
console.log('[Firebase] Initializing Auth');
const auth = getAuth(app);

// Initialize Firestore with memory-only cache to prevent state issues
console.log('[Firebase] Initializing Firestore with memory-only cache');
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
    console.log('[Firebase] Resetting Firestore connection');
    
    // Check if we're already offline
    if (!navigator.onLine) {
      console.log('[Firebase] Already offline, skipping network reset');
      return;
    }

    // Wait for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await disableNetwork(db);
      console.log('[Firebase] Network disabled');
    } catch (disableError) {
      console.warn('[Firebase] Error disabling network:', disableError);
      // Continue anyway as the network might already be disabled
    }
    
    // Wait a moment before re-enabling
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await enableNetwork(db);
      console.log('[Firebase] Network re-enabled');
    } catch (enableError) {
      console.error('[Firebase] Error enabling network:', enableError);
      // If we can't re-enable the network, we should probably reload the page
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  } catch (error) {
    console.error('[Firebase] Error resetting Firestore connection:', error);
    // If we get a critical error, reload the page
    if (typeof window !== 'undefined' && error.message?.includes('INTERNAL ASSERTION FAILED')) {
      window.location.reload();
    }
  }
};

// Add error handler for Firestore
const handleFirestoreError = (error: any) => {
  console.error('[Firebase] Firestore error detected:', error);
  
  // If we detect the "Unexpected state" error, reset the connection
  if (error.message && error.message.includes('INTERNAL ASSERTION FAILED: Unexpected state')) {
    console.log('[Firebase] Detected "Unexpected state" error, resetting connection');
    resetFirestoreConnection();
  }
};

// Initialize Functions
const functions = getFunctions(app);

// Configure auth persistence
if (typeof window !== 'undefined') {
  console.log('[Firebase] Configuring auth persistence');
  
  // Set auth persistence
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('[Firebase] Error setting auth persistence:', error);
  });

  // Initialize analytics only in browser context and if supported
  const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);
  
  // Add global error handler for Firestore
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && 
        event.reason.message.includes('INTERNAL ASSERTION FAILED: Unexpected state')) {
      console.log('[Firebase] Caught unhandled Firestore error, resetting connection');
      resetFirestoreConnection();
      event.preventDefault(); // Prevent the error from propagating
    }
  });
}

// Add auth state listener for debugging
auth.onAuthStateChanged((user) => {
  console.log('[Firebase] Auth state changed:', { 
    hasUser: !!user, 
    uid: user?.uid,
    email: user?.email,
    emailVerified: user?.emailVerified
  });
});

export { auth, db, functions, securityConfig, resetFirestoreConnection, handleFirestoreError }; 
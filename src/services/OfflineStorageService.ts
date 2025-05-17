import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { OP5Fault, ControlSystemOutage } from '@/lib/types';
import { FaultService } from './FaultService';
import { getAuth } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface FaultDB extends DBSchema {
  pendingFaults: {
    key: string;
    value: {
      fault: Omit<OP5Fault, 'id'> | Omit<ControlSystemOutage, 'id'>;
      timestamp: number;
      type: 'op5' | 'control';
    };
  };
}

interface PendingFault {
  key: string;
  fault: Omit<OP5Fault, 'id'> | Omit<ControlSystemOutage, 'id'>;
  timestamp: number;
  type: 'op5' | 'control';
}

export class OfflineStorageService {
  private static instance: OfflineStorageService;
  private db: IDBPDatabase<FaultDB> | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private faultService: FaultService;
  private dbInitialized: boolean = false;
  private isSyncing: boolean = false;
  private syncQueue: Promise<void> = Promise.resolve();

  private constructor() {
    this.initializeDB();
    this.setupOnlineStatusListener();
    this.faultService = FaultService.getInstance();
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  public static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  private async initializeDB() {
    try {
      console.log('[OfflineStorage] Initializing IndexedDB...');
      this.db = await openDB<FaultDB>('faultmaster-offline', 1, {
        upgrade(db) {
          console.log('[OfflineStorage] Upgrading database...');
          if (!db.objectStoreNames.contains('pendingFaults')) {
            console.log('[OfflineStorage] Creating pendingFaults store...');
            db.createObjectStore('pendingFaults', { keyPath: 'key' });
          }
        },
      });
      this.dbInitialized = true;
      console.log('[OfflineStorage] Database initialized successfully');
    } catch (error) {
      console.error('[OfflineStorage] Failed to initialize IndexedDB:', error);
      this.dbInitialized = false;
    }
  }

  private setupOnlineStatusListener() {
    window.addEventListener('online', () => {
      console.log('[OfflineStorage] Network connection restored');
      this.isOnline = true;
      this.syncPendingFaults();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineStorage] Network connection lost');
      this.isOnline = false;
    });
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.syncPendingFaults();
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  private async getCurrentUser() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Only try to refresh token if we're online
    if (this.isOnline) {
      try {
        await user.getIdToken(true);
      } catch (error) {
        console.error('Error refreshing token:', error);
        // Don't throw error if we're offline - just use the existing token
        if (this.isOnline) {
          throw new Error('Authentication token expired');
        }
      }
    }

    return user;
  }

  private async ensureAuthenticated() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      // Only try to re-authenticate if we're online
      if (this.isOnline) {
        // Try to get stored credentials from localStorage
        const storedEmail = localStorage.getItem('userEmail');
        const storedPassword = localStorage.getItem('userPassword');
        
        if (storedEmail && storedPassword) {
          try {
            await signInWithEmailAndPassword(auth, storedEmail, storedPassword);
          } catch (error) {
            console.error('Error re-authenticating:', error);
            throw new Error('Authentication failed');
          }
        } else {
          throw new Error('User not authenticated');
        }
      } else {
        // If we're offline and have no user, we can't proceed
        throw new Error('User not authenticated and offline');
      }
    }
  }

  public async saveFaultOffline(fault: Omit<OP5Fault, 'id'> | Omit<ControlSystemOutage, 'id'>, type: 'op5' | 'control'): Promise<void> {
    console.log('[OfflineStorage] Attempting to save fault offline...');
    
    if (!this.dbInitialized) {
      console.log('[OfflineStorage] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.db) {
      console.error('[OfflineStorage] Database not available after initialization');
      throw new Error('Database not initialized');
    }

    const key = `fault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pendingFault: PendingFault = {
      key,
      fault,
      timestamp: Date.now(),
      type
    };

    try {
      console.log('[OfflineStorage] Saving fault with key:', key);
      await this.db.add('pendingFaults', pendingFault);
      console.log('[OfflineStorage] Fault saved successfully');
    } catch (error) {
      console.error('[OfflineStorage] Error saving fault:', error);
      throw error;
    }
  }

  public async getPendingFaults(): Promise<PendingFault[]> {
    console.log('[OfflineStorage] Getting pending faults...');
    
    if (!this.dbInitialized) {
      console.log('[OfflineStorage] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.db) {
      console.error('[OfflineStorage] Database not available after initialization');
      throw new Error('Database not initialized');
    }

    try {
      const keys = await this.db.getAllKeys('pendingFaults');
      const values = await this.db.getAll('pendingFaults');
      
      console.log('[OfflineStorage] Found', keys.length, 'pending faults');
      
      return keys.map((key, index) => ({
        key,
        fault: values[index].fault,
        timestamp: values[index].timestamp,
        type: values[index].type
      }));
    } catch (error) {
      console.error('[OfflineStorage] Error getting pending faults:', error);
      throw error;
    }
  }

  public async removePendingFault(key: string): Promise<void> {
    console.log('[OfflineStorage] Removing pending fault:', key);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.delete('pendingFaults', key);
      console.log('[OfflineStorage] Fault removed successfully');
    } catch (error) {
      console.error('[OfflineStorage] Error removing fault:', error);
      throw error;
    }
  }

  public async syncPendingFaults(): Promise<void> {
    console.log('[OfflineStorage] Starting sync of pending faults...');
    
    if (!this.isOnline || this.syncInProgress) {
      console.log('[OfflineStorage] Sync skipped - online:', this.isOnline, 'sync in progress:', this.syncInProgress);
      return;
    }

    this.syncInProgress = true;
    this.syncQueue = this.syncQueue.then(async () => {
      try {
        const pendingFaults = await this.getPendingFaults();
        console.log('[OfflineStorage] Found', pendingFaults.length, 'faults to sync');
        
        for (const { key, fault, type } of pendingFaults) {
          await this.syncFaultWithRetry(key, fault, type);
        }
      } finally {
        this.syncInProgress = false;
        console.log('[OfflineStorage] Sync completed');
      }
    });

    return this.syncQueue;
  }

  public isInternetAvailable(): boolean {
    return this.isOnline;
  }

  public async saveOP5FaultOffline(fault: Omit<OP5Fault, 'id'>): Promise<void> {
    try {
      // Get user info if available, but don't fail if we can't
      let userId = 'offline_user';
      try {
        await this.ensureAuthenticated();
        const user = await this.getCurrentUser();
        userId = user.uid;
      } catch (error) {
        console.warn('Could not get authenticated user, using offline_user:', error);
      }
      
      const offlineFault = {
        ...fault,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        updatedBy: userId,
        isOffline: true
      };

      await this.saveFaultOffline(offlineFault, 'op5');

      if (this.isOnline) {
        await this.syncPendingFaults();
      }
    } catch (error) {
      console.error('Error saving fault offline:', error);
      throw error;
    }
  }

  public async saveControlSystemOutageOffline(outage: Omit<ControlSystemOutage, 'id'>): Promise<void> {
    try {
      // Get user info if available, but don't fail if we can't
      let userId = 'offline_user';
      try {
        await this.ensureAuthenticated();
        const user = await this.getCurrentUser();
        userId = user.uid;
      } catch (error) {
        console.warn('Could not get authenticated user, using offline_user:', error);
      }
      
      const offlineOutage = {
        ...outage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        updatedBy: userId,
        isOffline: true
      };

      await this.saveFaultOffline(offlineOutage, 'control');

      if (this.isOnline) {
        await this.syncPendingFaults();
      }
    } catch (error) {
      console.error('Error saving outage offline:', error);
      throw error;
    }
  }

  private async syncFaultWithRetry(key: string, fault: any, type: 'op5' | 'control', retryCount = 0): Promise<boolean> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    try {
      console.log(`[OfflineStorage] Attempting to sync fault ${key} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Get current user and ensure authentication
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.error('[OfflineStorage] No authenticated user found during sync');
        // Try to re-authenticate using stored credentials
        const storedEmail = localStorage.getItem('userEmail');
        const storedPassword = localStorage.getItem('userPassword');
        
        if (storedEmail && storedPassword) {
          try {
            await signInWithEmailAndPassword(auth, storedEmail, storedPassword);
          } catch (error) {
            console.error('[OfflineStorage] Failed to re-authenticate:', error);
            throw new Error('Authentication failed');
          }
        } else {
          throw new Error('Authentication required for syncing');
        }
      }

      // Force token refresh before sync
      try {
        const newToken = await currentUser.getIdToken(true);
        console.log('[OfflineStorage] Successfully refreshed token');
      } catch (error) {
        console.error('[OfflineStorage] Failed to refresh token:', error);
        // If token refresh fails, try to re-authenticate
        const storedEmail = localStorage.getItem('userEmail');
        const storedPassword = localStorage.getItem('userPassword');
        
        if (storedEmail && storedPassword) {
          try {
            await signInWithEmailAndPassword(auth, storedEmail, storedPassword);
            console.log('[OfflineStorage] Successfully re-authenticated');
          } catch (error) {
            console.error('[OfflineStorage] Failed to re-authenticate:', error);
            throw new Error('Authentication failed');
          }
        } else {
          throw new Error('Authentication token expired');
        }
      }
      
      // Ensure we have a valid user after all authentication attempts
      const finalUser = auth.currentUser;
      if (!finalUser) {
        throw new Error('No authenticated user available after authentication attempts');
      }

      // Update the fault with the current user's ID
      const updatedFault = {
        ...fault,
        createdBy: finalUser.uid,
        updatedBy: finalUser.uid,
        updatedAt: new Date().toISOString()
      };
      
      if (type === 'op5') {
        await this.faultService.createOP5Fault(updatedFault as Omit<OP5Fault, 'id'>);
      } else {
        await this.faultService.createControlSystemOutage(updatedFault as Omit<ControlSystemOutage, 'id'>);
      }
      
      await this.removePendingFault(key);
      console.log(`[OfflineStorage] Successfully synced fault ${key}`);
      return true;
    } catch (error) {
      console.error(`[OfflineStorage] Failed to sync fault ${key}:`, error);
      
      // If it's an authentication error, don't retry
      if (error instanceof Error && 
          (error.message.includes('Authentication') || 
           error.message.includes('permission'))) {
        console.error('[OfflineStorage] Authentication error, not retrying');
        return false;
      }
      
      if (retryCount < maxRetries) {
        console.log(`[OfflineStorage] Retrying sync for fault ${key} in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.syncFaultWithRetry(key, fault, type, retryCount + 1);
      }
      
      return false;
    }
  }
}

export default OfflineStorageService; 
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SubstationInspection } from '@/lib/asset-types';
import { getAuth } from 'firebase/auth';
import { toast } from '@/components/ui/sonner';
import { getFirestore } from 'firebase/firestore';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, query, where, getDoc, setDoc } from 'firebase/firestore';

export interface SubstationInspectionDB extends DBSchema {
  substationInspections: {
    key: string;
    value: PendingSubstationInspection;
  };
}

export interface PendingSubstationInspection {
  id: string;
  record: SubstationInspection;
  action: 'create' | 'update' | 'delete';
  timestamp: string;
  retryCount: number;
  lastRetry?: string;
}

export class SubstationInspectionService {
  private static instance: SubstationInspectionService;
  private db: IDBPDatabase<SubstationInspectionDB> | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  private constructor() {
    console.log('Initializing SubstationInspectionService...');
    this.init().then(() => {
      console.log('Service initialized, setting up online listener');
      this.setupOnlineStatusListener();
    });

    // Also set up listeners immediately in case init takes too long
    this.setupOnlineStatusListener();
  }

  public static getInstance(): SubstationInspectionService {
    if (!SubstationInspectionService.instance) {
      console.log('Creating new SubstationInspectionService instance');
      SubstationInspectionService.instance = new SubstationInspectionService();
    }
    return SubstationInspectionService.instance;
  }

  public isInternetAvailable(): boolean {
    return this.isOnline;
  }

  private async init() {
    try {
      console.log('Opening IndexedDB...');
      this.db = await openDB<SubstationInspectionDB>('substation-inspection-offline', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('substationInspections')) {
            console.log('Creating substationInspections store');
            db.createObjectStore('substationInspections', { keyPath: 'id' });
          }
        },
      });
      console.log('IndexedDB initialized successfully');
    } catch (error) {
      console.error('Error initializing SubstationInspectionService:', error);
    }
  }

  private setupOnlineStatusListener() {
    console.log('Setting up online status listener. Current status:', navigator.onLine);
    
    // Remove any existing listeners
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    // Add new listeners
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // If we're already online, trigger sync
    if (navigator.onLine && !this.syncInProgress) {
      console.log('Already online, triggering initial sync...');
      this.handleOnline();
    }
  }

  private handleOnline = async () => {
    console.log('Device is back online, triggering sync...');
    this.isOnline = true;
    
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    try {
      this.syncInProgress = true;
      
      // Verify database is initialized
      if (!this.db) {
        console.error('Database not initialized during sync');
        await this.init();
        if (!this.db) {
          throw new Error('Failed to initialize database');
        }
      }

      // Get pending records
      const pendingRecords = await this.getPendingSubstationInspectionRecords();
      console.log('Found pending records to sync:', pendingRecords.length);
      
      if (pendingRecords.length === 0) {
        console.log('No pending records to sync');
        return;
      }

      const result = await this.syncSubstationInspectionRecords();
      console.log('Sync completed:', result);
      
      // Dispatch event to notify UI of sync completion
      window.dispatchEvent(new CustomEvent('substationInspectionSyncCompleted', {
        detail: result
      }));

      // After sync is complete, refresh the data
      await this.refreshData();
    } catch (error) {
      console.error('Error during sync:', error);
      // Dispatch event to notify UI of sync failure
      window.dispatchEvent(new CustomEvent('substationInspectionSyncFailed', {
        detail: { error }
      }));
    } finally {
      this.syncInProgress = false;
    }
  };

  private handleOffline = () => {
    console.log('Device is offline');
    this.isOnline = false;
    // Dispatch event to notify UI of offline status
    window.dispatchEvent(new CustomEvent('substationInspectionOffline'));
  };

  // Add a method to refresh data
  private async refreshData(): Promise<void> {
    try {
      console.log('Refreshing data after sync...');
      const allRecords = await this.getAllSubstationInspections();
      
      // Dispatch event with refreshed data
      window.dispatchEvent(new CustomEvent('substationInspectionDataRefreshed', {
        detail: { records: allRecords }
      }));
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }

  // Add a method to manually trigger sync and refresh
  public async triggerSyncAndRefresh(): Promise<void> {
    console.log('Manually triggering sync and refresh...');
    await this.handleOnline();
  }

  private async checkForDuplicateInspection(record: SubstationInspection): Promise<boolean> {
    try {
      // Check by ID
      const docRef = doc(getFirestore(), "substationInspections", record.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log('Duplicate found by ID:', record.id);
        return true;
      }

      // Check by originalOfflineId
      if (record.originalOfflineId) {
        const existingQuery = query(
          collection(getFirestore(), "substationInspections"),
          where("originalOfflineId", "==", record.originalOfflineId)
        );
        const existingSnapshot = await getDocs(existingQuery);
        if (!existingSnapshot.empty) {
          console.log('Duplicate found by originalOfflineId:', record.originalOfflineId);
          return true;
        }
      }

      // Check by unique combination of fields
      const uniqueQuery = query(
        collection(getFirestore(), "substationInspections"),
        where("region", "==", record.region),
        where("district", "==", record.district),
        where("substationNo", "==", record.substationNo),
        where("date", "==", record.date)
      );
      const uniqueSnapshot = await getDocs(uniqueQuery);
      if (!uniqueSnapshot.empty) {
        console.log('Duplicate found by unique combination');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return false;
    }
  }

  public async saveSubstationInspectionOffline(record: SubstationInspection, action: 'create' | 'update' | 'delete'): Promise<void> {
    console.log('SubstationInspectionService: Entering saveSubstationInspectionOffline', { recordId: record.id, action });
    if (!this.db) {
      console.error('Database not initialized');
      throw new Error('Database not initialized');
    }

    try {
      // Check for duplicates before saving
      const isDuplicate = await this.checkForDuplicateInspection(record);
      let finalAction = action;
      if (isDuplicate && action === 'create') {
        console.log('Duplicate inspection found, updating instead');
        finalAction = 'update';
      }

      console.log('Saving record offline:', record.id, 'Action:', finalAction);
      const pendingRecord: PendingSubstationInspection = {
        id: record.id,
        record: {
          ...record,
          syncStatus: 'pending',
          createdAt: record.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        action: finalAction,
        timestamp: Date.now().toString(),
        retryCount: 0
      };

      await this.db.put('substationInspections', pendingRecord);
      console.log('SubstationInspectionService: Record saved offline successfully', { recordId: record.id });

      // Dispatch event for UI update
      window.dispatchEvent(new CustomEvent('substationInspectionRecordAdded', {
        detail: {
          record: pendingRecord.record,
          action: finalAction,
          status: 'pending'
        }
      }));
    } catch (error) {
      console.error('Error saving offline record:', error);
      throw error;
    }
  }

  public async getPendingSubstationInspectionRecords(): Promise<PendingSubstationInspection[]> {
    if (!this.db) {
      console.error('Database not initialized');
      await this.init();
      if (!this.db) {
        throw new Error('Failed to initialize database');
      }
    }

    try {
      const records = await this.db.getAll('substationInspections');
      console.log('Retrieved pending records:', records.length);
      return records;
    } catch (error) {
      console.error('Error getting pending records:', error);
      return [];
    }
  }

  private async removePendingSubstationInspection(id: string): Promise<void> {
    if (!this.db) {
      console.error('Database not initialized');
      await this.init();
      if (!this.db) {
        throw new Error('Failed to initialize database');
      }
    }

    try {
      await this.db.delete('substationInspections', id);
      console.log('Successfully removed pending record:', id);
    } catch (error) {
      console.error('Error removing pending record:', id, error);
      throw error;
    }
  }

  private deepCleanUndefined(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepCleanUndefined(item));
    }
    
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, this.deepCleanUndefined(value)])
    );
  }

  private cleanDataForFirestore(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.cleanDataForFirestore(item));
    }

    if (typeof data === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanDataForFirestore(value);
        }
      }
      return cleaned;
    }

    return data;
  }

  public async syncSubstationInspectionRecords(): Promise<{ successCount: number; failureCount: number }> {
    if (!navigator.onLine) {
      console.log('Device is offline, skipping sync');
      return { successCount: 0, failureCount: 0 };
    }

    if (!this.db) {
      console.error('Database not initialized during sync');
      await this.init();
      if (!this.db) {
        throw new Error('Failed to initialize database');
      }
    }

    console.log('Starting sync process...');
    const pendingRecords = await this.getPendingSubstationInspectionRecords();
    console.log('Found pending records:', pendingRecords.length);

    if (pendingRecords.length === 0) {
      console.log('No pending records to sync');
      return { successCount: 0, failureCount: 0 };
    }

    let successCount = 0;
    let failureCount = 0;

    for (const pending of pendingRecords) {
      try {
        console.log('Processing record:', pending.id, 'Action:', pending.action);
        const { record, action } = pending;
        
        // Clean the data before syncing
        const recordToSync = this.cleanDataForFirestore(record);
        console.log('Cleaned record for sync:', recordToSync);

        // Find existing document by ID or originalOfflineId
        let docRef = doc(getFirestore(), "substationInspections", recordToSync.id);
        let docSnap = await getDoc(docRef);
        
        if (!docSnap.exists() && recordToSync.originalOfflineId) {
          const existingQuery = query(
            collection(getFirestore(), "substationInspections"),
            where("originalOfflineId", "==", recordToSync.originalOfflineId)
          );
          const existingSnapshot = await getDocs(existingQuery);
          if (!existingSnapshot.empty) {
            docRef = doc(getFirestore(), "substationInspections", existingSnapshot.docs[0].id);
            docSnap = await getDoc(docRef);
          }
        }

        // Determine if this is a create or update operation
        const isCreate = action === 'create' && !docSnap.exists();
        
        if (isCreate) {
          console.log('Creating new record in Firestore');
          await setDoc(docRef, {
            ...recordToSync,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            syncStatus: 'synced'
          });
        } else {
          console.log('Updating existing record in Firestore');
          await updateDoc(docRef, {
            ...recordToSync,
            updatedAt: serverTimestamp(),
            syncStatus: 'synced'
          });
        }

        // Remove the offline record after successful sync
        await this.removePendingSubstationInspection(pending.id);

        // Dispatch event for UI update
        window.dispatchEvent(new CustomEvent('substationInspectionRecordAdded', {
          detail: {
            record: { ...recordToSync, syncStatus: 'synced' },
            action: isCreate ? 'create' : 'update',
            status: 'success'
          }
        }));

        successCount++;
      } catch (error) {
        console.error('Error syncing record:', error);
        failureCount++;
        
        // Update retry count and timestamp
        await this.updatePendingSyncItem(pending.id, {
          ...pending,
          retryCount: (pending.retryCount || 0) + 1,
          lastRetry: new Date().toISOString()
        });
      }
    }

    console.log('Sync process completed. Success:', successCount, 'Failures:', failureCount);
    return { successCount, failureCount };
  }

  private async updateOfflineRecord(id: string, updates: Partial<SubstationInspection>): Promise<void> {
    const db = await openDB('substation-inspection-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('substationInspections')) {
          db.createObjectStore('substationInspections', { keyPath: 'id' });
        }
      },
    });
    const tx = db.transaction('substationInspections', 'readwrite');
    const store = tx.objectStore('substationInspections');
    
    const record = await store.get(id);
    if (record) {
      await store.put({ ...record, ...updates });
    }
    await tx.done;
  }

  private async deleteOfflineRecord(id: string): Promise<void> {
    const db = await openDB('substation-inspection-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('substationInspections')) {
          db.createObjectStore('substationInspections', { keyPath: 'id' });
        }
      },
    });
    const tx = db.transaction('substationInspections', 'readwrite');
    const store = tx.objectStore('substationInspections');
    await store.delete(id);
    await tx.done;
  }

  public async getOfflineSubstationInspections(): Promise<SubstationInspection[]> {
    console.log('SubstationInspectionService: Entering getOfflineSubstationInspections');
    if (!this.db) {
      console.error('Database not initialized');
      throw new Error('Database not initialized');
    }

    try {
      const records = await this.db.getAll('substationInspections');
      console.log('SubstationInspectionService: Retrieved pending records:', records.length, records);
      // Map PendingSubstationInspection to SubstationInspection
      return records.map(record => ({
        ...record.record,
        syncStatus: 'pending',
        createdAt: record.record.createdAt || new Date().toISOString(),
        updatedAt: record.record.updatedAt || new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting offline inspections:', error);
      return [];
    }
  }

  public async getAllSubstationInspections(): Promise<SubstationInspection[]> {
    try {
      // Always get offline data first
      const offlineRecords = await this.getOfflineSubstationInspections();
      
      // If we're online, get Firestore data
      if (this.isOnline) {
        try {
          const db = getFirestore();
          const snapshot = await getDocs(collection(db, 'substationInspections'));
          const firestoreRecords = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
              syncStatus: 'synced'
            } as SubstationInspection;
          });

          // Create a map of all records by ID
          const recordMap = new Map<string, SubstationInspection>();
          
          // Add Firestore records to map
          firestoreRecords.forEach(record => {
            recordMap.set(record.id, record);
          });

          // Add offline records that aren't in Firestore
          offlineRecords.forEach(record => {
            if (!recordMap.has(record.id)) {
              recordMap.set(record.id, record);
            }
          });

          // Convert map to array and sort by updatedAt
          return Array.from(recordMap.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        } catch (error) {
          console.error('Error fetching Firestore data:', error);
          // If there's an error fetching Firestore data, return offline records
          return offlineRecords;
        }
      }

      // If offline, just return offline records
      return offlineRecords;
    } catch (error) {
      console.error('Error getting all substation inspections:', error);
      // If there's an error, return offline records as fallback
      return this.getOfflineSubstationInspections();
    }
  }

  private async updatePendingSyncItem(id: string, updates: Partial<PendingSubstationInspection>): Promise<void> {
    const db = await openDB('substation-inspection-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('substationInspections')) {
          db.createObjectStore('substationInspections', { keyPath: 'id' });
        }
      },
    });
    const tx = db.transaction('substationInspections', 'readwrite');
    const store = tx.objectStore('substationInspections');
    
    const record = await store.get(id);
    if (record) {
      await store.put({ ...record, ...updates });
    }
    await tx.done;
  }
} 
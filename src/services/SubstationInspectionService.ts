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
  firestoreId?: string;
}

interface PendingSyncItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  record: SubstationInspection;
  retryCount?: number;
  lastRetry?: string;
  firestoreId?: string;
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
      if (this.db) {
        console.log('Database already initialized');
        return;
      }

      this.db = await openDB<SubstationInspectionDB>('substation-inspection-offline', 1, {
        upgrade(db) {
          console.log('Upgrading database...');
          if (!db.objectStoreNames.contains('substationInspections')) {
            console.log('Creating substationInspections store');
            db.createObjectStore('substationInspections', { keyPath: 'id' });
          }
        },
        blocked() {
          console.log('Database blocked');
        },
        blocking() {
          console.log('Database blocking');
        },
        terminated() {
          console.log('Database terminated');
          this.db = null;
        }
      });
      console.log('IndexedDB initialized successfully');
    } catch (error) {
      console.error('Error initializing SubstationInspectionService:', error);
      this.db = null;
      throw error;
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

  private async ensureDBInitialized() {
    if (!this.db) {
      console.log('Database not initialized, attempting to initialize...');
      try {
        await this.init();
        if (!this.db) {
          throw new Error('Failed to initialize database after attempt');
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
        throw new Error('Database initialization failed');
      }
    }

    // Check if the database is still open
    if (this.db.transaction) {
      try {
        // Try a test transaction to verify the connection
        const tx = this.db.transaction('substationInspections', 'readonly');
        await tx.done;
      } catch (error) {
        console.log('Database connection lost, reinitializing...');
        this.db = null;
        await this.init();
      }
    }
  }

  public async saveSubstationInspectionOffline(inspection: SubstationInspection, action: 'create' | 'update' | 'delete'): Promise<void> {
    try {
      await this.ensureDBInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const tx = this.db.transaction('substationInspections', 'readwrite');
      const store = tx.objectStore('substationInspections');

      // For delete action, use the correct ID
      const recordId = action === 'delete' ? (inspection.firestoreId || inspection.id) : inspection.id;

      // Format the data according to PendingSubstationInspection interface
      const pendingRecord: PendingSubstationInspection = {
        id: recordId,
        record: {
          ...inspection,
          syncStatus: 'pending',
          updatedAt: new Date().toISOString()
        },
        action,
        timestamp: Date.now().toString(),
        retryCount: 0,
        firestoreId: inspection.firestoreId
      };

      // Store the record in IndexedDB
      await store.put(pendingRecord);
      await tx.done;

      // Dispatch event for UI update
      const event = new CustomEvent('substationInspectionUpdated', {
        detail: {
          action,
          inspection: pendingRecord.record
        }
      });
      window.dispatchEvent(event);

      // Log for debugging
      console.log(`Saved inspection offline (${action}):`, pendingRecord);
    } catch (error) {
      console.error('Error saving inspection offline:', error);
      // If we get a database error, try to reinitialize
      if (error.name === 'InvalidStateError') {
        this.db = null;
        await this.init();
        // Retry the operation once
        return this.saveSubstationInspectionOffline(inspection, action);
      }
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
      return data.map(item => this.cleanDataForFirestore(item)).filter(item => item !== null);
    }

    if (typeof data === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        const cleanedValue = this.cleanDataForFirestore(value);
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return Object.keys(cleaned).length > 0 ? cleaned : null;
    }

    return data;
  }

  private async syncSubstationInspectionRecords(): Promise<{ successCount: number; failureCount: number }> {
    let pendingRecords: PendingSyncItem[] = [];
    
    try {
      if (!this.db) {
        console.error('Database not initialized');
        return { successCount: 0, failureCount: 0 };
      }

      // Get all pending records
      pendingRecords = await this.getPendingSubstationInspectionRecords();
      console.log('SubstationInspectionService: Retrieved pending records:', pendingRecords.length, pendingRecords);

      if (pendingRecords.length === 0) {
        console.log('No pending records to sync');
        return { successCount: 0, failureCount: 0 };
      }

      let successCount = 0;
      let failureCount = 0;

      // Process each pending record
      for (const record of pendingRecords) {
        try {
          console.log('Processing pending record:', record);
          
          if (!record || !record.id) {
            console.error('Invalid record:', record);
            failureCount++;
            continue;
          }

          // Handle different actions
          switch (record.action) {
            case 'create':
              try {
                if (!record.record) {
                  console.error('Create action missing record data');
                  failureCount++;
                  break;
                }
                // Clean the data before sending to Firestore
                const cleanedData = this.cleanDataForFirestore({
                  ...record.record,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  syncStatus: 'synced'
                });
                
                // Create new document in Firestore
                const docRef = await addDoc(collection(getFirestore(), "substationInspections"), cleanedData);
                console.log('Created new inspection in Firestore:', docRef.id);
                successCount++;
              } catch (error) {
                console.error('Error creating inspection in Firestore:', error);
                failureCount++;
              }
              break;

            case 'update':
              try {
                if (!record.record) {
                  console.error('Update action missing record data');
                  failureCount++;
                  break;
                }
                // Clean the data before sending to Firestore
                const cleanedUpdateData = this.cleanDataForFirestore({
                  ...record.record,
                  updatedAt: serverTimestamp(),
                  syncStatus: 'synced'
                });
                
                // Update existing document in Firestore
                const docRef = doc(getFirestore(), "substationInspections", record.record.id);
                await updateDoc(docRef, cleanedUpdateData);
                console.log('Updated inspection in Firestore:', record.record.id);
                successCount++;
              } catch (error) {
                console.error('Error updating inspection in Firestore:', error);
                failureCount++;
              }
              break;

            case 'delete':
              try {
                // For delete action, we need the record ID
                const recordId = record.record?.id || record.id;
                if (!recordId) {
                  console.error('Delete action missing record ID');
                  failureCount++;
                  break;
                }

                console.log('Attempting to delete record with ID:', recordId);

                // Always attempt to delete from Firestore when online
                if (this.isOnline) {
                  const docRef = doc(getFirestore(), "substationInspections", recordId);
                  const docSnap = await getDoc(docRef);
                  
                  if (docSnap.exists()) {
                    await deleteDoc(docRef);
                    console.log('Deleted inspection from Firestore:', recordId);
                  } else {
                    console.log('Document does not exist in Firestore, skipping delete:', recordId);
                  }
                }

                // Remove from IndexedDB regardless of Firestore status
                await this.removePendingSubstationInspection(record.id);
                successCount++;
              } catch (error) {
                console.error('Error deleting inspection from Firestore:', error);
                failureCount++;
              }
              break;

            default:
              console.error('Unknown action:', record.action);
              failureCount++;
          }

          // Only remove non-delete records from pending sync here
          // Delete records are handled in the delete case
          if (record.action !== 'delete') {
            await this.removePendingSubstationInspection(record.id);
          }
          
          // Dispatch event for UI update
          window.dispatchEvent(new CustomEvent('substationInspectionRecordAdded', {
            detail: {
              record: record.record ? { ...record.record, syncStatus: 'synced' } : { id: record.id, syncStatus: 'synced' },
              action: record.action,
              status: 'success'
            }
          }));

          console.log('Processed inspection:', record.record || { id: record.id });
        } catch (error) {
          console.error('Error processing pending record:', error);
          failureCount++;
          
          // Update retry count and timestamp
          await this.updatePendingSyncItem(record.id, {
            ...record,
            retryCount: (record.retryCount || 0) + 1,
            lastRetry: new Date().toISOString()
          });
        }
      }

      console.log('Sync completed:', { successCount, failureCount });
      return { successCount, failureCount };
    } catch (error) {
      console.error('Error in syncSubstationInspectionRecords:', error);
      return { successCount: 0, failureCount: pendingRecords.length };
    }
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
    await this.ensureDBInitialized();

    try {
      const records = await this.db!.getAll('substationInspections');
      console.log('SubstationInspectionService: Retrieved pending records:', records.length, records);
      
      // Map records to SubstationInspection with defensive checks
      return records.map(pendingRecord => {
        console.log('Processing pending record:', pendingRecord);
        
        if (!pendingRecord) {
          console.error('Null or undefined pending record');
          return null;
        }

        const now = new Date().toISOString();
        let record: SubstationInspection;

        // Handle both old and new data structures
        if ('record' in pendingRecord) {
          // New structure with record property
          record = pendingRecord.record;
        } else {
          // Old structure where the record is the pendingRecord itself
          record = pendingRecord as unknown as SubstationInspection;
        }

        // Ensure all required fields are present
        const inspection: SubstationInspection = {
          id: record.id || pendingRecord.id,
          region: record.region || '',
          regionId: record.regionId || '',
          district: record.district || '',
          districtId: record.districtId || '',
          date: record.date || now,
          substationNo: record.substationNo || '',
          substationName: record.substationName || '',
          type: record.type || '',
          location: record.location || '',
          voltageLevel: record.voltageLevel || '',
          status: record.status || '',
          remarks: record.remarks || '',
          syncStatus: 'pending',
          createdAt: record.createdAt || now,
          updatedAt: record.updatedAt || now,
          // Add any other required fields with default values
          ...record
        };

        console.log('Processed inspection:', inspection);
        return inspection;
      }).filter((inspection): inspection is SubstationInspection => inspection !== null);
    } catch (error) {
      console.error('Error getting offline inspections:', error);
      return [];
    }
  }

  public async getAllSubstationInspections(): Promise<SubstationInspection[]> {
    try {
      // Always get offline data first
      const offlineRecords = await this.getOfflineSubstationInspections();
      console.log('Retrieved offline records:', offlineRecords.length);
      
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
          console.log('Retrieved Firestore records:', firestoreRecords.length);

          // Create a map of all records by ID
          const recordMap = new Map<string, SubstationInspection>();
          
          // Add Firestore records to map first (they take precedence)
          firestoreRecords.forEach(record => {
            if (record.id) {
              recordMap.set(record.id, record);
            }
          });

          // Add offline records that aren't in Firestore or have a different syncStatus
          offlineRecords.forEach(record => {
            if (!record.id) {
              console.warn('Offline record missing ID:', record);
              return;
            }

            const existingRecord = recordMap.get(record.id);
            if (!existingRecord || existingRecord.syncStatus !== 'synced') {
              recordMap.set(record.id, record);
            }
          });

          // Convert map to array and sort by updatedAt
          const allRecords = Array.from(recordMap.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          
          console.log('Final merged records:', allRecords.length);
          return allRecords;
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
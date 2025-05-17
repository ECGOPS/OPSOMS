import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SubstationInspection } from '@/lib/asset-types';
import { getAuth } from 'firebase/auth';
import { toast } from '@/components/ui/sonner';
import { getFirestore } from 'firebase/firestore';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';

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
  timestamp: number;
  retryCount: number;
}

export class SubstationInspectionService {
  private static instance: SubstationInspectionService;
  private db: IDBPDatabase<SubstationInspectionDB> | null = null;
  private isOnline: boolean = true;

  private constructor() {
    this.init();
    this.setupOnlineStatusListener();
  }

  public static getInstance(): SubstationInspectionService {
    if (!SubstationInspectionService.instance) {
      SubstationInspectionService.instance = new SubstationInspectionService();
    }
    return SubstationInspectionService.instance;
  }

  private async init() {
    try {
      this.db = await openDB<SubstationInspectionDB>('substation-inspection-offline', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('substationInspections')) {
            db.createObjectStore('substationInspections', { keyPath: 'id' });
          }
        },
      });
    } catch (error) {
      console.error('Error initializing SubstationInspectionService:', error);
    }
  }

  private setupOnlineStatusListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncSubstationInspectionRecords();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  public isInternetAvailable(): boolean {
    return this.isOnline;
  }

  public async saveSubstationInspectionOffline(record: SubstationInspection, action: 'create' | 'update' | 'delete'): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const pendingRecord: PendingSubstationInspection = {
      id: record.id,
      record,
      action,
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.put('substationInspections', pendingRecord);

    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('substationInspectionRecordAdded', {
      detail: {
        record: pendingRecord.record,
        action,
        status: 'success'
      }
    }));
  }

  public async getPendingSubstationInspectionRecords(): Promise<PendingSubstationInspection[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db.getAll('substationInspections');
  }

  public async removePendingSubstationInspection(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.delete('substationInspections', id);
  }

  public async syncSubstationInspectionRecords(): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    const pendingRecords = await this.getPendingSubstationInspectionRecords();
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    const db = getFirestore();

    for (const pending of pendingRecords) {
      try {
        switch (pending.action) {
          case 'create':
            await addDoc(collection(db, 'substationInspections'), {
              ...pending.record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            break;

          case 'update':
            if (!pending.record.id) {
              throw new Error('Record ID is required for update');
            }
            await updateDoc(doc(db, 'substationInspections', pending.record.id), {
              ...pending.record,
              updatedAt: serverTimestamp()
            });
            break;

          case 'delete':
            if (!pending.record.id) {
              throw new Error('Record ID is required for delete');
            }
            await deleteDoc(doc(db, 'substationInspections', pending.record.id));
            break;
        }

        await this.removePendingSubstationInspection(pending.id);
      } catch (error) {
        console.error('Error syncing substation inspection record:', error);
        
        // Increment retry count and update in IndexedDB
        pending.retryCount++;
        if (pending.retryCount < 3) {
          await this.db?.put('substationInspections', pending);
        } else {
          // Remove after 3 failed attempts
          await this.removePendingSubstationInspection(pending.id);
        }
      }
    }
  }
} 
import { openDB, DBSchema, IDBPDatabase } from 'idb';

type StoreName = 'op5-faults' | 'control-outages' | 'vit-assets' | 'vit-inspections' | 'substation-inspections' | 'load-monitoring' | 'pending-sync';

interface ECGOMSDB extends DBSchema {
  'op5-faults': {
    key: string;
    value: any;
    indexes: { 'by-date': string };
  };
  'control-outages': {
    key: string;
    value: any;
    indexes: { 'by-date': string };
  };
  'vit-assets': {
    key: string;
    value: any;
    indexes: { 'by-region': string };
  };
  'vit-inspections': {
    key: string;
    value: any;
    indexes: { 'by-asset': string };
  };
  'substation-inspections': {
    key: string;
    value: any;
    indexes: { 'by-date': string };
  };
  'load-monitoring': {
    key: string;
    value: any;
    indexes: { 'by-date': string };
  };
  'pending-sync': {
    key: string;
    value: {
      id: string;
      type: string;
      action: 'create' | 'update' | 'delete';
      data: any;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

let db: IDBPDatabase<ECGOMSDB> | null = null;

export async function initDB() {
  if (!db) {
    db = await openDB<ECGOMSDB>('ecg-oms-db', 1, {
      upgrade(db) {
        // OP5 Faults
        if (!db.objectStoreNames.contains('op5-faults')) {
          const op5Store = db.createObjectStore('op5-faults', { keyPath: 'id' });
          op5Store.createIndex('by-date', 'occurrenceDate');
        }

        // Control Outages
        if (!db.objectStoreNames.contains('control-outages')) {
          const controlStore = db.createObjectStore('control-outages', { keyPath: 'id' });
          controlStore.createIndex('by-date', 'occurrenceDate');
        }

        // VIT Assets
        if (!db.objectStoreNames.contains('vit-assets')) {
          const vitStore = db.createObjectStore('vit-assets', { keyPath: 'id' });
          vitStore.createIndex('by-region', 'regionId');
        }

        // VIT Inspections
        if (!db.objectStoreNames.contains('vit-inspections')) {
          const vitInspectionStore = db.createObjectStore('vit-inspections', { keyPath: 'id' });
          vitInspectionStore.createIndex('by-asset', 'assetId');
        }

        // Substation Inspections
        if (!db.objectStoreNames.contains('substation-inspections')) {
          const substationStore = db.createObjectStore('substation-inspections', { keyPath: 'id' });
          substationStore.createIndex('by-date', 'inspectionDate');
        }

        // Load Monitoring
        if (!db.objectStoreNames.contains('load-monitoring')) {
          const loadStore = db.createObjectStore('load-monitoring', { keyPath: 'id' });
          loadStore.createIndex('by-date', 'timestamp');
        }

        // Pending Sync
        if (!db.objectStoreNames.contains('pending-sync')) {
          const pendingSyncStore = db.createObjectStore('pending-sync', { keyPath: 'id' });
          pendingSyncStore.createIndex('by-timestamp', 'timestamp');
        }
      }
    });
  }
  return db;
}

export async function addToPendingSync(storeName: StoreName, action: 'create' | 'update' | 'delete', data: any) {
  const db = await initDB();
  const pendingSyncItem = {
    id: crypto.randomUUID(),
    type: storeName,
    action,
    data,
    timestamp: Date.now()
  };
  await db.add('pending-sync', pendingSyncItem);
}

export async function getPendingSyncItems() {
  const db = await initDB();
  return db.getAll('pending-sync');
}

export async function clearPendingSyncItem(timestamp: number) {
  const db = await initDB();
  await db.delete('pending-sync', timestamp);
}

// Generic CRUD operations for each store
export async function addItem(storeName: StoreName, item: any) {
  const db = await initDB();
  await db.add(storeName, item);
  await addToPendingSync(storeName, 'create', item);
}

export async function updateItem(storeName: StoreName, item: any) {
  const db = await initDB();
  await db.put(storeName, item);
  await addToPendingSync(storeName, 'update', item);
}

export async function deleteItem(storeName: StoreName, id: string | number) {
  const db = await initDB();
  await db.delete(storeName, id.toString());
  await addToPendingSync(storeName, 'delete', { id: id.toString() });
}

export async function getAllItems(storeName: StoreName) {
  const db = await initDB();
  return db.getAll(storeName);
}

export async function getItem(storeName: StoreName, id: string | number) {
  const db = await initDB();
  return db.get(storeName, id.toString());
} 
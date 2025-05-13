import { openDB, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// Define store names as a type
export type StoreName =
  | 'op5-faults'
  | 'op5-faults-cache'
  | 'control-outages'
  | 'control-outages-cache'
  | 'vit-assets'
  | 'vit-assets-cache'
  | 'vit-inspections'
  | 'vit-inspections-cache'
  | 'substation-inspections'
  | 'load-monitoring'
  | 'load-monitoring-cache'
  | 'overhead-line-inspections'
  | 'overhead-line-inspections-cache'
  | 'pending-sync'
  | 'districts'
  | 'districts-cache';

let db: IDBPDatabase | null = null;
let isInitializing = false;
let initPromise: Promise<IDBPDatabase> | null = null;

export async function initDB() {
  if (initPromise) {
    return initPromise;
  }

  if (!db) {
    try {
      console.log('Starting database initialization...');
      
      // Create new database
      db = await openDB('ecg-oms-db', 1, {
        upgrade(db) {
          console.log('Upgrading database...');
          
          // Create all stores if they don't exist
          const stores: StoreName[] = [
            'op5-faults',
            'op5-faults-cache',
            'control-outages',
            'control-outages-cache',
            'vit-assets',
            'vit-assets-cache',
            'vit-inspections',
            'vit-inspections-cache',
            'substation-inspections',
            'load-monitoring',
            'load-monitoring-cache',
            'overhead-line-inspections',
            'overhead-line-inspections-cache',
            'pending-sync',
            'districts',
            'districts-cache'
          ];

          stores.forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              console.log(`Creating store: ${storeName}`);
              const store = db.createObjectStore(storeName, { keyPath: 'id' });
              
              // Add appropriate indexes based on store type
              switch (storeName) {
                case 'op5-faults':
                case 'op5-faults-cache':
                case 'control-outages':
                case 'control-outages-cache':
                  store.createIndex('by-date', 'occurrenceDate');
                  break;
                case 'vit-assets':
                case 'vit-assets-cache':
                  store.createIndex('by-region', 'regionId');
                  break;
                case 'vit-inspections':
                case 'vit-inspections-cache':
                  store.createIndex('by-asset', 'assetId');
                  store.createIndex('by-date', 'inspectionDate');
                  break;
                case 'substation-inspections':
                  store.createIndex('by-date', 'inspectionDate');
                  break;
                case 'load-monitoring':
                case 'load-monitoring-cache':
                  store.createIndex('by-date', 'timestamp');
                  break;
                case 'overhead-line-inspections':
                case 'overhead-line-inspections-cache':
                  store.createIndex('by-date', 'inspectionDate');
                  break;
                case 'pending-sync':
                  store.createIndex('by-timestamp', 'timestamp');
                  break;
                case 'districts':
                case 'districts-cache':
                  store.createIndex('by-region', 'regionId');
                  break;
              }
            }
          });
        },
      });

      console.log('Database initialized successfully');
      return db;
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
  return db;
}

async function deleteDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function addToPendingSync(storeName: StoreName, action: 'create' | 'update' | 'delete', data: any) {
  const db = await initDB();
  const pendingSyncItem = {
    id: uuidv4(),
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

export interface PendingSyncItem {
  id: string;
  type: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export async function clearPendingSyncItem(item: PendingSyncItem): Promise<void> {
  const db = await initDB();
  await db.delete('pending-sync', item.id);
}

// Generic CRUD operations for each store
export async function addItem(storeName: StoreName, item: any) {
  try {
    const db = await initDB();
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
    await db.put(storeName, item); // Using put instead of add to handle updates
    console.log(`Successfully added/updated item in ${storeName}:`, item.id);
  } catch (error) {
    console.error(`Error adding item to ${storeName}:`, error);
    throw error;
  }
}

export async function updateItem(storeName: StoreName, item: any) {
  try {
    const db = await initDB();
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
    await db.put(storeName, item);
    await addToPendingSync(storeName, 'update', item);
    console.log(`Successfully updated item in ${storeName}:`, item.id);
  } catch (error) {
    console.error(`Error updating item in ${storeName}:`, error);
    throw error;
  }
}

export async function deleteItem(storeName: StoreName, id: string | number) {
  try {
    const db = await initDB();
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
    await db.delete(storeName, id.toString());
    await addToPendingSync(storeName, 'delete', { id: id.toString() });
    console.log(`Successfully deleted item from ${storeName}:`, id);
  } catch (error) {
    console.error(`Error deleting item from ${storeName}:`, error);
    throw error;
  }
}

export async function getAllItems(storeName: StoreName) {
  try {
    const db = await initDB();
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
    const items = await db.getAll(storeName);
    console.log(`Retrieved ${items.length} items from ${storeName}`);
    return items;
  } catch (error) {
    console.error(`Error getting all items from ${storeName}:`, error);
    throw error;
  }
}

export async function getItem(storeName: StoreName, id: string | number) {
  try {
    const db = await initDB();
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
    const item = await db.get(storeName, id.toString());
    console.log(`Retrieved item from ${storeName}:`, id);
    return item;
  } catch (error) {
    console.error(`Error getting item from ${storeName}:`, error);
    throw error;
  }
} 
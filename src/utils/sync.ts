import { getPendingSyncItems, clearPendingSyncItem } from './db';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

let isOnline = navigator.onLine;
let syncInProgress = false;

// Listen for online/offline events
window.addEventListener('online', () => {
  isOnline = true;
  syncPendingChanges();
});

window.addEventListener('offline', () => {
  isOnline = false;
});

export async function syncPendingChanges() {
  if (!isOnline || syncInProgress) return;

  syncInProgress = true;
  try {
    const pendingItems = await getPendingSyncItems();
    
    for (const item of pendingItems) {
      try {
        const { type, action, data } = item;
        
        // Map store names to Firestore collection names
        const collectionMap: Record<string, string> = {
          'op5-faults': 'op5Faults',
          'control-outages': 'controlOutages',
          'load-monitoring': 'loadMonitoring',
          'vit-assets': 'vitAssets',
          'vit-inspections': 'vitInspections',
          'substation-inspections': 'substationInspections',
          'overhead-line-inspections': 'overheadLineInspections'
        };

        const collectionName = collectionMap[type];
        if (!collectionName) {
          console.error(`Unknown collection type: ${type}`);
          continue;
        }

        switch (action) {
          case 'create':
            await addDoc(collection(db, collectionName), {
              ...data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            break;
          
          case 'update':
            const docRef = doc(db, collectionName, data.id);
            await updateDoc(docRef, {
              ...data,
              updatedAt: serverTimestamp()
            });
            break;
          
          case 'delete':
            await deleteDoc(doc(db, collectionName, data.id));
            break;
        }
        
        // After successful sync, remove from pending
        await clearPendingSyncItem(item);
      } catch (error) {
        console.error(`Failed to sync ${item.type} ${item.action}:`, error);
        // Keep the item in pending sync for retry later
      }
    }
  } finally {
    syncInProgress = false;
  }
}

// Start periodic sync when online
setInterval(() => {
  if (isOnline) {
    syncPendingChanges();
  }
}, 30000); // Check every 30 seconds

export function isAppOnline() {
  return isOnline;
} 
import * as functions from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

type SecurityEventData = {
  eventType: string;
  userId: string;
  timestamp: string;
  details?: string;
  severity?: 'low' | 'medium' | 'high';
  status?: 'new' | 'in_progress' | 'resolved' | 'dismissed';
  metadata?: Record<string, any>;
};

export const logSecurityEvent = functions.https.onCall(async (request: functions.https.CallableRequest<SecurityEventData>) => {
  try {
    const data = request.data;
    
    // Validate the event data
    if (!data.eventType || !data.userId || !data.timestamp) {
      throw new Error('Missing required fields');
    }

    // Prepare the event data
    const eventData = {
      timestamp: new Date(data.timestamp),
      eventType: data.eventType,
      details: data.details,
      severity: data.severity || 'low',
      status: data.status || 'new',
      userId: data.userId,
      metadata: {
        ...(data.metadata || {}),
        recordedAt: new Date(),
        recordedBy: 'system'
      }
    };

    // Add the event to Firestore
    const docRef = await db.collection('securityEvents').add(eventData);
    
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error logging security event:', error);
    throw new functions.https.HttpsError('internal', 'Failed to log security event');
  }
}); 
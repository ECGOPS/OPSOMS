import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();

// BulkSMS API configuration
const BULKSMS_API_URL = 'https://pelrq3.api.infobip.com/sms/2/text/advanced';
const BULKSMS_API_KEY = functions.config().bulksms.api_key;

interface ResetPasswordRequest {
  userId: string;
}

interface ResetPasswordResponse {
  tempPassword: string;
}

interface BulkSMSResponse {
  id: string;
  status: string;
}

export const adminResetPassword = functions.https.onCall(async (data: ResetPasswordRequest, context) => {
  // Check if the caller is authenticated and is a system admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const adminUser = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!adminUser.exists || adminUser.data()?.role !== 'system_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only system administrators can reset passwords');
  }

  const { userId } = data;
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  // Get the user document
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }

  const userData = userDoc.data();
  const userEmail = userData?.email;

  if (!userEmail) {
    throw new functions.https.HttpsError('not-found', 'User email not found');
  }

  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(-8);

  try {
    // Update the user's password using the Admin SDK
    await admin.auth().updateUser(userId, {
      password: tempPassword
    });

    return { tempPassword };
  } catch (error) {
    console.error('Error resetting password:', error);
    throw new functions.https.HttpsError('internal', 'Failed to reset password');
  }
});

export const getIpAddress = functions.https.onCall((data: any, context: functions.https.CallableContext) => {
  // Get the IP address from the context
  const ipAddress = context.rawRequest?.ip || 'unknown';
  
  return {
    ip: ipAddress
  };
});

export const sendSMS = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { phoneNumber, message, faultId, faultType } = data;

  try {
    // Format phone number to ensure it's in the correct format (e.g., +233XXXXXXXXX)
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    // Send SMS using BulkSMS
    const response = await axios.post<BulkSMSResponse>(
      BULKSMS_API_URL,
      {
        messages: [{
          destinations: [{
            to: formattedPhoneNumber
          }],
          from: 'ECG OUTAGE MANAGMENT SYSTEM',
          text: message
        }]
      },
      {
        headers: {
          'Authorization': `App ${BULKSMS_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Log successful SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber: formattedPhoneNumber,
      message,
      faultId,
      faultType,
      status: 'sent',
      bulksmsMessageId: response.data.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, messageId: response.data.id };
  } catch (error: any) {
    // Log failed SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber,
      message,
      faultId,
      faultType,
      status: 'failed',
      error: error.response?.data?.message || error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    throw new functions.https.HttpsError(
      'internal',
      'Failed to send SMS',
      error.response?.data || error
    );
  }
});

// Test function to send SMS
export const testSMS = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { phoneNumber } = data;
  const testMessage = "This is a test message from ECG Fault Master. Your fault has been resolved.";

  try {
    // Format phone number
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    // Send test SMS
    const response = await axios.post<BulkSMSResponse>(
      BULKSMS_API_URL,
      {
        messages: [{
          destinations: [{
            to: formattedPhoneNumber
          }],
          from: 'ECG OUTAGE MANAGMENT SYSTEM',
          text: testMessage
        }]
      },
      {
        headers: {
          'Authorization': `App ${BULKSMS_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Log test SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber: formattedPhoneNumber,
      message: testMessage,
      faultId: 'TEST',
      faultType: 'TEST',
      status: 'sent',
      bulksmsMessageId: response.data.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { 
      success: true, 
      messageId: response.data.id,
      message: 'Test SMS sent successfully'
    };
  } catch (error: any) {
    console.error('Test SMS Error:', error.response?.data || error);
    
    // Log failed test SMS
    await admin.firestore().collection('sms_logs').add({
      phoneNumber,
      message: testMessage,
      faultId: 'TEST',
      faultType: 'TEST',
      status: 'failed',
      error: error.response?.data?.message || error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    throw new functions.https.HttpsError(
      'internal',
      'Failed to send test SMS',
      error.response?.data || error
    );
  }
});

// Helper function to format phone numbers
function formatPhoneNumber(phoneNumber: string): string {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If number starts with 0, replace with +233
  if (cleaned.startsWith('0')) {
    return '+233' + cleaned.substring(1);
  }
  
  // If number starts with 233, add +
  if (cleaned.startsWith('233')) {
    return '+' + cleaned;
  }
  
  // If number doesn't have country code, add +233
  if (cleaned.length === 10) {
    return '+233' + cleaned;
  }
  
  // Return as is if already in international format
  return '+' + cleaned;
} 
import { db } from "@/config/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

export class SMSService {
  private static instance: SMSService;
  private smsLogsCollection = collection(db, "sms_logs");
  private functions = getFunctions();
  private sendSMSFunction = httpsCallable(this.functions, 'sendSMS');

  private constructor() {}

  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  public async sendFaultResolutionNotification(
    phoneNumber: string,
    faultId: string,
    faultType: string,
    location: string
  ): Promise<void> {
    try {
      const message = `Your reported fault (ID: ${faultId}) at ${location} has been resolved. Thank you for your patience.`;
      
      // Call the Cloud Function to send SMS
      const result = await this.sendSMSFunction({
        phoneNumber,
        message,
        faultId,
        faultType
      });

      // Log the successful SMS attempt
      await addDoc(this.smsLogsCollection, {
        phoneNumber,
        message,
        faultId,
        faultType,
        status: 'sent',
        twilioMessageId: result.data.messageId,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      
      // Log the failed attempt
      await addDoc(this.smsLogsCollection, {
        phoneNumber,
        faultId,
        faultType,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: serverTimestamp()
      });
      
      throw error;
    }
  }
} 
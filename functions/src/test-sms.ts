import axios from 'axios';

const BULKSMS_API_URL = 'https://pelrq3.api.infobip.com/sms/2/text/advanced';
const BULKSMS_API_KEY = '419263b1555f8d65a247896669771ec2-5f8ff6e0-c19d-4ea8-9c98-295d9ce0a784';

async function testSMS() {
  const phoneNumber = '0245003731';
  const testMessage = "This is a production test message from ECG OUTAGE MANAGMENT SYSTEM. The system is now operational.";

  try {
    // Format phone number
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    console.log('Sending SMS to:', formattedPhoneNumber);

    // Send test SMS
    const response = await axios.post(
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

    console.log('SMS sent successfully:', response.data);
  } catch (error: any) {
    console.error('Error sending SMS:', error.response?.data || error.message);
  }
}

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

// Run the test
testSMS(); 
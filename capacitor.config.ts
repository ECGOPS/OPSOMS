import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ecg.faultmaster',
  appName: 'ECG Fault Master',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    url: 'https://faultmaster.ecg.com',
    cleartext: true
  },
};

export default config;

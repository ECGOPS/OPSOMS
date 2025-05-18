import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { register as registerServiceWorker } from './serviceWorkerRegistration'
import { db } from './config/firebase'
import { ThemeProvider } from 'next-themes'

// Initialize Firebase
console.log('Firebase initialized:', db)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

// Register service worker for PWA support
registerServiceWorker({
  onSuccess: (registration) => {
    console.log('PWA registration successful', registration)
  },
  onUpdate: (registration) => {
    console.log('New content is available; please refresh.', registration)
  },
})

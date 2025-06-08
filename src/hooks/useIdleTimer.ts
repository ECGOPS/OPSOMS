import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const WARNING_TIME = 60 * 1000; // Show warning 1 minute before logout

export const useIdleTimer = () => {
  const { logout, isAuthenticated } = useAuth();
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    // Clear existing timers
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    // Only set timers if user is authenticated
    if (isAuthenticated) {
      // Set warning timer
      warningTimerRef.current = setTimeout(() => {
        toast.warning("You will be logged out in 1 minute due to inactivity", {
          duration: 10000, // Show for 10 seconds
        });
      }, IDLE_TIMEOUT - WARNING_TIME);

      // Set logout timer
      idleTimerRef.current = setTimeout(() => {
        logout();
        toast.info("You have been logged out due to inactivity");
      }, IDLE_TIMEOUT);
    }
  };

  useEffect(() => {
    // Only set up event listeners if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    // Events to track user activity
    const events = [
      'mousemove',
      'keydown',
      'mousedown',
      'touchstart',
      'scroll',
      'wheel'
    ];

    // Event handler
    const handleUserActivity = () => {
      resetTimer();
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Initial timer setup
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, [logout, isAuthenticated]);
}; 
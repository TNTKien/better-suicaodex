"use client";

import { useEffect } from 'react';
import { Workbox } from 'workbox-window';

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      const wb = new Workbox('/sw.js');

      wb.addEventListener('installed', (event) => {
        console.log('Service Worker installed:', event);
      });

      wb.addEventListener('controlling', (event) => {
        console.log('Service Worker is controlling:', event);
        window.location.reload();
      });

      wb.addEventListener('waiting', (event) => {
        console.log('Service Worker is waiting:', event);
        // Optionally show a toast to user about update available
        // and provide option to skip waiting
      });

      wb.addEventListener('externalinstalled', (event) => {
        console.log('External Service Worker installed:', event);
      });

      wb.addEventListener('externalactivated', (event) => {
        console.log('External Service Worker activated:', event);
      });

      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type) {
          switch (event.data.type) {
            case 'BACKGROUND_SYNC_START':
              console.log('Background sync started');
              break;
            case 'BACKGROUND_SYNC_RESUME_DOWNLOADS':
              // Trigger download manager to resume downloads
              window.dispatchEvent(new CustomEvent('resume-downloads'));
              break;
          }
        }
      });

      wb.register();
    }
  }, []);

  return <>{children}</>;
}

// Hook to check if app is running as PWA
export function useIsPWA() {
  useEffect(() => {
    const checkPWA = () => {
      const isPWA = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://');
      
      if (isPWA) {
        document.documentElement.classList.add('pwa');
      }
    };

    checkPWA();
  }, []);
}
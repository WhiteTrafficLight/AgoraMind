'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { LoadingOverlayProvider } from './loadingOverlay';
 
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LoadingOverlayProvider>
        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '8px',
            },
          }}
        />
      </LoadingOverlayProvider>
    </SessionProvider>
  );
} 
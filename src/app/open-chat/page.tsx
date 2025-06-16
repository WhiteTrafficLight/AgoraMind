'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect page for Open Chat
 * Automatically redirects users to the new V2 implementation
 * Original implementation backed up as page.tsx.backup
 */
export default function OpenChatRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Preserve any query parameters when redirecting
    const currentParams = new URLSearchParams(window.location.search);
    const redirectUrl = `/open-chat/v2${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
    
    router.replace(redirectUrl);
  }, [router]);
  
      return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="spinner-large mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to improved chat interface...</p>
        </div>
      </div>
    );
}



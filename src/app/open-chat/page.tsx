'use client';

import React from 'react';
import { Toaster } from 'react-hot-toast';
import OpenChatContainer from './components/OpenChatContainer';

/**
 * Main Open Chat page
 * Previously redirected to v2, now contains the main functionality
 */
export default function OpenChatPage() {
  return (
    <>
      {/* Main container */}
      <OpenChatContainer />
      
      {/* Toast notification */}
      <Toaster position="top-right" />
    </>
  );
}



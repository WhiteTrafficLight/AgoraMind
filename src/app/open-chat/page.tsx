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
      {/* 메인 컨테이너 */}
      <OpenChatContainer />
      
      {/* Toast 알림 */}
      <Toaster position="top-right" />
    </>
  );
}



'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close on outside click
    const handleOutsideClick = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node) && isOpen) {
        onClose();
      }
    };

    // Close on ESC key press
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const navigateTo = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <>
      {/* Backdrop - always rendered, but controlled by opacity and pointer-events */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-30 z-50 transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`fixed left-0 bottom-0 w-80 bg-white dark:bg-gray-850 shadow-lg transition-transform duration-300 ease-in-out z-[51] ${
          isOpen ? 'translate-x-0' : '-translate-x-[120%]'
        }`}
        style={{
          backgroundColor: 'white',
          boxShadow: '10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)',
          borderRight: '1px solid rgba(0,0,0,0.1)',
          top: '64px'
        }}
      >
        <div className="flex flex-col p-5" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
          <Link 
            href="/" 
            className="flex items-center px-3 py-3 hover:bg-gray-100 transition-colors no-underline rounded-lg"
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '14px 8px',
              borderRadius: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" style={{color: "black", marginRight: '10px'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span className="text-sm font-medium text-black" style={{color: "black", fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'}}>Home</span>
          </Link>

          <Link 
            href="/open-chat" 
            className="flex items-center px-3 py-3 hover:bg-gray-100 transition-colors no-underline rounded-lg"
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '14px 8px',
              borderRadius: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" style={{color: "black", marginRight: '10px'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-sm font-medium text-black" style={{color: "black", fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'}}>OpenChat</span>
          </Link>

          <Link 
            href="/essays" 
            className="flex items-center px-3 py-3 hover:bg-gray-100 transition-colors no-underline rounded-lg"
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '14px 8px',
              borderRadius: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16" style={{color: "black", marginRight: '10px'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <line x1="10" y1="9" x2="8" y2="9"></line>
            </svg>
            <span className="text-sm font-medium text-black" style={{color: "black", fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'}}>Essays</span>
          </Link>
        </div>
      </div>
    </>
  );
};

export default NavigationDrawer; 
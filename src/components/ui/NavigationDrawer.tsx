'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HomeIcon, ChatBubbleLeftIcon, SpeakerWaveIcon, UserIcon } from '@heroicons/react/24/outline';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleBody?: (pushed: boolean) => void;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ isOpen, onClose, onToggleBody }) => {
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Toggle body pushed class for subtle push effect
    onToggleBody?.(isOpen);

    const handleOutsideClick = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node) && isOpen) {
        onClose();
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscKey);

    return () => {
      onToggleBody?.(false);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-50 border-r border-gray-200 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 flex flex-col gap-2">
          <Link 
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-800"
          >
            <HomeIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium">Home</span>
          </Link>
          
          <Link 
            href="/open-chat"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-800"
          >
            <ChatBubbleLeftIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium">Open Chat</span>
          </Link>
          
          <Link 
            href="/podcast"
            prefetch={false}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-800"
          >
            <SpeakerWaveIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium">Podcast</span>
          </Link>
        </div>
      </div>
    </>
  );
};

export default NavigationDrawer; 
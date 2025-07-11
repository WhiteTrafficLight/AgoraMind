'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HomeIcon, ChatBubbleLeftIcon, SpeakerWaveIcon, UserIcon } from '@heroicons/react/24/outline';

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
      {/* Backdrop */}
      <div
        className={`drawer-backdrop ${isOpen ? 'open' : 'closed'}`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`navigation-drawer ${isOpen ? 'open' : 'closed'}`}
      >
        <div className="navigation-drawer-content">
          <Link 
            href="/" 
            onClick={onClose}
            className="navigation-drawer-link"
          >
            <HomeIcon className="navigation-drawer-icon" />
            <span>Home</span>
          </Link>
          
          <Link 
            href="/open-chat" 
            onClick={onClose}
            className="navigation-drawer-link"
          >
            <ChatBubbleLeftIcon className="navigation-drawer-icon" />
            <span>Open Chat</span>
          </Link>
          
          <Link 
            href="/settings/custom-npc" 
            prefetch={false}
            onClick={onClose}
            className="navigation-drawer-link"
          >
            <UserIcon className="navigation-drawer-icon" />
            <span>Custom Philosophers</span>
          </Link>
          
          <Link 
            href="/podcast" 
            prefetch={false}
            onClick={onClose}
            className="navigation-drawer-link"
          >
            <SpeakerWaveIcon className="navigation-drawer-icon" />
            <span>Podcast</span>
          </Link>
        </div>
      </div>
    </>
  );
};

export default NavigationDrawer; 
'use client';

import React, { useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileDrawer({ isOpen, onClose }: ProfileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // ESC 키 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    // 백드롭
    <div
      className={`drawer-backdrop ${isOpen ? 'open' : 'closed'}`}
      onClick={onClose}
    >
      <div
        ref={drawerRef}
        onClick={e => e.stopPropagation()}
        className={`profile-drawer ${isOpen ? 'open' : 'closed'}`}
      >
        <div className="profile-drawer-content">
          <Link 
            href="/settings/custom-npc" 
            onClick={onClose}
            className="profile-drawer-link"
          >
            <span>Custom Philosophers</span>
          </Link>
          
          <Link 
            href="/settings#account" 
            onClick={onClose}
            className="profile-drawer-link"
          >
            <span>Account Settings</span>
          </Link>
          
          <div className="profile-drawer-divider"></div>
          
          <Link 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              signOut({ callbackUrl: '/' });
              onClose();
            }}
            className="profile-drawer-logout"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              className="profile-drawer-logout-icon"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log out</span>
          </Link>
        </div>
      </div>
    </div>
  );
} 
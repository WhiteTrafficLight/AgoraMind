'use client';

import React, { useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  anchor?: { top: number; right: number };
}

export default function ProfileDrawer({ isOpen, onClose, anchor }: ProfileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <div
      className={`${isOpen ? 'fixed inset-0 z-[10000]' : 'hidden'}`}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />
      {/* Drawer */}
      <div
        ref={drawerRef}
        onClick={e => e.stopPropagation()}
        className={`fixed z-[10001] max-h-[90vh] w-[22rem] bg-white shadow-2xl border border-gray-200 rounded-xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ top: anchor?.top ?? 24, right: anchor?.right ?? 24 }}
      >
        <div className="p-4 flex flex-col gap-2 overflow-y-auto max-h-[85vh]">
          <Link 
            href="/settings/custom-npc" 
            prefetch={false}
            onClick={(e) => { e.preventDefault(); }}
            aria-disabled="true"
            title="coming soon"
            tabIndex={-1}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-gray-400 bg-gray-50 cursor-not-allowed"
          >
            <span className="text-sm font-medium">Custom Philosophers</span>
          </Link>
          
          <Link 
            href="/settings#account" 
            prefetch={false}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-800"
          >
            <span className="text-sm font-medium">Account Settings</span>
          </Link>
          
          <div className="my-2 border-t border-gray-200" />
          
          <Link 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              signOut({ callbackUrl: '/' });
              onClose();
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-md bg-red-50 text-red-700 hover:bg-red-100"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm font-medium">Log out</span>
          </Link>
        </div>
      </div>
    </div>
  );
} 
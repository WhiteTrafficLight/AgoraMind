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
    // 백드롭은 항상 렌더링하되, isOpen에 따라 보이게
    <div
      className={`fixed inset-0 bg-black bg-opacity-30 z-50 transition-opacity ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        ref={drawerRef}
        onClick={e => e.stopPropagation()}
        className={`
          fixed right-[50px] w-[220px] bg-white
          transform transition-transform duration-300 ease-in-out z-[101]
          ${isOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
          overflow-hidden rounded-2xl
          shadow-[-10px_0_20px_-5px_rgba(0,0,0,0.3),_0_0_20px_rgba(0,0,0,0.2)]
        `}
        style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)',
          top: '64px'
        }}
      >
        <div className="flex flex-col" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link 
            href="/settings/custom-npc" 
            onClick={() => onClose()}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-black" style={{color: "black", fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'}}>Custom NPC</span>
          </Link>

          <Link 
            href="/chat-history" 
            onClick={() => onClose()}
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
            <span className="text-sm font-medium text-black" style={{color: "black", fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'}}>Chat History</span>
          </Link>
          
          <div className="border-t" style={{ borderTop: '1px solid #e5e7eb', margin: '8px 6px' }}></div>
          
          <Link 
            href="/settings#account" 
            onClick={() => onClose()}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium text-black" style={{color: "black", fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'}}>Settings</span>
          </Link>

          <div className="border-t" style={{ borderTop: '1px solid #e5e7eb', margin: '8px 6px' }}></div>
          
          <Link 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              signOut({ callbackUrl: '/' });
              onClose();
            }}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm font-medium text-black" style={{color: "black", fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'}}>Log out</span>
          </Link>
        </div>
      </div>
    </div>
  );
} 
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ProfileDrawer from './ProfileDrawer';
import NavigationDrawer from './NavigationDrawer';

const Header = () => {
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  // 로그인 페이지나 회원가입 페이지에서는 헤더를 표시하지 않음
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b-2 border-gray-200 bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <div className="flex items-center w-20">
            <button 
              className="border-0 bg-transparent p-0"
              onClick={() => setIsNavDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 flex justify-center">
            <Link href="/" className="text-center">
              <span 
                className="text-2xl font-extrabold text-black" 
                style={{ 
                  fontWeight: 900, 
                  color: '#000000',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                }}
              >
                AgoraMind
              </span>
            </Link>
          </div>

          <div className="w-20 flex justify-end">
            {session ? (
              <button
                className="border-0 bg-transparent p-0"
                onClick={() => setIsProfileDrawerOpen(true)}
                aria-label="Open profile menu"
              >
                <Image
                  src="/Profile.png"
                  alt="Profile"
                  width={36}
                  height={36}
                  priority
                  className="rounded-full"
                />
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <ProfileDrawer isOpen={isProfileDrawerOpen} onClose={() => setIsProfileDrawerOpen(false)} />
      
      <NavigationDrawer 
        isOpen={isNavDrawerOpen} 
        onClose={() => setIsNavDrawerOpen(false)} 
      />
    </>
  );
};

export default Header; 
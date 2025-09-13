'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ProfileDrawer from './ProfileDrawer';
import NavigationDrawer from './NavigationDrawer';

interface UserProfile {
  profileImage?: string | null;
}

const Header = () => {
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const { data: session, status } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Fetch user profile when session is available
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (session) {
        try {
          const response = await fetch('/api/user/profile');
          if (response.ok) {
            const data = await response.json();
            setUserProfile(data);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };
    
    fetchUserProfile();
  }, [session]);

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
        <div className="relative w-full px-4 h-24 flex items-center justify-center">
          {/* Left: Hamburger flush to edge */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2">
            <button 
              className="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              onClick={() => setIsNavDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                className="h-7 w-7 text-gray-900"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Center: Logo */}
          <Link href="/" className="text-center">
            <Image
              src="/Logo.png"
              alt="AgoraMind"
              width={224}
              height={224}
              priority
              className="h-12 w-auto md:h-14"
            />
          </Link>

          {/* Right: Login/Profile flush to edge */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {session ? (
              <button
                className="relative p-0 cursor-pointer"
                onClick={() => setIsProfileDrawerOpen(true)}
                aria-label="Open profile menu"
              >
                <div className="w-[52px] h-[52px] rounded-full overflow-hidden border-2 border-black box-border flex items-center justify-center">
                  {userProfile?.profileImage ? (
                    <img 
                      src={userProfile.profileImage}
                      alt="Profile"
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <Image
                      src="/Profile.png"
                      alt="Profile"
                      width={48}
                      height={48}
                      priority
                      className="rounded-full object-cover"
                    />
                  )}
                </div>
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center px-6 py-3 bg-black text-white hover:text-white focus:text-white visited:text-white active:text-white rounded-full hover:bg-gray-900 transition-colors text-lg cursor-pointer"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        anchor={{ top: 72, right: 16 }}
      />
      
      <NavigationDrawer 
        isOpen={isNavDrawerOpen} 
        onClose={() => setIsNavDrawerOpen(false)} 
        onToggleBody={(pushed: boolean) => {
          if (typeof document !== 'undefined') {
            document.body.classList.toggle('app-pushed', pushed);
          }
        }}
      />
    </>
  );
};

export default Header; 
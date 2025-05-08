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
        <div className="container mx-auto px-4 h-24 flex items-center">
          <div className="flex items-center w-32">
            <button 
              className="border-0 bg-transparent p-0"
              onClick={() => setIsNavDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="40" height="40">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 flex justify-center">
            <Link href="/" className="text-center">
              <span 
                style={{ 
                  fontSize: '3rem',
                  fontWeight: 900, 
                  color: '#000000',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                }}
              >
                AgoraMind
              </span>
            </Link>
          </div>

          <div className="w-32 flex justify-end">
            {session ? (
              <button
                className="border-0 bg-transparent p-0"
                onClick={() => setIsProfileDrawerOpen(true)}
                aria-label="Open profile menu"
                style={{ 
                  width: '52px',
                  height: '52px',
                  position: 'relative',
                  padding: 0,
                  overflow: 'visible'
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '2px solid black',
                    boxSizing: 'border-box',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  {userProfile?.profileImage ? (
                    <img 
                      src={userProfile.profileImage}
                      alt="Profile"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center'
                      }}
                    />
                  ) : (
                    <Image
                      src="/Profile.png"
                      alt="Profile"
                      width={48}
                      height={48}
                      priority
                      className="rounded-full"
                      style={{ objectFit: 'cover' }}
                    />
                  )}
                </div>
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors text-lg"
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
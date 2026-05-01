'use client';

import { useEffect, useState } from 'react';
import { loggers } from '@/utils/logger';

const STORAGE_KEY = 'chat_username';

const randomFallback = () => `User_${Math.floor(Math.random() * 10000)}`;

const persist = (name: string) => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, name);
  }
};

const readStored = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
};

export function useChatUsername(): string {
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (!cancelled && response.ok) {
          const userData = await response.json();
          const name = userData.username || userData.name || randomFallback();
          setUsername(name);
          persist(name);
          loggers.auth.info('V2 user info loaded', { username: name });
          return;
        }
        if (!cancelled) {
          const fallback = readStored() ?? randomFallback();
          setUsername(fallback);
          persist(fallback);
        }
      } catch (error) {
        if (cancelled) return;
        loggers.auth.error('Failed to load V2 user info', error);
        const fallback = randomFallback();
        setUsername(fallback);
        persist(fallback);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return username;
}

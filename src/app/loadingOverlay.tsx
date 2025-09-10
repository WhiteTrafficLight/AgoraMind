'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type OverlayState = {
  visible: boolean;
  message: string;
  subtext?: string;
};

type OverlayContextType = {
  state: OverlayState;
  show: (message: string, subtext?: string) => void;
  update: (message?: string, subtext?: string) => void;
  hide: () => void;
};

const OverlayContext = createContext<OverlayContextType | null>(null);

export function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OverlayState>({ visible: false, message: '' });

  const show = useCallback((message: string, subtext?: string) => {
    setState({ visible: true, message, subtext });
  }, []);

  const update = useCallback((message?: string, subtext?: string) => {
    setState(prev => ({
      visible: true,
      message: message ?? prev.message,
      subtext: subtext ?? prev.subtext,
    }));
  }, []);

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  const value = useMemo(() => ({ state, show, update, hide }), [state, show, update, hide]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
      <LoadingOverlay />
    </OverlayContext.Provider>
  );
}

export function useLoadingOverlay(): OverlayContextType {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useLoadingOverlay must be used within LoadingOverlayProvider');
  return ctx;
}

function LoadingOverlay() {
  const { state } = useLoadingOverlay();
  if (!state.visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-gray-200">
        <div className="flex items-center gap-3">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-gray-900">{state.message}</p>
        </div>
        {state.subtext && (
          <p className="mt-2 text-xs text-gray-600">{state.subtext}</p>
        )}
        <div className="mt-4 h-1 w-full overflow-hidden rounded bg-gray-100">
          <div className="h-full w-1/2 animate-[loading_1.2s_ease-in-out_infinite] rounded bg-blue-600" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}



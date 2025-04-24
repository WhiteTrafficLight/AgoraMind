'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer 
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  // Handle escape key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // Don't render on the server
  if (!mounted || !isOpen) return null;
  
  // Create portal for modal
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center pointer-events-auto"
      onClick={onClose}
    >
      {/* Modal container styled like philosopher details modal */}
      <div
        className="fixed bg-white rounded-2xl w-full max-h-[80vh] overflow-y-auto z-[101]"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)',
          width: '90%',
          maxWidth: '1000px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 absolute top-3 right-3 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              border: 'none',
              transition: 'all 0.2s',
              width: '28px',
              height: '28px',
              borderRadius: '50%'
            }}
          >
            ✕
          </button>
        </div>
        {/* Title */}
        <div className="flex items-center mb-4">
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div className="mt-5 flex justify-end">
            {footer}
          </div>
        )}
      </div>
      <style jsx global>{`
        body.modal-open {
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
        }
        
        .modal-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          isolation: isolate;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translate(-50%, -48%) scale(0.92);
          }
          to { 
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        .modal-backdrop {
          animation: fadeIn 0.3s ease-out;
        }
        
        .modal-container {
          animation: slideIn 0.4s ease-out;
        }
      `}</style>
    </div>,
    document.body
  );
};

export default Modal; 
 
'use client';

import React from 'react';
import type { Citation } from '@/lib/ai/chatTypes';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation: Citation | null;
}

const CitationModal: React.FC<CitationModalProps> = ({ isOpen, onClose, citation }) => {
  if (!isOpen || !citation) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 50,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>Source Reference</h3>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: '#f3f4f6',
              border: 'none',
              cursor: 'pointer',
              color: '#4b5563',
              transition: 'background-color 0.2s',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '20px', width: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div
              style={{
                height: '32px',
                width: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#dbeafe',
                borderRadius: '50%',
                marginRight: '12px',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '16px', width: '16px', color: '#3b82f6' }} viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
            </div>
            <h4 style={{ fontSize: '16px', fontWeight: 500, color: '#1f2937' }}>{citation.source}</h4>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            fontStyle: 'italic',
            color: '#4b5563',
            borderLeft: '4px solid #3b82f6',
          }}
        >
          &ldquo;{citation.text}&rdquo;
        </div>

        {citation.location && (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#6b7280' }}>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '16px', width: '16px', marginRight: '4px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{citation.location}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitationModal;

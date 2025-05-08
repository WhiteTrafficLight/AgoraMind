'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedImageBase64: string) => void;
}

export default function ImageCropModal({ isOpen, onClose, onSave }: ImageCropModalProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10
  });
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Add body lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setImgSrc('');
      setCompletedCrop(null);
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const getCroppedImg = (
    image: HTMLImageElement,
    crop: Crop,
  ): string => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      throw new Error('No 2d context');
    }

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );
    
    return canvas.toDataURL('image/jpeg');
  };

  const handleSave = () => {
    if (!completedCrop || !imgRef.current) return;
    
    try {
      setLoading(true);
      const croppedImageBase64 = getCroppedImg(imgRef.current, completedCrop);
      onSave(croppedImageBase64);
      onClose();
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
        zIndex: 9999,
        backdropFilter: 'blur(2px)'
      }}
    >
      <div 
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '20px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          margin: '0 20px'
        }}
      >
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 600, 
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          Set Profile Image
        </h2>
        
        {!imgSrc ? (
          <div style={{ 
            marginBottom: '16px', 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <label style={{
              display: 'block',
              width: '90%',
              padding: '16px',
              textAlign: 'center',
              border: '2px dashed #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              margin: '0 auto'
            }}>
              <span style={{ color: '#666' }}>Select Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={onSelectFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        ) : (
          <div style={{ 
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            maxHeight: '280px',
            overflow: 'hidden'
          }}>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              style={{
                maxWidth: '100%',
                margin: '0 auto'
              }}
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Crop me"
                style={{ 
                  maxHeight: '220px',
                  maxWidth: '100%',
                  margin: '0 auto',
                  display: 'block'
                }}
              />
            </ReactCrop>
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '8px' 
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!completedCrop || loading}
            style={{
              padding: '8px 16px',
              backgroundColor: !completedCrop || loading ? '#999' : '#000',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: !completedCrop || loading ? 'not-allowed' : 'pointer',
              opacity: !completedCrop || loading ? 0.5 : 1
            }}
          >
            {loading ? 'Processing...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
} 
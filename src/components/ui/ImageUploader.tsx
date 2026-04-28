'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { validateImageFile } from '@/lib/imageUtils';
import { API_BASE_URL } from '@/lib/api/baseUrl';
import { loggers } from '@/utils/logger';

interface ImageUploaderProps {
  category: 'userProfile' | 'customNpc' | 'roomThumbnail';
  userId?: string;
  onUploadSuccess?: (urls: Record<string, string>, fileId: string) => void;
  onUploadError?: (error: string) => void;
  maxSize?: number; // MB
  className?: string;
  acceptedFormats?: string[];
  previewSize?: 'small' | 'medium' | 'large';
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  category,
  userId,
  onUploadSuccess,
  onUploadError,
  maxSize = 10,
  className = '',
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp'],
  previewSize = 'medium'
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSizeClasses = () => {
    switch (previewSize) {
      case 'small':
        return 'w-20 h-20';
      case 'medium':
        return 'w-32 h-32';
      case 'large':
        return 'w-48 h-48';
      default:
        return 'w-32 h-32';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      onUploadError?.(validation.error || 'Invalid file.');
      return;
    }

    if (file.size > maxSize * 1024 * 1024) {
      onUploadError?.(` File size must be ${maxSize}MB or smaller.`);
      return;
    }

    if (!acceptedFormats.includes(file.type)) {
      onUploadError?.('Unsupported file format.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // FormData
      const formData = new FormData();
      formData.append('file', file);
      if (userId) {
        formData.append('user_id', userId);
      }

      const response = await fetch(`${API_BASE_URL}/api/upload/upload/${category}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        onUploadSuccess?.(result.urls, result.file_id);
        setUploadProgress(100);
      } else {
        throw new Error(result.message || 'Upload failed');
      }

    } catch (error) {
      loggers.ui.error('Upload error:', error);
      onUploadError?.(error instanceof Error ? error.message : 'An error occurred during upload.');
      setPreview(null);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload area */}
      <div
        onClick={openFileDialog}
        className={`
          relative border-2 border-dashed border-gray-300 rounded-lg
          hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer
          flex flex-col items-center justify-center p-6
          ${getSizeClasses()}
          ${isUploading ? 'pointer-events-none' : ''}
        `}
      >
        {preview ? (
          <div className="relative w-full h-full">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover rounded-md"
            />
            
            {/* Delete button */}
            {!isUploading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearPreview();
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            )}

            {/* Upload progress overlay */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  <div className="text-sm">Uploading...</div>
                  {uploadProgress > 0 && (
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            {isUploading ? (
              <>
                <Loader2 className="animate-spin mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-500">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-500 mb-1">
                  Image upload
                </p>
                <p className="text-xs text-gray-400">
                  JPG, PNG, WebP (max {maxSize}MB)
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        {category === 'userProfile' && 'Upload your profile picture'}
        {category === 'customNpc' && 'Upload an NPC character image'}
        {category === 'roomThumbnail' && 'Upload a chat room thumbnail'}
      </div>
    </div>
  );
};

export default ImageUploader; 
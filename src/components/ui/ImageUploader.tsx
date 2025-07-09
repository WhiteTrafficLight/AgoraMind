'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { validateImageFile } from '@/lib/imageUtils';

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

  // 프리뷰 크기 설정
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

    // 파일 검증
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      onUploadError?.(validation.error || '파일이 유효하지 않습니다.');
      return;
    }

    // 추가 크기 검증
    if (file.size > maxSize * 1024 * 1024) {
      onUploadError?.(` 파일 크기는 ${maxSize}MB 이하여야 합니다.`);
      return;
    }

    // 포맷 검증
    if (!acceptedFormats.includes(file.type)) {
      onUploadError?.('지원하지 않는 파일 형식입니다.');
      return;
    }

    // 프리뷰 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 업로드 시작
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // FormData 생성
      const formData = new FormData();
      formData.append('file', file);
      if (userId) {
        formData.append('user_id', userId);
      }

      // 백엔드 업로드 API 호출
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/upload/upload/${category}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '업로드 실패');
      }

      const result = await response.json();
      
      if (result.success) {
        onUploadSuccess?.(result.urls, result.file_id);
        setUploadProgress(100);
      } else {
        throw new Error(result.message || '업로드 실패');
      }

    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.');
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
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 업로드 영역 */}
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
          // 프리뷰 이미지
          <div className="relative w-full h-full">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover rounded-md"
            />
            
            {/* 삭제 버튼 */}
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

            {/* 업로드 진행 중 오버레이 */}
            {isUploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-md flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  <div className="text-sm">업로드 중...</div>
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
          // 기본 업로드 UI
          <div className="text-center">
            {isUploading ? (
              <>
                <Loader2 className="animate-spin mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-500">업로드 중...</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-500 mb-1">
                  이미지 업로드
                </p>
                <p className="text-xs text-gray-400">
                  JPG, PNG, WebP (최대 {maxSize}MB)
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 도움말 텍스트 */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        {category === 'userProfile' && '프로필 사진을 업로드하세요'}
        {category === 'customNpc' && 'NPC 캐릭터 이미지를 업로드하세요'}
        {category === 'roomThumbnail' && '채팅방 썸네일을 업로드하세요'}
      </div>
    </div>
  );
};

export default ImageUploader; 
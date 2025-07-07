/**
 * 이미지 관리 유틸리티
 * 저장 전략에 따른 이미지 URL 생성 및 관리
 */

// 환경 변수에서 기본 URL들 가져오기
const S3_BASE_URL = process.env.NEXT_PUBLIC_S3_BASE_URL || 'https://sapiens-engine-assets.s3.ap-northeast-2.amazonaws.com';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface ImageConfig {
  type: 'static' | 's3';
  folder: string;
  sizes?: string[];
}

// 이미지 타입별 설정
export const IMAGE_CONFIGS = {
  // 정적 이미지 (Vercel CDN)
  philosopher: {
    type: 'static' as const,
    folder: '/images/philosophers',
    sizes: ['portraits', 'thumbnails']
  },
  moderator: {
    type: 'static' as const,
    folder: '/images/moderators',
    sizes: ['portraits', 'thumbnails']
  },
  system: {
    type: 'static' as const,
    folder: '/images/system'
  },
  
  // S3 동적 이미지
  userProfile: {
    type: 's3' as const,
    folder: 'users/profiles',
    sizes: ['original', 'thumbnail']
  },
  customNpc: {
    type: 's3' as const,
    folder: 'npcs/custom',
    sizes: ['portrait', 'thumbnail']
  },
  roomThumbnail: {
    type: 's3' as const,
    folder: 'rooms/thumbnails'
  }
} as const;

/**
 * 이미지 URL 생성기
 */
export function getImageUrl(
  category: keyof typeof IMAGE_CONFIGS,
  identifier: string,
  size?: string,
  extension: string = 'jpg'
): string {
  const config = IMAGE_CONFIGS[category];
  
  switch (config.type) {
    case 'static':
      // 정적 파일 (Vercel CDN)
      const sizePath = size ? `/${size}` : '';
      return `${config.folder}${sizePath}/${identifier}.${extension}`;
      
    case 's3':
      // S3 파일
      const s3SizePath = size ? `/${size}` : '';
      return `${S3_BASE_URL}/${config.folder}/${identifier}${s3SizePath}/image.${extension}`;
      
    default:
      throw new Error(`Unknown image type: ${(config as any).type}`);
  }
}

/**
 * 철학자 이미지 URL
 */
export function getPhilosopherImage(id: string, size: 'portraits' | 'thumbnails' = 'portraits'): string {
  return getImageUrl('philosopher', id, size, 'jpg');
}

/**
 * 사용자 프로필 이미지 URL
 */
export function getUserProfileImage(userId: string, size: 'original' | 'thumbnail' = 'original'): string {
  return getImageUrl('userProfile', userId, size, 'jpg');
}

/**
 * Custom NPC 이미지 URL
 */
export function getCustomNpcImage(npcId: string, size: 'portrait' | 'thumbnail' = 'portrait'): string {
  return getImageUrl('customNpc', npcId, size, 'jpg');
}

/**
 * 모더레이터 이미지 URL
 */
export function getModeratorImage(moderatorId: string, size: 'portraits' | 'thumbnails' = 'portraits'): string {
  return getImageUrl('moderator', moderatorId, size, 'png');
}

/**
 * 시스템 이미지 URL
 */
export function getSystemImage(imageName: string, extension: string = 'png'): string {
  return getImageUrl('system', imageName, undefined, extension);
}

/**
 * 이미지 최적화 유틸리티
 */
export function getOptimizedImageUrl(
  baseUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string {
  // Vercel 이미지 최적화 API 사용
  if (baseUrl.startsWith('/images/')) {
    const params = new URLSearchParams();
    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.quality) params.append('q', options.quality.toString());
    
    const queryString = params.toString();
    return `/_next/image?url=${encodeURIComponent(baseUrl)}${queryString ? '&' + queryString : ''}`;
  }
  
  return baseUrl;
}

/**
 * 기본 이미지 (fallback)
 */
export const DEFAULT_IMAGES = {
  user: '/images/system/default-user.png',
  philosopher: '/images/system/default-philosopher.png',
  npc: '/images/system/default-npc.png',
  moderator: '/images/system/default-moderator.png',
  room: '/images/system/default-room.png'
};

/**
 * 이미지 로드 에러 처리
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackType: keyof typeof DEFAULT_IMAGES
): void {
  const img = event.currentTarget;
  img.src = DEFAULT_IMAGES[fallbackType];
}

/**
 * 이미지 업로드 검증
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'JPG, PNG, WebP 파일만 업로드 가능합니다.' };
  }
  
  if (file.size > maxSize) {
    return { isValid: false, error: '파일 크기는 10MB 이하여야 합니다.' };
  }
  
  return { isValid: true };
} 
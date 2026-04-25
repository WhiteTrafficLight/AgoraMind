const S3_BASE_URL = process.env.NEXT_PUBLIC_S3_BASE_URL || 'https://sapiens-engine-assets.s3.ap-northeast-2.amazonaws.com';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ImageConfig {
  type: 'static' | 's3';
  folder: string;
  sizes?: string[];
}

export const IMAGE_CONFIGS = {
  // (Vercel CDN)
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

export function getImageUrl(
  category: keyof typeof IMAGE_CONFIGS,
  identifier: string,
  size?: string,
  extension: string = 'jpg'
): string {
  const config = IMAGE_CONFIGS[category];
  
  switch (config.type) {
    case 'static':
      // (Vercel CDN)
      const sizePath = size ? `/${size}` : '';
      return `${config.folder}${sizePath}/${identifier}.${extension}`;
      
    case 's3':
      const s3SizePath = size ? `/${size}` : '';
      return `${S3_BASE_URL}/${config.folder}/${identifier}${s3SizePath}/image.${extension}`;
      
    default:
      throw new Error(`Unknown image type: ${(config as { type: string }).type}`);
  }
}

export function getPhilosopherImage(id: string, size: 'portraits' | 'thumbnails' = 'portraits'): string {
  return getImageUrl('philosopher', id, size, 'jpg');
}

export function getUserProfileImage(userId: string, size: 'original' | 'thumbnail' = 'original'): string {
  return getImageUrl('userProfile', userId, size, 'jpg');
}

/**
 * Custom NPC URL
 */
export function getCustomNpcImage(npcId: string, size: 'portrait' | 'thumbnail' = 'portrait'): string {
  return getImageUrl('customNpc', npcId, size, 'jpg');
}

export function getModeratorImage(moderatorId: string, size: 'portraits' | 'thumbnails' = 'portraits'): string {
  return getImageUrl('moderator', moderatorId, size, 'png');
}

export function getSystemImage(imageName: string, extension: string = 'png'): string {
  return getImageUrl('system', imageName, undefined, extension);
}

export function getOptimizedImageUrl(
  baseUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string {
  // Vercel API
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
 * (fallback)
 */
export const DEFAULT_IMAGES = {
  user: '/images/system/default-user.png',
  philosopher: '/images/system/default-philosopher.png',
  npc: '/images/system/default-npc.png',
  moderator: '/images/system/default-moderator.png',
  room: '/images/system/default-room.png'
};

export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackType: keyof typeof DEFAULT_IMAGES
): void {
  const img = event.currentTarget;
  img.src = DEFAULT_IMAGES[fallbackType];
}

export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Only JPG, PNG, and WebP files can be uploaded.' };
  }
  
  if (file.size > maxSize) {
    return { isValid: false, error: 'File size must be 10MB or less.' };
  }
  
  return { isValid: true };
} 
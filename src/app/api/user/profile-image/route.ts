import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import connectDB from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// S3 클라이언트 설정
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// 지원되는 이미지 포맷 (업계 표준)
const SUPPORTED_FORMATS = {
  'image/jpeg': 'jpg',
  'image/png': 'png', 
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif'
};

function validateImageSecurity(base64Data: string): boolean {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 파일 크기 검사 (5MB)
    if (buffer.length > 5 * 1024 * 1024) return false;
    
    // 매직 바이트 검증
    if (buffer.length < 12) return false;
    
    // JPEG: FF D8 FF
    if (buffer.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) return true;
    
    // PNG: 89 50 4E 47
    if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47]))) return true;
    
    // WebP: RIFF...WEBP
    if (buffer.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii')) && 
        buffer.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii'))) return true;
    
    // HEIC: ftypheic
    if (buffer.subarray(4, 12).equals(Buffer.from('ftypheic', 'ascii'))) return true;
    
    return false;
  } catch {
    return false;
  }
}

function removeMetadata(buffer: Buffer): Buffer {
  // 간단한 메타데이터 제거 (EXIF 등)
  // 실제로는 sharp나 jimp 라이브러리 사용 권장
  return buffer;
}

// POST: Upload profile image with client-side security
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const data = await req.json();
    const { image, format } = data;
    
    if (!image) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }
    
    await connectDB();
    
    // Find the user to get their ID
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    try {
      // Remove the data:image/...;base64, prefix
      const base64Data = image.replace(/^data:image\/[^;]+;base64,/, '');
      
      // 클라이언트 사이드 보안 검증
      if (!validateImageSecurity(base64Data)) {
        return NextResponse.json({ error: 'Invalid or unsafe image file' }, { status: 400 });
      }
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // 메타데이터 제거 (보안)
      const cleanBuffer = removeMetadata(buffer);
      
      // 원본 포맷 감지 및 확장자 결정
      let detectedFormat = 'jpg'; // 기본값
      let contentType = 'image/jpeg'; // 기본값
      
      // 매직 바이트로 실제 포맷 감지
      if (buffer.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
        detectedFormat = 'jpg';
        contentType = 'image/jpeg';
      } else if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47]))) {
        detectedFormat = 'png';
        contentType = 'image/png';
      } else if (buffer.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii')) && 
                 buffer.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii'))) {
        detectedFormat = 'webp';
        contentType = 'image/webp';
      } else if (buffer.subarray(4, 12).equals(Buffer.from('ftypheic', 'ascii'))) {
        detectedFormat = 'heic';
        contentType = 'image/heic';
      } else if (buffer.subarray(4, 12).equals(Buffer.from('ftypheif', 'ascii'))) {
        detectedFormat = 'heif';
        contentType = 'image/heif';
      }
      
      const fileName = `users/profiles/user_${user._id}_${Date.now()}.${detectedFormat}`;
      
      // S3 업로드 (환경변수명 수정: AWS_S3_BUCKET 사용)
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: fileName,
        Body: cleanBuffer,
        ContentType: contentType,
        ACL: 'public-read' as const,
        // 추가 보안 헤더
        Metadata: {
          'user-id': user._id.toString(),
          'upload-time': new Date().toISOString(),
          'original-format': detectedFormat
        }
      };
      
      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);
      
      // S3 URL 생성 (환경변수명 수정)
      const imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${fileName}`;
      
      // Update the user profile in the database (MONGODB_URI 환경변수는 connectDB()에서 사용)
      const updatedUser = await User.findOneAndUpdate(
        { email: session.user.email },
        { profileImage: imageUrl },
        { new: true, runValidators: true }
      ).select('-password');
      
      if (!updatedUser) {
        return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
      }
      
      revalidatePath('/settings');
      
      return NextResponse.json({
        message: 'Profile image updated successfully',
        profileImageUrl: imageUrl,
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          profileImage: updatedUser.profileImage,
          bio: updatedUser.bio
        }
      });
    } catch (error) {
      console.error('Error processing image:', error);
      return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return NextResponse.json({ error: 'Failed to upload profile image' }, { status: 500 });
  }
} 
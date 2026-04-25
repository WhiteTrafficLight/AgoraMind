import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import connectDB from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
    
    if (buffer.length > 5 * 1024 * 1024) return false;
    
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
  // (EXIF )
  // sharp jimp
  return buffer;
}

// POST: Upload profile image with client-side security
export async function POST(req: NextRequest) {
  console.log('[Profile Image API] Request started');
  
  try {
    const requiredEnvVars = {
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      MONGODB_URI: process.env.MONGODB_URI
    };
    
    console.log('[Profile Image API] Env vars check:', {
      AWS_S3_BUCKET: !!requiredEnvVars.AWS_S3_BUCKET,
      AWS_ACCESS_KEY_ID: !!requiredEnvVars.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!requiredEnvVars.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: !!requiredEnvVars.AWS_REGION,
      MONGODB_URI: !!requiredEnvVars.MONGODB_URI
    });
    
    const missingEnvVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingEnvVars.length > 0) {
      console.error('[Profile Image API] Missing env vars:', missingEnvVars);
      return NextResponse.json({ 
        error: 'Server configuration error', 
        details: `Missing environment variables: ${missingEnvVars.join(', ')}` 
      }, { status: 500 });
    }
    
    console.log('[Profile Image API] Verifying session...');
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.error('[Profile Image API] Unauthenticated user');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log('[Profile Image API] Session verified:', session.user.email);
    
    console.log('[Profile Image API] Parsing request data...');
    const data = await req.json();
    const { image, format } = data;
    
    if (!image) {
      console.error('[Profile Image API] No image data');
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }
    
    console.log('[Profile Image API] Image data verified');
    
    console.log('[Profile Image API] Connecting to MongoDB...');
    await connectDB();
    console.log('[Profile Image API] Connected to MongoDB');
    
    // Find the user to get their ID
    console.log('🔧 [Profile Image API] User lookup in progress:', session.user.email);
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      console.error('[Profile Image API] User not found:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    console.log('[Profile Image API] User lookup complete:', user._id);
    
    try {
      console.log('[Profile Image API] Image processing started...');
      
      // Remove the data:image/...;base64, prefix
      const base64Data = image.replace(/^data:image\/[^;]+;base64,/, '');
      
      if (!validateImageSecurity(base64Data)) {
        console.error('[Profile Image API] Image security validation failed');
        return NextResponse.json({ error: 'Invalid or unsafe image file' }, { status: 400 });
      }
      
      console.log('[Profile Image API] Image security check passed');
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      console.log('[Profile Image API] Image buffer converted, size:', buffer.length);
      
      const cleanBuffer = removeMetadata(buffer);
      
      let detectedFormat = 'jpg';
      let contentType = 'image/jpeg';
      
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
      console.log('✅ [Profile Image API] Filename generated:', fileName);
      
      console.log('[Profile Image API] S3 upload starting...');
      
      // S3 ( : AWS_S3_BUCKET )
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: fileName,
        Body: cleanBuffer,
        ContentType: contentType,
        Metadata: {
          'user-id': user._id.toString(),
          'upload-time': new Date().toISOString(),
          'original-format': detectedFormat
        }
      };
      
      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);
      console.log('[Profile Image API] S3 upload complete');
      
      // S3 URL ( )
      const imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${fileName}`;
      console.log('[Profile Image API] S3 URL generated:', imageUrl);
      
      console.log('[Profile Image API] Database update started...');
      
      // Update the user profile in the database (MONGODB_URI connectDB() )
      const updatedUser = await User.findOneAndUpdate(
        { email: session.user.email },
        { profileImage: imageUrl },
        { new: true, runValidators: true }
      ).select('-password');
      
      if (!updatedUser) {
        console.error('[Profile Image API] User profile update failed');
        return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
      }
      
      console.log('[Profile Image API] Database update complete');
      
      revalidatePath('/settings');
      
      console.log('✅ [Profile Image API] Pipeline complete');
      
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
      console.error('❌ [Profile Image API] Error processing image:', error);
      return NextResponse.json({ 
        error: 'Failed to process image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Profile Image API] Pipeline error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload profile image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
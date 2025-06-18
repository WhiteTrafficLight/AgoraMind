import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import connectDB from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';

// POST: Upload profile image from base64 data
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const data = await req.json();
    const { image } = data;
    
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
      const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Create upload directory in public folder
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
      
      // Ensure the directory exists
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }
      
      // Create a unique filename based on user ID and timestamp
      const fileName = `user_${user._id}_${Date.now()}.jpg`;
      const filePath = path.join(uploadsDir, fileName);
      
      // Save the file
      await fs.writeFile(filePath, buffer);
      
      // Create the URL that will be used to access the image
      const imageUrl = `/uploads/profiles/${fileName}`;
      
      // Update the user profile in the database
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
        profileImageUrl: imageUrl
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
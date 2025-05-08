import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import User from '@/models/User';
import connectDB from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';

// GET: Get user profile information
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    await connectDB();
    
    // Find user by email
    const user = await User.findOne({ email: session.user.email }).select('-password');
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      id: user._id,
      username: user.username,
      email: user.email,
      bio: user.bio || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profileImage: user.profileImage || null
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

// PUT: Update user profile information
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const data = await req.json();
    
    // Updatable fields (excluding sensitive information like passwords)
    const { username, bio } = data;
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    
    await connectDB();
    
    // Update user information
    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email },
      { username, bio },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    revalidatePath('/settings');
    
    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        bio: updatedUser.bio || '',
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        profileImage: updatedUser.profileImage || null
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}

// POST: Upload profile image
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const formData = await req.formData();
    const profileImage = formData.get('profileImage') as File;
    
    if (!profileImage) {
      return NextResponse.json({ error: 'Profile image is required' }, { status: 400 });
    }
    
    await connectDB();
    
    // Find the user to get their ID
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Find the correct path to the portraits directory at project root
    const currentDir = process.cwd();
    const rootProjectDir = currentDir.includes('/agoramind') 
      ? currentDir.substring(0, currentDir.indexOf('/agoramind')) 
      : currentDir;
    
    const portraitsDir = path.join(rootProjectDir, 'portraits');
    console.log('Current directory:', currentDir);
    console.log('Root project directory:', rootProjectDir);
    console.log('Portraits directory:', portraitsDir);
    
    try {
      await fs.access(portraitsDir);
      console.log(`Portraits directory found at: ${portraitsDir}`);
    } catch (error) {
      console.error(`Error accessing portraits directory: ${portraitsDir}`, error);
      throw new Error(`Portraits directory not found at ${portraitsDir}`);
    }
    
    // Create a unique filename based on user ID
    const fileName = `user_${user._id}.jpg`;
    const filePath = path.join(portraitsDir, fileName);
    console.log(`Saving image to: ${filePath}`);
    
    // Convert image data to buffer and save it
    const bytes = await profileImage.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);
    console.log(`File saved: ${filePath}`);
    
    // This is the URL that will be used to access the image
    const imageUrl = `/portraits/${fileName}`;
    console.log(`Image URL saved to database: ${imageUrl}`);
    
    // Update the user profile in the database
    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email },
      { profileImage: imageUrl },
      { new: true, runValidators: true }
    ).select('-password');
    
    revalidatePath('/settings');
    
    return NextResponse.json({
      message: 'Profile image updated successfully',
      profileImage: imageUrl
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return NextResponse.json({ error: 'Failed to upload profile image' }, { status: 500 });
  }
}

// Add an API route to get the default avatar
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    await connectDB();
    
    // Update user to remove profile image
    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email },
      { profileImage: null },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    revalidatePath('/settings');
    
    return NextResponse.json({
      message: 'Profile image removed successfully',
      profileImage: null
    });
  } catch (error) {
    console.error('Error removing profile image:', error);
    return NextResponse.json({ error: 'Failed to remove profile image' }, { status: 500 });
  }
} 
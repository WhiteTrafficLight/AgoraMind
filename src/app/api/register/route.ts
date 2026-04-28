import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { loggers } from '@/utils/logger';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { username, email, password } = await req.json();
    
    // Validate input
    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Please fill in all fields.' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await connectDB();
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json(
          { success: false, message: 'Email already in use.' },
          { status: 400 }
        );
      }
      if (existingUser.username === username) {
        return NextResponse.json(
          { success: false, message: 'Username already in use.' },
          { status: 400 }
        );
      }
    }
    
    // Create new user
    const user = await User.create({
      username,
      email,
      password,
    });
    
    // Return success without exposing user data
    return NextResponse.json(
      { success: true, message: 'Registration complete.' },
      { status: 201 }
    );
    
  } catch (error: unknown) {
    loggers.auth.error('Register error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during registration.', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
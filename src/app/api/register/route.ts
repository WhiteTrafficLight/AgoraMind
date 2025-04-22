import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { username, email, password } = await req.json();
    
    // Validate input
    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, message: '모든 필드를 입력해주세요.' },
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
          { success: false, message: '이미 사용 중인 이메일입니다.' },
          { status: 400 }
        );
      }
      if (existingUser.username === username) {
        return NextResponse.json(
          { success: false, message: '이미 사용 중인 사용자 이름입니다.' },
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
      { success: true, message: '회원가입이 완료되었습니다.' },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, message: '회원가입 중 오류가 발생했습니다.', error: error.message },
      { status: 500 }
    );
  }
} 
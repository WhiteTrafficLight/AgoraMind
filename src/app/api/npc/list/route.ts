import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/authOptions';
import connectDB from '@/lib/mongodb';
import CustomNpc from '@/models/Npc';

export async function GET(req: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id || session.user.email;

    // DB 연결
    await connectDB();
    // 사용자 NPC 조회
    const docs = await CustomNpc.find({ created_by: userId }).lean();

    // JSON 반환
    const npcs = docs.map(doc => ({
      id: doc.backend_id || String(doc._id),
      name: doc.name,
      description: doc.role,
      concepts: doc.reference_philosophers,
      voice_style: doc.voice_style,
      portrait_url: doc.portrait_url || null
    }));

    return NextResponse.json({ npcs });
  } catch (error) {
    console.error('Error in npc list:', error);
    return NextResponse.json({ message: 'Failed to fetch NPC list' }, { status: 500 });
  }
} 
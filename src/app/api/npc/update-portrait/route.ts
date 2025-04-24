import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import connectDB from '@/lib/mongodb';
import CustomNpc from '@/models/Npc';

export async function POST(req: NextRequest) {
  try {
    // 인증 확인 (직접 토큰 확인)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    
    const userId = token.sub || token.email;
    const { npcId, portraitUrl } = await req.json();
    
    if (!npcId || !portraitUrl) {
      return NextResponse.json(
        { message: 'NPC ID and portrait URL are required' }, 
        { status: 400 }
      );
    }
    
    await connectDB();
    
    // DB에서 해당 NPC 찾기 (사용자 소유 확인도 함께)
    const npc = await CustomNpc.findOne({ 
      backend_id: npcId,
      created_by: userId 
    });
    
    if (!npc) {
      return NextResponse.json(
        { message: 'NPC not found or you do not have permission' }, 
        { status: 404 }
      );
    }
    
    // 이미지 URL 업데이트 (http://localhost:8000으로 시작하는 전체 URL)
    // URL 형식 확인 - 상대 경로인 경우 전체 URL로 변환
    npc.portrait_url = portraitUrl.startsWith('http') 
      ? portraitUrl 
      : `http://localhost:8000${portraitUrl.startsWith('/') ? '' : '/'}${portraitUrl}`;
    await npc.save();
    
    return NextResponse.json({
      message: 'Portrait URL updated successfully',
      npc: {
        id: npc.backend_id || npc._id,
        portrait_url: npc.portrait_url
      }
    });
    
  } catch (error) {
    console.error('Error updating NPC portrait:', error);
    return NextResponse.json(
      { message: 'Failed to update NPC portrait' }, 
      { status: 500 }
    );
  }
} 
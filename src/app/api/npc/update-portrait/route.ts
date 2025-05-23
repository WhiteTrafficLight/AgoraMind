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
    
    // URL 처리 개선: http://localhost:8000/portraits/xyz.jpg -> /portraits/xyz.jpg
    let finalUrl = portraitUrl;
    if (portraitUrl.startsWith('http://localhost:8000/portraits/')) {
      finalUrl = `/portraits/${portraitUrl.split('/portraits/')[1]}`;
    } else if (!portraitUrl.startsWith('/portraits/') && !portraitUrl.startsWith('http')) {
      finalUrl = `/portraits/${portraitUrl}`;
    }
    
    // 이미지 URL 저장
    npc.portrait_url = finalUrl;
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
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/authOptions';
import connectDB from '@/lib/mongodb';
import CustomNpc from '@/models/Npc';

// 백엔드 API URL
const BACKEND_API_URL = 'http://localhost:8000';

/**
 * POST /api/npc/create
 * Custom NPC 생성 API
 */
export async function POST(req: NextRequest) {
  try {
    // 인증 확인 (로그인된 사용자만 NPC 생성 가능)
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { message: 'Authentication required to create custom NPCs' },
        { status: 401 }
      );
    }

    // 사용자 ID 확인
    const userId = session.user.id || session.user.email;
    
    // 요청 데이터 파싱
    const npcData = await req.json();
    
    console.log('Creating custom NPC for user:', userId);
    
    // NPC 데이터에 사용자 정보 추가
    const enrichedNpcData = {
      ...npcData,
      created_by: userId,
      created_at: new Date().toISOString()
    };
    
    // 1. 백엔드 sapiens_engine API 호출하여 NPC 등록
    // 참고: 이 부분은 실제 sapiens_engine API가 구현되어 있어야 합니다.
    try {
      console.log('Calling backend to create NPC');
      const backendResponse = await fetch(`${BACKEND_API_URL}/api/npc/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrichedNpcData),
        cache: 'no-store'
      });
      
      if (!backendResponse.ok) {
        const errorData = await backendResponse.json();
        throw new Error(errorData.detail || 'Failed to create NPC on backend server');
      }
      
      const backendData = await backendResponse.json();
      const npcId = backendData.id;
      
      // 2. 로컬 DB에 전체 NPC 정보 저장
      await connectDB();
      const savedNpc = await CustomNpc.create({
        backend_id: npcId,
        ...enrichedNpcData
      });
      
      console.log('NPC created successfully with ID:', npcId);
      
      return NextResponse.json({
        message: 'Custom philosopher created successfully',
        id: npcId,
        npc: savedNpc
      });
    } catch (backendError) {
      console.error('Error creating NPC on backend:', backendError);
      
      // 백엔드 연결 실패 시 대체 구현
      // 이 경우에는 일단 로컬에서만 처리하고 나중에 백엔드와 동기화하도록 구현할 수 있습니다.
      console.log('Using fallback local NPC creation');
      
      // 임시 NPC ID 생성
      const temporaryNpcId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 로컬 MongoDB에 전체 NPC 정보 저장 (fallback)
      await connectDB();
      const savedLocalNpc = await CustomNpc.create({
        backend_id: temporaryNpcId,
        ...enrichedNpcData,
        pending_sync: true
      });
      
      console.log('NPC created locally with temporary ID:', temporaryNpcId);
      
      return NextResponse.json({
        message: 'Custom philosopher created locally. Sync with backend pending.',
        id: temporaryNpcId,
        npc: savedLocalNpc,
        sync_status: 'pending'
      });
    }
  } catch (error) {
    console.error('Error in NPC creation API:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to create custom philosopher' },
      { status: 500 }
    );
  }
} 
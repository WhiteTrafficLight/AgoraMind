import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/authOptions';
import connectDB from '@/lib/mongodb';
import CustomNpc from '@/models/Npc';
import { API_BASE_URL } from '@/lib/api/baseUrl';
import { loggers } from '@/utils/logger';

/**
 * POST /api/npc/create
 * Custom NPC API
 */
export async function POST(req: NextRequest) {
  try {
    // ( NPC )
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { message: 'Authentication required to create custom NPCs' },
        { status: 401 }
      );
    }

    const userId = session.user.id || session.user.email;
    
    const npcData = await req.json();
    
    loggers.npc.info('Creating custom NPC for user:', userId);
    
    const enrichedNpcData = {
      ...npcData,
      created_by: userId,
      created_at: new Date().toISOString()
    };
    
    // 1. sapiens_engine API NPC
    // : sapiens_engine API .
    try {
      loggers.npc.info('Calling backend to create NPC');
      const backendResponse = await fetch(`${API_BASE_URL}/api/npc/create`, {
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
      
      // 2. DB NPC
      await connectDB();
      const savedNpc = await CustomNpc.create({
        backend_id: npcId,
        ...enrichedNpcData
      });
      
      loggers.npc.info('NPC created successfully with ID:', npcId);
      
      return NextResponse.json({
        message: 'Custom philosopher created successfully',
        id: npcId,
        npc: savedNpc
      });
    } catch (backendError) {
      loggers.npc.error('Error creating NPC on backend:', backendError);
      
      loggers.npc.info('Using fallback local NPC creation');
      
      const temporaryNpcId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // MongoDB NPC (fallback)
      await connectDB();
      const savedLocalNpc = await CustomNpc.create({
        backend_id: temporaryNpcId,
        ...enrichedNpcData,
        pending_sync: true
      });
      
      loggers.npc.info('NPC created locally with temporary ID:', temporaryNpcId);
      
      return NextResponse.json({
        message: 'Custom philosopher created locally. Sync with backend pending.',
        id: temporaryNpcId,
        npc: savedLocalNpc,
        sync_status: 'pending'
      });
    }
  } catch (error) {
    loggers.npc.error('Error in NPC creation API:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to create custom philosopher' },
      { status: 500 }
    );
  }
} 
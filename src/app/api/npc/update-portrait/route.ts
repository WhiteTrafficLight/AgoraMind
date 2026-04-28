import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import connectDB from '@/lib/mongodb';
import CustomNpc from '@/models/Npc';
import { API_BASE_URL } from '@/lib/api/baseUrl';
import { loggers } from '@/utils/logger';

export async function POST(req: NextRequest) {
  try {
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
    
    // DB NPC ( )
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
    
    // Backend returns absolute URLs; rewrite to relative so the Next.js
    // /portraits rewrite serves them through the same origin.
    let finalUrl = portraitUrl;
    if (portraitUrl.startsWith(`${API_BASE_URL}/portraits/`)) {
      finalUrl = `/portraits/${portraitUrl.split('/portraits/')[1]}`;
    } else if (!portraitUrl.startsWith('/portraits/') && !portraitUrl.startsWith('http')) {
      finalUrl = `/portraits/${portraitUrl}`;
    }
    
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
    loggers.npc.error('Error updating NPC portrait:', error);
    return NextResponse.json(
      { message: 'Failed to update NPC portrait' }, 
      { status: 500 }
    );
  }
} 
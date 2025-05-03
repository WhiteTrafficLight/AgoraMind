import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

// NPC 모델 스키마
const NpcSchema = new mongoose.Schema({
  name: String,
  role: String,
  voice_style: String,
  reference_philosophers: [String],
  communication_style: String,
  debate_approach: String,
  portrait_url: String,
  created_by: String,
  created_at: String,
  backend_id: String
});

export async function GET(req: NextRequest) {
  try {
    // URL에서 id 파라미터 추출
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      console.log('❌ No backend_id provided');
      return NextResponse.json({ error: 'backend_id is required' }, { status: 400 });
    }
    
    console.log(`🔍 Fetching NPC by backend_id: ${id}`);
    
    try {
      // MongoDB에 연결
      await connectDB();
      
      // NPC 모델 가져오기 (mongoose 모델이 없으면 생성)
      const NpcModel = mongoose.models.CustomNpc || mongoose.model('CustomNpc', NpcSchema);
      
      // MongoDB에서 backend_id로 NPC 조회
      console.log(`🔍 Searching by backend_id: ${id}`);
      const npc = await NpcModel.findOne({ backend_id: id });
      
      if (npc) {
        console.log(`✅ Found custom NPC with backend_id ${id}: ${npc.name}`);
        console.log(`   _id: ${npc._id}, backend_id: ${npc.backend_id || 'not set'}`);
        console.log(`   portrait_url: ${npc.portrait_url || 'NONE'}`);
        
        return NextResponse.json({
          id: npc._id.toString(),
          backend_id: npc.backend_id,
          name: npc.name,
          description: `Custom philosopher${npc.role ? ` with role: ${npc.role}` : ''}`,
          communication_style: npc.communication_style,
          debate_approach: npc.debate_approach,
          voice_style: npc.voice_style,
          reference_philosophers: npc.reference_philosophers,
          portrait_url: npc.portrait_url,
          is_custom: true,
          created_by: npc.created_by
        });
      } else {
        console.log(`❌ No NPC found with backend_id: ${id}`);
        return NextResponse.json(
          { error: `NPC with backend_id ${id} not found` },
          { status: 404 }
        );
      }
    } catch (dbError) {
      console.error('❌ MongoDB 조회 오류:', dbError);
      return NextResponse.json(
        { error: "Database error when searching NPC" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error in NPC get-by-backend-id handler:', error);
    return NextResponse.json(
      { error: "Failed to get NPC details" },
      { status: 500 }
    );
  }
} 
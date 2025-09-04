import { NextRequest, NextResponse } from 'next/server';
import { philosopherProfiles } from '@/lib/data/philosophers';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

// 백엔드 API URL
const BACKEND_API_URL = 'http://0.0.0.0:8000';

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
  created_at: String
});

export async function GET(req: NextRequest) {
  try {
    // URL에서 id 파라미터 추출
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'No ID provided' }, { status: 400 });
    }
    
    console.log(`🔍 Fetching NPC details for ID: ${id}`);
    
    // 커스텀 NPC인지 확인 (MongoDB에서 조회)
    const isMongoId = id.length >= 24 && /^[0-9a-fA-F]{24}$/.test(id);
    const isUuid = id.length > 30 && id.split('-').length === 5;
    
    if (isMongoId || isUuid) {
      try {
        // MongoDB에 연결
        await connectDB();
        
        // NPC 모델 가져오기 (mongoose 모델이 없으면 생성)
        const NpcModel = mongoose.models.CustomNpc || mongoose.model('CustomNpc', NpcSchema);
        
        // MongoDB에서 NPC 조회 - ObjectID로 검색하거나 backend_id로 검색
        let npc;
        if (isMongoId) {
          console.log(`🔍 Searching by MongoDB ObjectID: ${id}`);
          npc = await NpcModel.findById(new ObjectId(id));
        }
        
        // ObjectID로 찾지 못했거나 UUID 형식이면 backend_id로 검색
        if (!npc && isUuid) {
          console.log(`🔍 Searching by backend_id (UUID): ${id}`);
          npc = await NpcModel.findOne({ backend_id: id });
        }
        
        // 그래도 못 찾았으면 id 필드로 한번 더 검색 (이전 버전 호환성)
        if (!npc) {
          console.log(`🔍 Searching by id field as fallback: ${id}`);
          npc = await NpcModel.findOne({ id: id });
        }
        
        if (npc) {
          console.log(`✅ Found custom NPC: ${npc.name}`);
          console.log(`   _id: ${npc._id}, backend_id: ${npc.backend_id || 'not set'}`);
          console.log(`   portrait_url: ${npc.portrait_url || 'NONE'}`);
          return NextResponse.json({
            id: npc._id.toString(),
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
          console.log(`❌ Custom NPC not found in MongoDB with any ID method: ${id}`);
          console.log('   Tried: ObjectID lookup, backend_id lookup, and id field lookup');
        }
      } catch (dbError) {
        console.error('❌ MongoDB 조회 오류:', dbError);
      }
    }
    
    // 기본 철학자 정보 확인
    try {
      // Python 백엔드 API 호출 시도
      // API 호출 제거 - 기본 NPC 정보 반환
      console.log(`🔄 Returning basic NPC data for: ${id}`);
      
      const basicNpcData = {
        id: id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        description: `${id.charAt(0).toUpperCase() + id.slice(1)} is a philosopher with unique perspectives.`,
        is_custom: false
      };
      
      return NextResponse.json(basicNpcData);
    } catch (apiError) {
      console.error('❌ Error generating basic NPC data:', apiError);
    }
    
    // 로컬 철학자 프로필에서 확인
    const philosophers = Object.keys(philosopherProfiles);
    const matchedPhilosopher = philosophers.find(name => 
      name.toLowerCase() === id.toLowerCase() || 
      id.toLowerCase().includes(name.toLowerCase())
    );
    
    if (matchedPhilosopher) {
      const profile = philosopherProfiles[matchedPhilosopher];
      console.log(`✅ Found local philosopher profile: ${matchedPhilosopher}`);
      
      return NextResponse.json({
        id: matchedPhilosopher.toLowerCase(),
        name: matchedPhilosopher,
        description: profile.description,
        key_concepts: profile.key_concepts,
        portrait_url: null, // 로컬 프로필에는 이미지 URL이 없음
        is_custom: false
      });
    }
    
    // 모든 시도가 실패하면 기본 정보 반환
    console.log(`⚠️ Returning default info for NPC: ${id}`);
    return NextResponse.json({
      id: id,
      name: id.charAt(0).toUpperCase() + id.slice(1), // ID를 이름으로 변환
      description: "A philosopher with unique perspectives",
      is_custom: false
    });
    
  } catch (error) {
    console.error('❌ Error in NPC get handler:', error);
    return NextResponse.json(
      { error: "Failed to get NPC details" },
      { status: 500 }
    );
  }
} 
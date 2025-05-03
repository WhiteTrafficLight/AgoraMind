import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`🔍 NPC API 요청 받음: ${req.method} ${req.url}`);
  console.log(`🔍 NPC ID 요청: ${req.query.id}`);

  if (req.method === 'GET') {
    try {
      // ID 가져오기
      const { id } = req.query;
      if (!id) {
        console.error('❌ NPC ID가 제공되지 않음');
        return res.status(400).json({ error: 'NPC ID is required' });
      }
      
      const npcId = Array.isArray(id) ? id[0] : id;
      console.log(`🔍 NPC ID 조회: ${npcId}`);
      
      // 통합된 /api/npc/get 엔드포인트로 내부 리디렉션
      console.log(`🔄 Redirecting to unified endpoint: /api/npc/get?id=${npcId}`);
      
      try {
        // 내부적으로 새 엔드포인트 호출
        const baseUrl = process.env.NEXTJS_API_URL || `http://${req.headers.host}`;
        const apiUrl = `${baseUrl}/api/npc/get?id=${npcId}`;
        console.log(`🔗 Calling internal API: ${apiUrl}`);
        
        const apiResponse = await fetch(apiUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await apiResponse.json();
        
        if (apiResponse.ok) {
          console.log(`✅ Forwarded response successful from unified endpoint`);
          return res.status(apiResponse.status).json(data);
        } else {
          // API가 실패하면 원래 로직으로 폴백
          console.log(`⚠️ Unified endpoint failed, falling back to original logic`);
        }
      } catch (redirectError) {
        console.error(`❌ Error in internal redirection: ${redirectError}`);
        console.log(`⚠️ Falling back to original logic`);
      }
      
      // 리디렉션 실패 시 원래 로직으로 폴백
      // MongoDB에 연결
      console.log('📊 MongoDB 연결 시도...');
      const client = await clientPromise;
      const db = client.db();
      const npcCollection = db.collection('npcs');
      
      // NPC 검색 로직 - ID가 MongoDB ObjectId 형식인지 또는 일반 문자열인지 확인
      let npc;
      
      // MongoDB ObjectId로 검색 시도
      if (npcId.length === 24 && /^[0-9a-fA-F]{24}$/.test(npcId)) {
        console.log(`🔍 MongoDB ObjectId로 검색: ${npcId}`);
        try {
          npc = await npcCollection.findOne({ _id: new ObjectId(npcId) });
        } catch (e) {
          console.error(`❌ ObjectId 검색 오류: ${e}`);
        }
      }
      
      // backend_id로 검색 (UUID 형식)
      if (!npc && npcId.includes('-')) {
        console.log(`🔍 Searching by backend_id (UUID): ${npcId}`);
        npc = await npcCollection.findOne({ backend_id: npcId });
      }
      
      // name으로 검색 (최후의 수단)
      if (!npc) {
        console.log(`🔍 이름으로 검색: ${npcId}`);
        npc = await npcCollection.findOne({ name: new RegExp(npcId, 'i') });
      }
      
      // NPC를 찾았는지 확인
      if (npc) {
        console.log(`✅ NPC 찾음: ${npc.name}`);
        console.log(`   _id: ${npc._id}, backend_id: ${npc.backend_id || 'undefined'}`);
        console.log(`   portrait_url: ${npc.portrait_url || 'undefined'}`);
        
        // 응답 형태 구성
        const response = {
          id: npc.backend_id || npc._id.toString(),
          name: npc.name,
          description: npc.description || `${npc.name} is a philosopher with unique perspectives.`,
          portrait_url: npc.portrait_url,
          voice_style: npc.voice_style,
          debate_approach: npc.debate_approach,
          communication_style: npc.communication_style,
          key_concepts: npc.key_concepts || []
        };
        
        console.log(`🔄 응답 데이터: ${JSON.stringify(response, null, 2)}`);
        return res.status(200).json(response);
      }
      
      console.error(`❌ NPC를 찾을 수 없음: ${npcId}`);
      return res.status(404).json({ error: `NPC with id ${npcId} not found` });
    } catch (error) {
      console.error(`❌❌ API 오류: ${error}`);
      return res.status(500).json({ error: 'Failed to fetch NPC data' });
    }
  }
  
  // 지원하지 않는 HTTP 메서드
  console.error(`❌ 지원하지 않는 메서드: ${req.method}`);
  return res.status(405).json({ error: 'Method not allowed' });
} 
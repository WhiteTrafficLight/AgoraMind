import { NextRequest, NextResponse } from 'next/server';
import { philosopherProfiles } from '@/lib/data/philosophers';

// 백엔드 API URL
const BACKEND_API_URL = 'http://0.0.0.0:8000';

export async function POST(req: NextRequest) {
  try {
    // 요청 데이터 파싱
    const { philosopher, topic, context } = await req.json();

    console.log(`💬 Generating initial message for ${philosopher} on topic: ${topic}`);
    
    // 헤더에서 LLM 설정 확인
    const llmProvider = req.headers.get('x-llm-provider') || 'openai';
    const llmModel = req.headers.get('x-llm-model') || '';

    // 철학자 프로필 가져오기
    const profile = philosopherProfiles[philosopher];
    if (!profile) {
      console.error(`❌ Philosopher profile not found for: ${philosopher}`);
      return NextResponse.json(
        { error: `Profile not found for philosopher: ${philosopher}` },
        { status: 400 }
      );
    }

    try {
      // 백엔드 API 호출
      console.log(`🔄 Calling backend API at ${BACKEND_API_URL}/api/chat/generate`);
      
      const npcDescription = `Name: ${philosopher}
Role: Philosopher
Voice Style: ${profile.style}
Communication Style: balanced
Debate Approach: dialectical
Personality Traits: critical_thinking: 0.8, creativity: 0.7
Philosophical Background: ${profile.key_concepts.join(', ')}`;
      
      const backendResponse = await fetch(`${BACKEND_API_URL}/api/chat/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          npc_description: npcDescription,
          topic: topic,
          context: context || "",
          previous_dialogue: "",
          llm_provider: llmProvider,
          llm_model: llmModel || 'gpt-4o'
        }),
        // Next.js API 라우트에서는 https.Agent를 직접 사용하지 않고 다음 옵션 사용
        cache: 'no-store'
      });

      if (!backendResponse.ok) {
        throw new Error(`Backend API error: ${backendResponse.status}`);
      }

      const backendData = await backendResponse.json();
      const generatedText = backendData.response || backendData.text || backendData.message;
      
      console.log(`✅ Generated initial message from backend for ${philosopher}`);
      return NextResponse.json({ text: generatedText });
    } catch (error) {
      console.error('❌ Error calling backend API:', error);
      
      // 백엔드 호출 실패 시 폴백 응답
      const fallbackResponses = [
        `I find this topic of "${topic}" quite fascinating. What aspects of it interest you the most?`,
        `Let us explore "${topic}" together. What questions come to mind when you consider this subject?`,
        `The question of "${topic}" has intrigued philosophers for centuries. Where shall we begin our inquiry?`
      ];
      
      // 랜덤 응답 선택
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      console.log(`⚠️ Using fallback response due to backend error`);
      return NextResponse.json({ text: randomResponse });
    }
  } catch (error) {
    console.error('❌ Error in initial chat handler:', error);
    return NextResponse.json(
      { error: "Failed to generate initial message" },
      { status: 500 }
    );
  }
} 
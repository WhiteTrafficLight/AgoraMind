import { NextRequest, NextResponse } from 'next/server';
import { philosopherProfiles } from '@/lib/data/philosophers';

// 백엔드 API URL
const BACKEND_API_URL = 'http://0.0.0.0:8000';

// NPC 데이터 인터페이스
interface NpcData {
  name: string;
  description?: string;
  communication_style?: string;
  debate_approach?: string;
  voice_style?: string;
  reference_philosophers?: string[];
  id?: string;
}

// 간단한 언어 감지 함수
function detectLanguage(text: string): string {
  // 한국어 감지 (한글 유니코드 범위: AC00-D7A3, 1100-11FF)
  const koreanRegex = /[\uAC00-\uD7A3\u1100-\u11FF]/;
  if (koreanRegex.test(text)) return 'Korean';
  
  // 일본어 감지 (히라가나, 카타카나 유니코드 범위: 3040-309F, 30A0-30FF)
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
  if (japaneseRegex.test(text)) return 'Japanese';
  
  // 중국어 감지 (한자 유니코드 범위: 4E00-9FFF)
  const chineseRegex = /[\u4E00-\u9FFF]/;
  if (chineseRegex.test(text)) return 'Chinese';
  
  // 기본값은 영어
  return 'English';
}

// 프리픽스 제거 함수
function removeNamePrefix(text: string): string {
  // "Name: " 패턴 찾기 (이름: 또는 이름 : 형식)
  const prefixRegex = /^[A-Za-z\s]+[:：]\s*/;
  return text.replace(prefixRegex, '');
}

// NPC 설명 준비 함수
function prepareNpcDescription(philosopher: string, npcData: NpcData | null, isCustomNpc: boolean, language: string): string {
  let description;
  
  if (isCustomNpc && npcData) {
    // 커스텀 NPC 정보 사용
    description = `Name: ${npcData.name}
Role: Custom Philosopher
Voice Style: ${npcData.voice_style || 'conversational'}
Communication Style: ${npcData.communication_style || 'balanced'}
Debate Approach: ${npcData.debate_approach || 'dialectical'}
${npcData.description ? `Description: ${npcData.description}` : ''}
${npcData.reference_philosophers && npcData.reference_philosophers.length > 0 ? 
  `Influenced by: ${npcData.reference_philosophers.join(', ')}` : ''}`;
  } else {
    // 기본 철학자 프로필 가져오기
    const profile = philosopherProfiles[philosopher.toLowerCase()];
    if (!profile) {
      console.error(`❌ Philosopher profile not found for: ${philosopher}`);
      description = `Name: ${philosopher}
Role: Philosopher
Voice Style: balanced
Communication Style: balanced
Debate Approach: dialectical`;
    } else {
      description = `Name: ${philosopher}
Role: Philosopher
Voice Style: ${profile.style || 'balanced'}
Communication Style: balanced
Debate Approach: dialectical
Personality Traits: critical_thinking: 0.8, creativity: 0.7
Philosophical Background: ${profile.key_concepts ? profile.key_concepts.join(', ') : 'philosophy'}`;
    }
  }
  
  // 언어 설정 추가하여 다국어 지원
  const languageInstruction = `IMPORTANT: Respond in ${language} language to match the topic language.
DO NOT include your name as a prefix in your response.
DO NOT start with "${philosopher}: " or any other name prefix.
Just provide your philosophical response directly.`;
  
  return `${description}\n${languageInstruction}`;
}

// 폴백 응답 생성 함수
function generateFallbackResponse(topic: string): NextResponse {
  const topicLanguage = detectLanguage(topic);
  
  const fallbackResponses: Record<string, string[]> = {
    'English': [
      `I find this topic of "${topic}" quite fascinating. What aspects of it interest you the most?`,
      `Let's explore "${topic}" together. What questions come to mind when you consider this subject?`,
      `The question of "${topic}" has intrigued philosophers for centuries. Where shall we begin our inquiry?`
    ],
    'Korean': [
      `"${topic}"에 대한 주제가 매우 흥미롭습니다. 어떤 측면이 가장 관심이 있으신가요?`,
      `함께 "${topic}"에 대해 탐구해 봅시다. 이 주제를 생각할 때 어떤 질문이 떠오르나요?`,
      `"${topic}"에 대한 질문은 수세기 동안 철학자들을 매료시켜 왔습니다. 어디서부터 시작할까요?`
    ],
    'Japanese': [
      `"${topic}"というテーマは非常に興味深いです。どのような側面に最も興味がありますか？`,
      `一緒に"${topic}"について探求しましょう。このテーマについて考えるとき、どのような質問が浮かびますか？`,
      `"${topic}"に関する問いは何世紀にもわたって哲学者を魅了してきました。どこから始めましょうか？`
    ],
    'Chinese': [
      `我发现"${topic}"这个主题非常吸引人。哪些方面最令你感兴趣？`,
      `让我们一起探索"${topic}"。当你思考这个主题时，有哪些问题浮现在脑海中？`,
      `关于"${topic}"的问题几个世纪以来一直吸引着哲学家。我们从哪里开始探讨呢？`
    ]
  };
  
  // 감지된 언어 또는 폴백으로 영어 사용
  const languageResponses = fallbackResponses[topicLanguage] || fallbackResponses['English'];
  
  // 랜덤 응답 선택
  const randomResponse = languageResponses[Math.floor(Math.random() * languageResponses.length)];
  console.log(`⚠️ Using fallback response due to backend error`);
  return NextResponse.json({ text: randomResponse });
}

export async function POST(req: NextRequest) {
  try {
    // 요청 데이터 파싱
    const { philosopher, topic, context, npcData } = await req.json();

    console.log(`💬 Generating initial message for ${philosopher} on topic: ${topic}`);
    
    // 헤더에서 LLM 설정 확인
    const llmProvider = req.headers.get('x-llm-provider') || 'openai';
    const llmModel = req.headers.get('x-llm-model') || '';

    // 주제의 언어 감지
    const topicLanguage = detectLanguage(topic);
    console.log(`Detected language: ${topicLanguage}`);

    // NPC 데이터 확인
    const isCustomNpc = npcData && Object.keys(npcData).length > 0;
    console.log(`Using ${isCustomNpc ? 'custom' : 'default'} NPC data`);

    // NPC 설명 준비
    const npcDescription = prepareNpcDescription(philosopher, npcData, isCustomNpc, topicLanguage);
    
    // 백엔드 API 호출 (재시도 로직)
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let backendData;
    
    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`🔄 Calling backend API (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
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
            npcs: [isCustomNpc && npcData.id ? npcData.id : philosopher.toLowerCase()],
            llm_provider: llmProvider,
            llm_model: llmModel || 'gpt-4o'
          }),
          cache: 'no-store'
        });

        if (!backendResponse.ok) {
          throw new Error(`Backend API error: ${backendResponse.status}`);
        }

        backendData = await backendResponse.json();
        break; // 성공 시 반복 종료
      } catch (error) {
        retryCount++;
        console.error(`Backend API error (attempt ${retryCount}/${MAX_RETRIES}):`, error);
        
        if (retryCount >= MAX_RETRIES) {
          throw error; // 최대 재시도 횟수 초과 시 오류 전파
        }
        
        // 지수 백오프
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
      }
    }
    
    // 응답 처리
    let generatedText = backendData.response || backendData.text || backendData.message;
    generatedText = removeNamePrefix(generatedText);
    
    return NextResponse.json({ text: generatedText });
  } catch (error) {
    console.error('❌ Error in initial chat handler:', error);
    
    // 요청 데이터 가져오기 
    let topic = '';
    try {
      const requestData = await req.json();
      topic = requestData.topic || 'philosophy';
    } catch (parseError) {
      topic = 'philosophy';
    }
    
    // 폴백 응답
    return generateFallbackResponse(topic);
  }
} 
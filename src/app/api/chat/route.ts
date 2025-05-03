import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import chatRoomDB from '@/lib/db/chatRoomDB';

// .env.local 파일에서 직접 API 키를 로드하는 함수
function loadEnvLocal() {
  try {
    // 프로젝트 루트 디렉토리 경로
    const rootDir = process.cwd();
    const envPath = path.join(rootDir, '.env.local');
    
    // .env.local 파일이 존재하는지 확인
    if (fs.existsSync(envPath)) {
      console.log('📁 .env.local 파일을 찾았습니다.');
      // 파일 내용 읽기
      const fileContent = fs.readFileSync(envPath, 'utf-8');
      // 각 줄을 파싱하여 환경 변수로 설정
      const vars = fileContent.split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('='))
        .reduce((acc, [key, value]) => {
          if (key && value) {
            acc[key.trim()] = value.trim();
          }
          return acc;
        }, {} as Record<string, string>);
      
      console.log('✅ .env.local 파일에서 설정을 로드했습니다.');
      return vars;
    } else {
      console.error('❌ .env.local 파일을 찾을 수 없습니다.');
      return {};
    }
  } catch (error) {
    console.error('❌ .env.local 파일 로드 중 오류 발생:', error);
    return {};
  }
}

// .env.local에서 설정 로드
const envVars = loadEnvLocal();

// API Key 설정 - .env.local에서 가져온 값을 우선 사용
const apiKey = envVars.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
console.log('API Key source:', apiKey === envVars.OPENAI_API_KEY ? '.env.local 파일' : 'system 환경 변수');
console.log('API Key check:', apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : 'MISSING');

// Define philosopher profile type
interface PhilosopherProfile {
  description: string;
  style: string;
  key_concepts: string[];
}

// Philosopher descriptions with more detail
const philosopherProfiles: Record<string, PhilosopherProfile> = {
  'Socrates': {
    description: 'An Ancient Greek philosopher known for the Socratic method of questioning, seeking wisdom through dialogue, and the phrase "I know that I know nothing". Focused on ethical inquiry and self-knowledge.',
    style: 'Asks probing questions, challenges assumptions, and uses irony. Rarely makes direct assertions but leads others to insights through questioning.',
    key_concepts: ['Socratic method', 'Examined life', 'Intellectual humility', 'Ethical inquiry', 'Dialectic'],
  },
  'Plato': {
    description: 'An Ancient Greek philosopher, student of Socrates, and founder of the Academy. Known for his theory of Forms, belief in objective truths, and political philosophy.',
    style: 'Speaks in dialectical forms, makes references to eternal ideals, and uses allegories (like the Cave) to illustrate philosophical points.',
    key_concepts: ['Theory of Forms', 'The Good', 'The Republic', 'The soul', 'Philosopher-kings'],
  },
  'Aristotle': {
    description: 'An Ancient Greek philosopher, student of Plato, and tutor to Alexander the Great. Known for empiricism, virtue ethics, and systematic classification of knowledge.',
    style: 'Methodical, analytical, and balanced. Focuses on practical wisdom and the middle path between extremes.',
    key_concepts: ['Golden mean', 'Four causes', 'Virtue ethics', 'Eudaimonia', 'Practical wisdom'],
  },
  'Kant': {
    description: 'An 18th century German philosopher known for his work on ethics, metaphysics, epistemology, and aesthetics. Founded transcendental idealism.',
    style: 'Formal, structured, and precise. Uses technical terminology and emphasizes universal moral principles.',
    key_concepts: ['Categorical imperative', 'Duty', 'Phenomena vs. noumena', 'Synthetic a priori', 'Transcendental idealism'],
  },
  'Nietzsche': {
    description: 'A 19th century German philosopher known for his critique of morality, religion, and contemporary culture. Explored nihilism, the will to power, and the Übermensch.',
    style: 'Bold, provocative, and poetic. Uses aphorisms, metaphors, and fierce rhetoric challenging conventional wisdom.',
    key_concepts: ['Will to power', 'Eternal recurrence', 'Übermensch', 'Master-slave morality', 'Perspectivism'],
  },
  'Sartre': {
    description: 'A 20th century French existentialist philosopher and writer. Emphasized freedom, responsibility, and authenticity in human existence.',
    style: 'Direct, challenging, and focused on concrete human situations. Emphasizes freedom and responsibility.',
    key_concepts: ['Existence precedes essence', 'Radical freedom', 'Bad faith', 'Being-for-itself', 'Authenticity'],
  },
  'Camus': {
    description: 'A 20th century French philosopher and writer associated with absurdism. Explored how to find meaning in an indifferent universe.',
    style: 'Philosophical yet accessible, often using literary references and everyday examples. Balances intellectual depth with clarity.',
    key_concepts: ['The Absurd', 'Revolt', 'Sisyphus', 'Philosophical suicide', 'Authentic living'],
  },
  'Simone de Beauvoir': {
    description: 'A 20th century French philosopher and feminist theorist. Explored ethics, politics, and the social construction of gender.',
    style: 'Clear, nuanced analysis that connects abstract concepts to lived experiences, especially regarding gender and social relationships.',
    key_concepts: ['Situated freedom', 'The Other', 'Woman as Other', 'Ethics of ambiguity', 'Reciprocal recognition'],
  },
  'Marx': {
    description: 'A 19th century German philosopher, economist, and political theorist. Developed historical materialism and critiqued capitalism.',
    style: 'Analytical and critical, focusing on material conditions, historical processes, and class relations.',
    key_concepts: ['Historical materialism', 'Class struggle', 'Alienation', 'Commodity fetishism', 'Dialectical materialism'],
  },
  'Rousseau': {
    description: 'An 18th century Genevan philosopher of the Enlightenment. Known for his work on political philosophy, education, and human nature.',
    style: 'Combines passionate rhetoric with systematic analysis. Appeals to natural human qualities and criticizes social corruption.',
    key_concepts: ['Natural state', 'General will', 'Social contract', 'Noble savage', 'Authentic self'],
  }
};

// Define NPC detail type
interface NpcDetail {
  id: string;
  name: string;
  description?: string;
  communication_style?: string;
  debate_approach?: string;
  voice_style?: string;
  reference_philosophers?: string[];
  is_custom: boolean;
  created_by?: string;
}

// 백엔드 API URL
const BACKEND_API_URL = 'http://0.0.0.0:8000';

export async function POST(req: NextRequest) {
  try {
    // 헤더에서 API 키 추출 (소켓 서버에서 보낸 경우)
    const headerApiKey = req.headers.get('x-api-key');
    
    // 헤더 API 키가 있으면 우선 사용, 없으면 환경 변수 사용
    const effectiveApiKey = headerApiKey || apiKey;
    
    // API 키 확인 - 강화된 검증
    if (!effectiveApiKey) {
      console.error("❌ OpenAI API key is not set (neither in headers nor in environment)");
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    // API 키 길이 확인
    if (effectiveApiKey.length < 20) {
      console.error("❌ OpenAI API key appears to be invalid (too short)");
      return NextResponse.json(
        { error: "OpenAI API key appears to be invalid" },
        { status: 500 }
      );
    }
    
    // API 키 출처 로깅
    console.log(`Using API key from: ${headerApiKey ? 'request header' : 'environment variable'}`);

    // 요청 데이터 파싱
    const { messages, roomId, topic, context, participants, npcDetails } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid or missing messages in request" },
        { status: 400 }
      );
    }
    
    // 참여하는 NPCs 확인
    const npcs = participants?.npcs || [];
    if (!npcs.length) {
      return NextResponse.json(
        { error: "No NPCs specified for the conversation" },
        { status: 400 }
      );
    }
    
    console.log(`Processing chat for topic: ${topic}`);
    console.log(`Participating NPCs: ${npcs.join(', ')}`);
    
    // NPC 상세 정보 로깅
    const hasNpcDetails = npcDetails && Array.isArray(npcDetails) && npcDetails.length > 0;
    console.log(`Using NPC details: ${hasNpcDetails ? 'Yes' : 'No'}`);
    if (hasNpcDetails) {
      console.log(`NPC details count: ${npcDetails.length}`);
    }
    
    // 최근 메시지만 사용 (대화 컨텍스트로)
    const recentMessages = messages.slice(-10);
    
    // 최신 사용자 메시지 가져오기 (저장하기 위함)
    const latestUserMessage = messages[messages.length - 1];
    
    // NPC 상세 정보 처리
    let npcDescriptions = '';
    if (hasNpcDetails) {
      // NPC 상세 정보 처리 (백엔드에 전달하기 위한 형식으로 변환)
      npcDescriptions = npcDetails.map((npc: NpcDetail) => {
        let description = `${npc.name}:`;
        
        if (npc.is_custom) {
          description += `\n  - Custom philosopher${npc.description ? `: ${npc.description}` : ''}`;
          if (npc.communication_style) description += `\n  - Communication style: ${npc.communication_style}`;
          if (npc.debate_approach) description += `\n  - Debate approach: ${npc.debate_approach}`;
          if (npc.voice_style) description += `\n  - Voice style: ${npc.voice_style}`;
          if (npc.reference_philosophers && npc.reference_philosophers.length > 0) {
            description += `\n  - Influenced by: ${npc.reference_philosophers.join(', ')}`;
          }
        } else {
          const profile = philosopherProfiles[npc.name];
          if (profile) {
            description += `\n  - ${profile.description}`;
            description += `\n  - Style: ${profile.style}`;
            description += `\n  - Key concepts: ${profile.key_concepts.join(', ')}`;
          }
        }
        
        return description;
      }).join('\n\n');
    }
    
    // 클라이언트 요청의 헤더에서 LLM 설정 정보 확인
    const llmProvider = req.headers.get('x-llm-provider') || 'openai';
    const llmModel = req.headers.get('x-llm-model') || '';
    
    console.log(`Using LLM Provider: ${llmProvider}`);
    
    // 대화 히스토리 형식 변환 (Python 백엔드에 전달하기 위한 형식)
    const previousDialogue = recentMessages.map(msg => {
      if (msg.isUser) {
        return `User: ${msg.text}`;
      } else if (msg.sender !== 'System') {
        return `${msg.sender}: ${msg.text}`;
      } else {
        return `System: ${msg.text}`;
      }
    }).join('\n');
    
    try {
      console.log('🔄 Calling Python backend (llm_manager) API...');
      
      // Python 백엔드 API 호출 (sapiens_engine)
      const backendResponse = await fetch(`${BACKEND_API_URL}/api/chat/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          npc_descriptions: hasNpcDetails ? npcDescriptions : null,
          npcs: npcs,
          topic: topic,
          context: context || "",
          previous_dialogue: previousDialogue,
          llm_provider: llmProvider,
          llm_model: llmModel || 'gpt-4o',
          api_key: effectiveApiKey
        }),
        cache: 'no-store'
      });

      // 응답 검증
      if (!backendResponse.ok) {
        const errorStatus = backendResponse.status;
        let errorText = '';
        try {
          const errorData = await backendResponse.json();
          errorText = errorData.error || errorData.message || '';
        } catch (e) {
          errorText = await backendResponse.text();
        }
        
        console.error(`❌ Python backend API error: Status ${errorStatus}`, errorText);
        throw new Error(`Python backend API request failed with status ${errorStatus}: ${errorText}`);
      }

      // 정상 응답 처리
      const backendData = await backendResponse.json();
      console.log('✅ Python backend API response received');
      
      const generatedText = backendData.response || backendData.text || backendData.message;
      let respondingPhilosopher = backendData.philosopher || backendData.sender || npcs[0];
      
      // 응답 검증
      if (!generatedText) {
        throw new Error('Invalid response format from Python backend API');
      }
      
      // 철학자가 참여자 목록에 있는지 확인
      if (!npcs.includes(respondingPhilosopher)) {
        console.warn(`Warning: Backend API returned non-participant philosopher: ${respondingPhilosopher}`);
        // 첫 번째 참여 철학자로 강제 변경
        respondingPhilosopher = npcs[0];
      }
      
      // 응답 형식 만들기
      const aiMessage = {
        id: `api-${Date.now()}`,
        text: generatedText,
        sender: respondingPhilosopher,
        isUser: false,
        timestamp: new Date()
      };
      
      // 사용자 메시지와 AI 응답 MongoDB에 저장
      if (roomId) {
        try {
          // 사용자 메시지 먼저 저장 (아직 저장되지 않았다면)
          if (latestUserMessage && latestUserMessage.isUser) {
            console.log(`💾 사용자 메시지 저장: ${latestUserMessage.text.substring(0, 30)}...`);
            await chatRoomDB.addMessage(roomId, latestUserMessage);
          }
          
          // AI 응답 저장
          console.log(`💾 AI 응답 저장: ${aiMessage.text.substring(0, 30)}...`);
          await chatRoomDB.addMessage(roomId, aiMessage);
          console.log('✅ 메시지가 MongoDB에 저장되었습니다.');
        } catch (dbError) {
          console.error('MongoDB 저장 오류:', dbError);
          // 저장 실패해도 메시지는 반환
        }
      } else {
        console.warn('메시지 저장 건너뜀: roomId가 제공되지 않음');
      }
      
      return NextResponse.json(aiMessage);
    } catch (error: any) {
      console.error('❌ Error in backend chat API:', error);
      
      // 자세한 오류 응답
      return NextResponse.json(
        { 
          error: error.message || 'Unknown error during API call',
          details: error.toString(),
          status: error.status || 500
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ Unexpected error in chat API:', error);
    
    // 일반 오류 응답
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.toString() },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

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
// Note: This may be used for future enhancements
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
// Note: Keeping this type definition for future use
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

    // 요청 데이터 파싱 - 새로운 형식으로 변경
    const data = await req.json();
    const { room_id, user_message, npcs, llm_provider: clientLlmProvider, llm_model: clientLlmModel } = data;
    
    // 이전 요청 형식과의 호환성 (messages, roomId, topic, context, participants)
    // 새 요청 형식 검증
    if (!room_id) {
      return NextResponse.json(
        { error: "Missing room_id in request" },
        { status: 400 }
      );
    }
    
    if (!user_message) {
      return NextResponse.json(
        { error: "Missing user_message in request" },
        { status: 400 }
      );
    }
    
    if (!npcs || !Array.isArray(npcs) || npcs.length === 0) {
      return NextResponse.json(
        { error: "No NPCs specified for the conversation" },
        { status: 400 }
      );
    }
    
    console.log(`Processing chat for room: ${room_id}`);
    console.log(`User message: ${user_message.substring(0, 30)}...`);
    console.log(`Participating NPCs: ${npcs.join(', ')}`);
    
    // 클라이언트 요청의 헤더에서 LLM 설정 정보 확인
    const llmProvider = req.headers.get('x-llm-provider') || clientLlmProvider || 'openai';
    const llmModel = req.headers.get('x-llm-model') || clientLlmModel || 'gpt-4o';
    
    console.log(`Using LLM Provider: ${llmProvider}, Model: ${llmModel}`);
    
    try {
      console.log('🔄 Calling Python backend (llm_manager) API with new format...');
      
      // Python 백엔드 API 호출 - 새로운 서버 측 대화 관리 방식 사용
      const backendResponse = await fetch(`${BACKEND_API_URL}/api/chat/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_id: room_id,
          user_message: user_message,
          npcs: npcs,
          llm_provider: llmProvider,
          llm_model: llmModel,
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
      
      // 응답 형식 확인 및 클라이언트에 맞게 변환
      const response = backendData.response || '';
      const philosopher = backendData.philosopher || '';
      
      if (!response || !philosopher) {
        throw new Error('Invalid response format from Python backend API');
      }
      
      // 메시지 형식으로 변환 (socket.ts에서 기대하는 형식)
      const messageId = `ai-${Date.now()}`;
      const messageObject = {
        id: messageId,
        text: response,
        sender: philosopher,
        senderType: "npc",
        isUser: false,
        timestamp: new Date().toISOString(),
        metadata: backendData.metadata || {}
      };
      
      return NextResponse.json(messageObject);
      
    } catch (error: Error | unknown) {
      console.error('❌ Failed to send message:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
  } catch (error: Error | unknown) {
    console.error('❌ Error in POST /api/chat:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
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

// Initialize OpenAI client - 헤더로 전달된 API 키를 사용할 수 있도록 수정
// 대신 effectiveApiKey가 설정된 후에 클라이언트를 생성하는 방식으로 변경
let openai: OpenAI;

// OpenAI 클라이언트 초기화 함수 - 유효한 API 키를 인자로 받음
function initializeOpenAIClient(apiKeyToUse: string) {
  return new OpenAI({
    apiKey: apiKeyToUse,
  });
}

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

// Fetch a response from Ollama API
async function fetchOllamaResponse(messages: any[], model: string, ollamaEndpoint: string = 'http://localhost:11434') {
  console.log(`💬 Calling Ollama API with model: ${model}`);
  console.log(`💬 Message count:`, messages.length);
  console.log(`💬 Using Ollama endpoint: ${ollamaEndpoint}`);
  
  try {
    const response = await fetch(`${ollamaEndpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Ollama API response received');
    
    // 원본 응답 로깅은 유지하되, 반환 값은 콘텐츠만 반환
    const content = data.message?.content || '';
    return content;
  } catch (error) {
    console.error('❌ Error in Ollama API call:', error);
    throw error;
  }
}

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
    const { messages, roomId, topic, context, participants } = await req.json();
    
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
    
    // 최근 메시지만 사용
    const recentMessages = messages.slice(-10);
    
    // 최신 사용자 메시지 가져오기 (저장하기 위함)
    const latestUserMessage = messages[messages.length - 1];
    
    // LLM 공통 시스템 프롬프트
    const systemPrompt = `You are an AI that simulates a philosophical conversation between the user and the following philosophers: ${npcs.join(', ')}. 
                 The topic of discussion is: "${topic}".
                 ${context ? `Additional context: ${context}` : ''}
                 
                 Guidelines:
                 1. Respond as one of the philosophers in the list: ${npcs.join(', ')}
                 2. Choose which philosopher would most appropriately respond to the user's message
                 3. Stay true to each philosopher's ideas, writing style, and historical context
                 4. Begin your response by indicating which philosopher is speaking
                 5. Make your response substantive but concise (200 words maximum)
                 6. IMPORTANT: If the user's message is in Korean, respond in Korean
                 7. Match the language of your response to the language used by the user
                 
                 VERY IMPORTANT: Format your response as valid JSON with this exact structure:
                 {"sender": "Philosopher Name", "text": "The philosophical response..."}`;
                 
    // 클라이언트 요청의 헤더에서 LLM 설정 정보 확인
    const llmProvider = req.headers.get('x-llm-provider') || 'openai';
    const llmModel = req.headers.get('x-llm-model') || '';
    const ollamaEndpoint = req.headers.get('x-ollama-endpoint') || 'http://localhost:11434';
    
    console.log(`Using LLM Provider: ${llmProvider}`);
    
    // Ollama API 사용
    if (llmProvider === 'ollama') {
      try {
        // Ollama에서 사용할 모델
        const ollamaModel = llmModel || 'llama3';
        console.log(`Using Ollama model: ${ollamaModel}`);
        
        // Ollama API 형식으로 메시지 변환
        const ollamaMessages = [
          { role: 'system', content: systemPrompt }
        ];
        
        // 대화 히스토리 추가
        recentMessages.forEach(msg => {
          if (msg.isUser) {
            ollamaMessages.push({
              role: 'user',
              content: msg.text
            });
          } else if (msg.sender !== 'System') {
            ollamaMessages.push({
              role: 'assistant',
              content: `{"sender": "${msg.sender}", "text": "${msg.text.replace(/"/g, '\\"')}"}`
            });
          }
        });
        
        // Ollama API 호출
        const responseContent = await fetchOllamaResponse(ollamaMessages, ollamaModel, ollamaEndpoint);
        console.log('Raw API response:', responseContent);
        
        // 응답 파싱 및 처리
        let parsedResponse;
        try {
          // JSON 형식으로 응답이 왔는지 확인
          if (responseContent.trim().startsWith('{') && responseContent.trim().endsWith('}')) {
            parsedResponse = JSON.parse(responseContent);
          } else {
            // JSON이 아닌 경우, 첫 번째 NPC의 응답으로 간주
            parsedResponse = {
              sender: npcs[0],
              text: responseContent
            };
          }
        } catch (error) {
          console.error('Error parsing JSON from Ollama response:', error);
          // JSON 파싱 실패 시 텍스트에서 필요한 부분 추출 시도
          const sender = responseContent.match(/["']sender["']\s*:\s*["']([^"']+)["']/)?.[1] || npcs[0];
          const text = responseContent.match(/["']text["']\s*:\s*["']([^"']+)["']/)?.[1] || responseContent;
          
          parsedResponse = {
            sender: sender,
            text: text
          };
        }
        
        // 응답 검증
        if (!parsedResponse.sender || !parsedResponse.text) {
          throw new Error('Invalid response format from Ollama API');
        }
        
        // 참여 NPC인지 확인
        if (!npcs.includes(parsedResponse.sender)) {
          console.warn(`Warning: Ollama API returned non-participant NPC: ${parsedResponse.sender}`);
          parsedResponse.sender = npcs[0];
        }
        
        // text 필드가 JSON 문자열이 아닌지 확인
        try {
          if (typeof parsedResponse.text === 'string' && 
              parsedResponse.text.trim().startsWith('{') && 
              parsedResponse.text.trim().endsWith('}')) {
            // text 필드 안에 JSON이 있는 경우 (중첩 JSON)
            const innerJson = JSON.parse(parsedResponse.text);
            if (innerJson.text) {
              parsedResponse.text = innerJson.text;
            }
          }
        } catch (e) {
          // JSON 파싱 실패해도 원래 텍스트 유지
        }
        
        // 응답 형식 만들기
        const aiMessage = {
          id: `api-${Date.now()}`,
          text: parsedResponse.text,
          sender: parsedResponse.sender,
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
        console.error('❌ Error in Ollama chat API:', error);
        
        // 오류 발생 시 OpenAI로 폴백
        console.log('⚠️ Falling back to OpenAI API due to Ollama error');
        // 폴백 처리는 아래 OpenAI 코드를 계속 실행
      }
    }
    
    // OpenAI API 사용 (기본값 또는 폴백)
    // OpenAI에서 사용할 모델
    const openaiModel = llmModel || 'gpt-4o';
    
    // OpenAI API 형식으로 메시지 변환
    const formattedMessages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];
    
    // 대화 히스토리 추가
    recentMessages.forEach(msg => {
      if (msg.isUser) {
        formattedMessages.push({
          role: 'user',
          content: msg.text
        });
      } else if (msg.sender !== 'System') {
        formattedMessages.push({
          role: 'assistant',
          content: `{"sender": "${msg.sender}", "text": "${msg.text.replace(/"/g, '\\"')}"}`
        });
      }
    });
    
    try {
      // OpenAI API 호출 전 디버깅 정보
      console.log(`💬 Calling OpenAI API with model: ${openaiModel}`);
      console.log('💬 Message count:', formattedMessages.length);
      
      // 유효한 API 키로 OpenAI 클라이언트 초기화
      const openai = initializeOpenAIClient(effectiveApiKey);

      // OpenAI API 호출
      const response = await openai.chat.completions.create({
        model: openaiModel,
        messages: formattedMessages,
        temperature: 0.75,
        max_tokens: 800,
        frequency_penalty: 0.2,
        presence_penalty: 0.5,
      });
      
      // 응답 로깅
      console.log('✅ API response received');
      
      // 응답 파싱
      const responseContent = response.choices[0]?.message?.content || '';
      console.log('Raw API response:', responseContent);
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (error) {
        console.error('Error parsing JSON from API response:', error);
        // JSON 파싱 실패 시 텍스트에서 필요한 부분 추출 시도
        const sender = responseContent.match(/["']sender["']\s*:\s*["']([^"']+)["']/)?.[1] || npcs[0];
        const text = responseContent.match(/["']text["']\s*:\s*["']([^"']+)["']/)?.[1] || responseContent;
        
        parsedResponse = {
          sender: sender,
          text: text
        };
      }
      
      // 응답 검증
      if (!parsedResponse.sender || !parsedResponse.text) {
        throw new Error('Invalid response format from API');
      }
      
      // 참여 NPC인지 확인
      if (!npcs.includes(parsedResponse.sender)) {
        console.warn(`Warning: API returned non-participant NPC: ${parsedResponse.sender}`);
        parsedResponse.sender = npcs[0];
      }
      
      // 응답 형식 만들기
      const aiMessage = {
        id: `api-${Date.now()}`,
        text: parsedResponse.text,
        sender: parsedResponse.sender,
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
      console.error('❌ Error in chat API:', error);
      // 에러 상세 정보
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
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
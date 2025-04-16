import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { cookies } from 'next/headers';

// API Key 로깅 (디버깅용, 실제 코드에서는 전체 키 출력하지 않는 것이 안전)
const apiKey = process.env.OPENAI_API_KEY || '';
console.log('API Key check:', apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : 'MISSING');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: apiKey,
});

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
    // API 키 확인 - 강화된 검증
    if (!apiKey) {
      console.error("❌ OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    // API 키 길이 확인
    if (apiKey.length < 20) {
      console.error("❌ OPENAI_API_KEY appears to be invalid (too short)");
      return NextResponse.json(
        { error: "OpenAI API key appears to be invalid" },
        { status: 500 }
      );
    }

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
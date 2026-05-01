import { NextRequest, NextResponse } from 'next/server';
import { resolvePhilosopher } from '@/lib/data/philosophers';
import { loggers } from '@/utils/logger';
import { apiUrl, ENDPOINTS } from '@/lib/api/endpoints';
import { DEFAULT_LLM_MODEL } from '@/lib/ai/llmDefaults';

interface NpcData {
  name: string;
  description?: string;
  communication_style?: string;
  debate_approach?: string;
  voice_style?: string;
  reference_philosophers?: string[];
  id?: string;
}

function detectLanguage(text: string): string {
  // ( : AC00-D7A3, 1100-11FF)
  const koreanRegex = /[\uAC00-\uD7A3\u1100-\u11FF]/;
  if (koreanRegex.test(text)) return 'Korean';
  
  // (, : 3040-309F, 30A0-30FF)
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
  if (japaneseRegex.test(text)) return 'Japanese';
  
  // ( : 4E00-9FFF)
  const chineseRegex = /[\u4E00-\u9FFF]/;
  if (chineseRegex.test(text)) return 'Chinese';
  
  return 'English';
}

function removeNamePrefix(text: string): string {
  // "Name: " (: : )
  const prefixRegex = /^[A-Za-z\s]+[:：]\s*/;
  return text.replace(prefixRegex, '');
}

function prepareNpcDescription(philosopher: string, npcData: NpcData | null, isCustomNpc: boolean, language: string): string {
  let description;
  
  if (isCustomNpc && npcData) {
    description = `Name: ${npcData.name}
Role: Custom Philosopher
Voice Style: ${npcData.voice_style || 'conversational'}
Communication Style: ${npcData.communication_style || 'balanced'}
Debate Approach: ${npcData.debate_approach || 'dialectical'}
${npcData.description ? `Description: ${npcData.description}` : ''}
${npcData.reference_philosophers && npcData.reference_philosophers.length > 0 ? 
  `Influenced by: ${npcData.reference_philosophers.join(', ')}` : ''}`;
  } else {
    const profile = resolvePhilosopher(philosopher);
    if (!profile) {
      loggers.chat.error(`❌ Philosopher profile not found for: ${philosopher}`);
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
Philosophical Background: ${profile.keyConcepts ? profile.keyConcepts.join(', ') : 'philosophy'}`;
    }
  }
  
  const languageInstruction = `IMPORTANT: Respond in ${language} language to match the topic language.
DO NOT include your name as a prefix in your response.
DO NOT start with "${philosopher}: " or any other name prefix.
Just provide your philosophical response directly.`;
  
  return `${description}\n${languageInstruction}`;
}

function generateFallbackResponse(topic: string, dialogueType?: string): NextResponse {
  // Debate fallback
  if (dialogueType === 'debate') {
    loggers.chat.info('Skipping fallback response in debate type');
    return NextResponse.json({ text: '' });
  }
  
  const topicLanguage = detectLanguage(topic);
  
  const fallbackResponses: Record<string, string[]> = {
    'English': [
      `I find this topic of "${topic}" quite fascinating. What aspects of it interest you the most?`,
      `Let's explore "${topic}" together. What questions come to mind when you consider this subject?`,
      `The question of "${topic}" has intrigued philosophers  centuries. Where shall we begin our inquiry?`
    ],
    'Korean': [
      `"${topic}" is a very interesting topic. Which aspect interests you most?`,
      `Together "${topic}"let's explore. What questions come to mind on this topic?`,
      `"${topic}" has fascinated philosophers  centuries. Where should we begin?`
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
  
  const languageResponses = fallbackResponses[topicLanguage] || fallbackResponses['English'];
  
  const randomResponse = languageResponses[Math.floor(Math.random() * languageResponses.length)];
  loggers.chat.info(`⚠️ Using fallback response due to backend error`);
  return NextResponse.json({ text: randomResponse });
}

export async function POST(req: NextRequest) {
  try {
    const { philosopher, topic, context, npcData } = await req.json();

    loggers.chat.info(`💬 Generating initial message  ${philosopher} on topic: ${topic}`);
    
    // LLM
    const llmProvider = req.headers.get('x-llm-provider') || 'openai';
    const llmModel = req.headers.get('x-llm-model') || '';

    const topicLanguage = detectLanguage(topic);
    loggers.chat.info(`Detected language: ${topicLanguage}`);

    const isCustomNpc = npcData && Object.keys(npcData).length > 0;
    loggers.chat.info(`Using ${isCustomNpc ? 'custom' : 'default'} NPC data`);

    const npcDescription = prepareNpcDescription(philosopher, npcData, isCustomNpc, topicLanguage);
    
    // API ( )
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let backendData;
    
    while (retryCount < MAX_RETRIES) {
      try {
        loggers.chat.info(`🔄 Calling backend API (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        const backendResponse = await fetch(apiUrl(ENDPOINTS.chat.generate), {
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
            llm_model: llmModel || DEFAULT_LLM_MODEL
          }),
          cache: 'no-store'
        });

        if (!backendResponse.ok) {
          throw new Error(`Backend API error: ${backendResponse.status}`);
        }

        backendData = await backendResponse.json();
        break;
      } catch (error) {
        retryCount++;
        loggers.chat.error(`Backend API error (attempt ${retryCount}/${MAX_RETRIES}):`, error);
        
        if (retryCount >= MAX_RETRIES) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
      }
    }
    
    let generatedText = backendData.response || backendData.text || backendData.message;
    generatedText = removeNamePrefix(generatedText);
    
    return NextResponse.json({ text: generatedText });
  } catch (error: unknown) {
    loggers.chat.error('Error in POST /api/chat/initial:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
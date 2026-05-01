import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { loggers } from '@/utils/logger';
import { apiUrl, ENDPOINTS } from '@/lib/api/endpoints';
import { DEFAULT_LLM_MODEL } from '@/lib/ai/llmDefaults';

// .env.local API
function loadEnvLocal() {
  try {
    const rootDir = process.cwd();
    const envPath = path.join(rootDir, '.env.local');
    
    // .env.local
    if (fs.existsSync(envPath)) {
      loggers.chat.info('.env.local file found.');
      const fileContent = fs.readFileSync(envPath, 'utf-8');
      const vars = fileContent.split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('='))
        .reduce((acc, [key, value]) => {
          if (key && value) {
            acc[key.trim()] = value.trim();
          }
          return acc;
        }, {} as Record<string, string>);
      
      loggers.chat.info('Configuration loaded from .env.local.');
      return vars;
    } else {
      loggers.chat.error('.env.local file not found.');
      return {};
    }
  } catch (error) {
    loggers.chat.error('Error loading .env.local file:', error);
    return {};
  }
}

// .env.local
const envVars = loadEnvLocal();

// API Key - .env.local
const apiKey = envVars.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
loggers.chat.info('API Key source:', apiKey === envVars.OPENAI_API_KEY ? '.env.local file' : 'system environment variable');
loggers.chat.info('API Key check:', apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : 'MISSING');

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

export async function POST(req: NextRequest) {
  try {
    // API ( )
    const headerApiKey = req.headers.get('x-api-key');
    
    const effectiveApiKey = headerApiKey || apiKey;
    
    // API -
    if (!effectiveApiKey) {
      loggers.chat.error("❌ OpenAI API key is not set (neither in headers nor in environment)");
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    if (effectiveApiKey.length < 20) {
      loggers.chat.error("❌ OpenAI API key appears to be invalid (too short)");
      return NextResponse.json(
        { error: "OpenAI API key appears to be invalid" },
        { status: 500 }
      );
    }
    
    loggers.chat.info(`Using API key from: ${headerApiKey ? 'request header' : 'environment variable'}`);

    const data = await req.json();
    const { room_id, user_message, npcs, llm_provider: clientLlmProvider, llm_model: clientLlmModel } = data;
    
    // (messages, roomId, topic, context, participants)
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
    
    loggers.chat.info(`Processing chat for room: ${room_id}`);
    loggers.chat.info(`User message: ${user_message.substring(0, 30)}...`);
    loggers.chat.info(`Participating NPCs: ${npcs.join(', ')}`);
    
    // LLM
    const llmProvider = req.headers.get('x-llm-provider') || clientLlmProvider || 'openai';
    const llmModel = req.headers.get('x-llm-model') || clientLlmModel || DEFAULT_LLM_MODEL;
    
    loggers.chat.info(`Using LLM Provider: ${llmProvider}, Model: ${llmModel}`);
    
    try {
      loggers.chat.info('🔄 Calling Python backend (llm_manager) API with new format...');
      
      // Python API -
      const backendResponse = await fetch(apiUrl(ENDPOINTS.chat.generate), {
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

      if (!backendResponse.ok) {
        const errorStatus = backendResponse.status;
        let errorText = '';
        try {
          const errorData = await backendResponse.json();
          errorText = errorData.error || errorData.message || '';
        } catch (e) {
          errorText = await backendResponse.text();
        }
        
        loggers.chat.error(`❌ Python backend API error: Status ${errorStatus}`, errorText);
        throw new Error(`Python backend API request failed with status ${errorStatus}: ${errorText}`);
      }

      const backendData = await backendResponse.json();
      loggers.chat.info('✅ Python backend API response received');
      
      const response = backendData.response || '';
      const philosopher = backendData.philosopher || '';
      
      if (!response || !philosopher) {
        throw new Error('Invalid response format from Python backend API');
      }
      
      // (socket.ts )
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
      loggers.chat.error('❌ Failed to send message:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
  } catch (error: Error | unknown) {
    loggers.chat.error('❌ Error in POST /api/chat:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
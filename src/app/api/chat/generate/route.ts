import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api/baseUrl';
import { loggers } from '@/utils/logger';

interface ChatGenerateBody {
  npcs?: string[];
  npc_descriptions?: Record<string, string>;
  topic?: string;
  context?: string;
  previous_dialogue?: unknown;
  user_message?: string;
  room_id?: string | number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatGenerateBody;
    const { user_message } = body;

    if (!user_message) {
      return NextResponse.json({ error: 'Missing required field: user_message' }, { status: 400 });
    }

    let room_id = body.room_id;
    if (!room_id) {
      const referer = request.headers.get('referer') || '';
      const match = referer.match(/\/chat\?id=([^&]+)/);
      room_id = match ? match[1] : '';
      if (!room_id) {
        return NextResponse.json({ error: 'Missing required field: room_id' }, { status: 400 });
      }
    }
    room_id = String(room_id);

    const response = await fetch(`${API_BASE_URL}/api/chat/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, room_id, user_message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      loggers.chat.error(`API error (${response.status}): ${errorText}`);
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    loggers.chat.error('Error in chat/generate API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate chat response',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { apiUrl, ENDPOINTS } from '@/lib/api/endpoints';
import { loggers } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ roomId: string; action: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { roomId, action } = await params;
  if (!roomId || !action) {
    return NextResponse.json({ error: 'Room ID and action are required' }, { status: 400 });
  }

  try {
    const response = await fetch(apiUrl(ENDPOINTS.dialogue.action(roomId, action)));
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    loggers.chat.error(`Error in GET dialogue/${roomId}/${action}:`, error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { roomId, action } = await params;
  if (!roomId || !action) {
    return NextResponse.json({ error: 'Room ID and action are required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const response = await fetch(apiUrl(ENDPOINTS.dialogue.action(roomId, action)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    loggers.chat.error(`Error in POST dialogue/${roomId}/${action}:`, error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

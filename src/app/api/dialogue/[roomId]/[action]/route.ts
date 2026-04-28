import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api/baseUrl';

interface RouteContext {
  params: Promise<{ roomId: string; action: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { roomId, action } = await params;
  if (!roomId || !action) {
    return NextResponse.json({ error: 'Room ID and action are required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/dialogue/${roomId}/${action}`);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error(`Error in GET dialogue/${roomId}/${action}:`, error);
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
    const response = await fetch(`${API_BASE_URL}/api/dialogue/${roomId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error(`Error in POST dialogue/${roomId}/${action}:`, error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

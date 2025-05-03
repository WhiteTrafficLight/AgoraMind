import { NextRequest, NextResponse } from 'next/server';

// Simple API health check endpoint
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'API server is running'
  });
} 
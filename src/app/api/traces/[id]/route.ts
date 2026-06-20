/**
 * GET /api/traces/[id]?philosopher=nietzsche
 *
 * Returns one full reasoning trace by file stem. The id is validated against a
 * strict pattern to prevent path traversal.
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const SAFE_PHILO = /^[a-z0-9_-]+$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const philosopher = (searchParams.get('philosopher') || 'nietzsche').trim();

  if (!SAFE_ID.test(id) || !SAFE_PHILO.test(philosopher)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const file = path.resolve(process.cwd(), '..', 'rag_data', philosopher, 'traces', `${id}.json`);

  try {
    const data = JSON.parse(await fs.readFile(file, 'utf-8'));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'trace not found' }, { status: 404 });
  }
}

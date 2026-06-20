/**
 * GET /api/traces?philosopher=nietzsche
 *
 * Lists reasoning-trace runs (latest first). Reads from MongoDB first
 * (production); falls back to the sibling pipeline repo's local
 * `rag_data/<philosopher>/traces/` in dev.
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { listTraceSummariesFromDB } from '@/lib/db/criticalLensTraceDB';

interface Summary {
  id: string;
  ts: string;
  verdict: string;
  cost: number;
  stimulus: string;
}

function tracesDir(philosopher: string): string {
  // In `next dev` cwd is the AgoraMind root; traces live one level up.
  return path.resolve(process.cwd(), '..', 'rag_data', philosopher, 'traces');
}

const SAFE_PHILO = /^[a-z0-9_-]+$/i;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const philosopher = (searchParams.get('philosopher') || 'nietzsche').trim();
  if (!SAFE_PHILO.test(philosopher)) {
    return NextResponse.json({ error: 'invalid philosopher' }, { status: 400 });
  }

  // DB first (production). Fall back to the local filesystem in dev.
  const fromDb = await listTraceSummariesFromDB(philosopher);
  if (fromDb && fromDb.length) {
    return NextResponse.json({ traces: fromDb });
  }

  const dir = tracesDir(philosopher);
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return NextResponse.json({ traces: [] });
  }

  const rows: Array<{ summary: Summary; mtime: number }> = [];
  for (const file of files) {
    const full = path.join(dir, file);
    try {
      const stat = await fs.stat(full);
      const data = JSON.parse(await fs.readFile(full, 'utf-8'));
      const verdict = data?.moves?.move_3?.output_json?.verdict ?? '—';
      rows.push({
        mtime: stat.mtimeMs,
        summary: {
          id: file.replace(/\.json$/, ''),
          ts: data?.start_iso ?? file.split('_')[0] ?? '',
          verdict: String(verdict),
          cost: Number(data?.totals?.cost_usd ?? 0),
          stimulus: String(data?.stimulus ?? '').slice(0, 140),
        },
      });
    } catch {
      // skip unreadable/partial trace
    }
  }

  rows.sort((a, b) => b.mtime - a.mtime);
  return NextResponse.json({ traces: rows.map((r) => r.summary) });
}

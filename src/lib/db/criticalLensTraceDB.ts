/**
 * Critical Lens trace persistence (MongoDB).
 *
 * Production reads traces from the database (the pipeline's local rag_data
 * filesystem does not exist on Vercel). Each function returns null on any DB
 * error so the API can fall back to the local filesystem in dev.
 */
import connectDB from '@/lib/mongodb';
import CriticalLensTrace from '@/models/CriticalLensTrace';

export interface TraceSummaryRow {
  id: string;
  ts: string;
  verdict: string;
  cost: number;
  stimulus: string;
}

export async function listTraceSummariesFromDB(
  philosopher: string,
): Promise<TraceSummaryRow[] | null> {
  try {
    await connectDB();
    const docs = await CriticalLensTrace.find({ philosopher })
      .sort({ ts: -1 })
      .select('traceId ts verdict cost stimulus')
      .lean();
    return docs.map((d) => ({
      id: d.traceId,
      ts: d.ts ?? '',
      verdict: d.verdict ?? '—',
      cost: Number(d.cost ?? 0),
      stimulus: d.stimulus ?? '',
    }));
  } catch {
    return null;
  }
}

export async function getTraceFromDB(philosopher: string, id: string): Promise<unknown | null> {
  try {
    await connectDB();
    const doc = await CriticalLensTrace.findOne({ philosopher, traceId: id }).select('data').lean();
    return doc ? (doc as { data: unknown }).data : null;
  } catch {
    return null;
  }
}

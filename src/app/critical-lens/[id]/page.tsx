'use client';

/**
 * Critical Lens — a topic's flow chart for a chosen philosopher lens.
 *
 * Philosopher buttons sit at the top (only Nietzsche is implemented today).
 * Below, the pipeline run for this topic is rendered as a flow chart.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PipelineFlow from '@/components/critical-lens/PipelineFlow';
import PhilosopherBar from '@/components/critical-lens/PhilosopherBar';
import { TraceData } from '@/lib/criticalLens/trace';
import { getLensInfo } from '@/lib/criticalLens/lenses';

const ACTIVE_PHILOSOPHER = 'nietzsche';

export default function CriticalLensFlowPage() {
  const params = useParams<{ id: string }>();
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/traces/${id}?philosopher=nietzsche`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        if (!cancelled) setTrace(data);
      } catch {
        if (!cancelled) {
          setError('Failed to load this run.');
          setTrace(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const lens = getLensInfo(ACTIVE_PHILOSOPHER);

  return (
    <div className="min-h-full bg-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link href="/critical-lens" className="text-sm text-gray-500 hover:text-gray-900">
          ← All topics
        </Link>

        <PhilosopherBar active={ACTIVE_PHILOSOPHER} />

        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">{lens.fullName}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{lens.blurb}</p>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading run…</p>}
        {error && !loading && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </p>
        )}
        {trace && !loading && <PipelineFlow trace={trace} />}
      </div>
    </div>
  );
}

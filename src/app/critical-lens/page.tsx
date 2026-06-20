'use client';

/**
 * Critical Lens — topic selection.
 *
 * Lists the topics that have been read (one per pipeline run). Selecting a
 * topic navigates to its flow chart at /critical-lens/[id].
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TraceSummary } from '@/lib/criticalLens/trace';

export default function CriticalLensPage() {
  const [topics, setTopics] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/traces?philosopher=nietzsche');
        const data = await res.json();
        const list: TraceSummary[] = data.traces || [];
        setTopics(list);
        if (!list.length) setError('No topics yet — run the pipeline to produce one.');
      } catch {
        setError('Failed to load topics.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-full bg-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Critical Lens</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pick a topic to see how the philosopher reasons about it — move by move, from the raw text
          to a final critical reading.
        </p>

        {loading && <p className="mt-6 text-sm text-gray-500">Loading topics…</p>}
        {error && !loading && (
          <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {topics.map((t) => (
            <Link
              key={t.id}
              href={`/critical-lens/${t.id}`}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-900 hover:shadow"
            >
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{t.ts?.slice(0, 10)}</span>
                <span className="rounded-full bg-gray-900 px-2 py-0.5 font-medium text-white">
                  {t.verdict}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-800">
                {t.stimulus}
              </p>
              <span className="mt-3 text-xs font-medium text-gray-500 group-hover:text-gray-900">
                View reasoning →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * Critical Lens — philosopher selector bar (debate-modal style).
 *
 * Shows every philosopher as a button at the top of a topic's flow chart.
 * Only Nietzsche is implemented today, so it is the only selectable lens;
 * the rest are disabled ("soon"). Once other philosophers ship, selecting one
 * will swap to that philosopher's flow chart for the same topic.
 */

import React from 'react';
import { PHILOSOPHERS, getPhilosopherPortraitPath } from '@/lib/data/philosophers';

const ENABLED = new Set<string>(['nietzsche']);

export default function PhilosopherBar({ active }: { active: string }) {
  const all = Object.values(PHILOSOPHERS);
  // Enabled lens(es) first, then the locked ones.
  const ordered = [
    ...all.filter((p) => ENABLED.has(p.id)),
    ...all.filter((p) => !ENABLED.has(p.id)),
  ];

  return (
    <div className="mb-5">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Philosopher lens
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ordered.map((p) => {
          const enabled = ENABLED.has(p.id);
          const isActive = enabled && p.id === active;
          return (
            <div
              key={p.id}
              aria-disabled={!enabled}
              className={`relative flex shrink-0 select-none items-center gap-2 rounded-lg border px-3 py-2 transition ${
                isActive
                  ? 'border-black bg-gray-900 text-white ring-2 ring-black'
                  : enabled
                    ? 'cursor-pointer border-gray-300 bg-white text-gray-800 hover:shadow-sm'
                    : 'cursor-not-allowed border-gray-200 bg-white text-gray-400 opacity-60 grayscale'
              }`}
            >
              <img
                src={getPhilosopherPortraitPath(p.name)}
                alt={p.name}
                className="h-7 w-7 rounded-full object-cover ring-1 ring-gray-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&size=28`;
                }}
              />
              <span className="whitespace-nowrap text-sm font-medium">{p.name}</span>
              {!enabled && (
                <span className="ml-0.5 rounded bg-gray-100 px-1 text-[10px] font-medium uppercase text-gray-400">
                  soon
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

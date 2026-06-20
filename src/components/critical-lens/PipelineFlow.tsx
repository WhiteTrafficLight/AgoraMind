'use client';

/**
 * Critical Lens — pipeline flow chart (user-facing).
 *
 * Renders one reasoning run as a vertical flow: stimulus → Move #0 … Move #4
 * → final reading. Each move is a block with its name and a compact
 * explanation; its outputs hang off it as collapsible branches, each with a
 * tooltip explaining what that piece of the reasoning means. (The raw
 * prompts / costs / retrieval live in the Streamlit trace inspector.)
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowDown, Info } from 'lucide-react';
import {
  TraceData,
  MoveEntry,
  MoveKey,
  MOVE_ORDER,
  MOVE_META,
  HANDOFFS,
} from '@/lib/criticalLens/trace';

// Unified monochrome: every move block is a black-bordered white card.
const MOVE_CARD = 'border-gray-900 bg-white';
const MOVE_DOT = 'bg-gray-900';

/** Per-move output fields shown as branches: friendly label + tooltip. Order matters. */
const FIELD_META: Record<MoveKey, Record<string, { label: string; tip: string }>> = {
  move_0: {
    vitality_register: {
      label: 'Vitality register',
      tip: 'The kind of bodily state the text seems to speak from — healthy and affirmative, or reactive and exhausted.',
    },
    embodied_frame: {
      label: 'Embodied frame',
      tip: 'A one-sentence bodily framing that sets the posture for the analysis that follows.',
    },
    rationale: { label: 'Why this frame', tip: 'How the bodily diagnosis led to that framing.' },
  },
  move_1: {
    target_concept: {
      label: 'Load-bearing concept',
      tip: 'The single idea the text leans on most — the one whose removal would change what the other words are doing.',
    },
    functional_hypothesis: {
      label: 'What it does',
      tip: 'What that concept actively does here, stated as a function rather than a dictionary definition.',
    },
    beneficiary: {
      label: 'Whose interest it serves',
      tip: 'The specific position or group whose interest the concept quietly serves.',
    },
    destabilizes_when_removed: {
      label: 'If you removed it',
      tip: 'The structural problem that reasserts itself if the concept were taken away.',
    },
    self_effacing_score: {
      label: 'Self-effacing score (0–10)',
      tip: 'How much the concept hides what it does. Higher = stating its real function plainly meets more resistance.',
    },
  },
  move_2: {
    bracketed_present_meaning: {
      label: 'Held in suspension',
      tip: 'The present-day meaning set aside on purpose, so the history can be traced without assuming today’s definition.',
    },
    proto_practice: {
      label: 'Original need it answered',
      tip: 'The basic human need, and the minimal practice, the concept may have first arisen to meet.',
    },
    etymology_trace: {
      label: 'Word origins',
      tip: 'Non-moral, practical roots of the word, grounded in cited sources.',
    },
    developmental_stages: {
      label: 'How it evolved',
      tip: 'The stages the practice passed through — one founding stage, with later uses layered on top, not replacing it.',
    },
    repurposing_inventory: {
      label: 'Repurposings',
      tip: 'The distinct uses the concept has been put to across history.',
    },
    current_function_distance: {
      label: 'Drift from origin (0–10)',
      tip: 'How far today’s meaning has travelled from where it began. Higher = the present can even negate the origin.',
    },
    nietzsche_precedent: {
      label: 'Nietzsche precedent',
      tip: 'Whether Nietzsche himself analyzed this concept, with the matching passages.',
    },
  },
  move_3: {
    verdict: {
      label: 'Verdict',
      tip: 'What the history does to the concept: Vindicatory (trust it more), Non-Vindicatory (no change), or Subversive (trust it less).',
    },
    articulation: {
      label: 'In one line',
      tip: 'The verdict’s grounds made visible in a single sentence — exposure, not denunciation.',
    },
    hypertrophy_diagnosis: {
      label: 'Hypertrophy check',
      tip: 'Has the concept detached from its original function and become an end in itself?',
    },
    ressentiment_diagnosis: {
      label: 'Ressentiment check',
      tip: 'Is the concept the weak inverting their inability into a claim of moral superiority?',
    },
    decision_path: {
      label: 'How the verdict was reached',
      tip: 'The reasoning path from the findings to the verdict.',
    },
    boundary_case_note: {
      label: 'Close-call note',
      tip: 'Notes when the verdict sat on the boundary between two options.',
    },
    precedent_refs: {
      label: 'Sources',
      tip: 'Nietzsche passages cited, each marked as retrieved from the corpus or recalled by the model.',
    },
  },
  move_4: {
    verdict_speaker_position: {
      label: 'Whose voice the verdict used',
      tip: 'The position the verdict was implicitly spoken from — no claim comes from nowhere.',
    },
    perspective_inventory: {
      label: 'Other positions',
      tip: 'Different vantage points from which the concept looks different.',
    },
    multi_perspective_rewrite: {
      label: 'The verdict, re-voiced',
      tip: 'The same verdict rewritten from each position.',
    },
    primary_perspective: {
      label: 'Chosen lens',
      tip: 'The single position chosen to center the final reading on.',
    },
    rejected_perspectives: {
      label: 'Deliberately set aside',
      tip: 'Positions intentionally not centered, and the reason why.',
    },
  },
};

function humanize(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Tip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex shrink-0 align-middle">
      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
      <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-60 -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

function previewOf(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.length > 64 ? v.slice(0, 64) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `${v.length} item${v.length !== 1 ? 's' : ''}`;
  if (typeof v === 'object') {
    const n = Object.keys(v as object).length;
    return n ? `${n} field${n !== 1 ? 's' : ''}` : '';
  }
  return '';
}

function ValueView({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '')
    return <span className="text-gray-400">—</span>;
  if (typeof value === 'string')
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{value}</p>;
  if (typeof value === 'number' || typeof value === 'boolean')
    return <span className="text-sm text-gray-800">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-gray-400">—</span>;
    const allPrim = value.every(
      (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v),
    );
    if (allPrim)
      return (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-800">
          {value.map((v, i) => (
            <li key={i}>{String(v)}</li>
          ))}
        </ul>
      );
    return (
      <div className="flex flex-col gap-2">
        {value.map((v, i) => (
          <div key={i} className="rounded-md border border-gray-100 bg-gray-50 p-2">
            <ValueView value={v} />
          </div>
        ))}
      </div>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([k, v]) => (
        <div key={k}>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {humanize(k)}
          </span>
          <div className="text-gray-800">
            <ValueView value={v} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Branch({
  label,
  tip,
  value,
  defaultOpen,
}: {
  label: string;
  tip: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const preview = previewOf(value);
  return (
    <div className="border-l-2 border-gray-200 pl-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 py-1.5 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        )}
        <span className="shrink-0 text-sm font-medium text-gray-800">{label}</span>
        <Tip text={tip} />
        {!open && preview && (
          <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{preview}</span>
        )}
      </button>
      {open && (
        <div className="pb-2 pl-5">
          <ValueView value={value} />
        </div>
      )}
    </div>
  );
}

function MoveBlock({
  mkey,
  entry,
  skipReason,
}: {
  mkey: MoveKey;
  entry: MoveEntry | null;
  skipReason?: string;
}) {
  const meta = MOVE_META[mkey];
  const ran = entry !== null;
  const out = (entry?.output_json ?? {}) as Record<string, unknown>;
  const fields = FIELD_META[mkey];
  const branchKeys = Object.keys(fields).filter((f) => {
    const v = out[f];
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  return (
    <div
      className={`w-full rounded-xl border-2 ${ran ? MOVE_CARD : 'border-dashed border-gray-300 bg-gray-50'} p-4 shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${ran ? MOVE_DOT : 'bg-gray-300'}`}
        >
          {meta.num}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{meta.name}</h3>
            {!ran && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                {mkey === 'move_0' ? 'not activated' : 'not run'}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{meta.tagline}</p>
        </div>
      </div>

      {!ran && (
        <p className="mt-3 pl-11 text-sm text-gray-500">
          {skipReason ||
            (mkey === 'move_0'
              ? 'The classifier judged no embodied framing was warranted for this text.'
              : 'This move did not run.')}
        </p>
      )}

      {ran && branchKeys.length > 0 && (
        <div className="mt-3 flex flex-col">
          {branchKeys.map((f, i) => (
            <Branch
              key={f}
              label={fields[f].label}
              tip={fields[f].tip}
              value={out[f]}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Connector({ fromKey, skipped }: { fromKey: MoveKey; skipped: boolean }) {
  const h = HANDOFFS[fromKey];
  if (!h) return null;
  return (
    <div className="flex flex-col items-center py-1">
      <div className="h-4 w-0.5 bg-gray-300" />
      <div
        className={`flex max-w-2xl flex-wrap items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs ${skipped ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-gray-200 bg-white text-gray-600'}`}
      >
        <span className="font-medium text-gray-400">passes</span>
        <Tip text="What this move hands to the next move" />
        {skipped ? (
          <span className="italic">nothing — Move #0 not activated</span>
        ) : (
          h.fields.map((f) => (
            <span key={f} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">
              {humanize(f)}
            </span>
          ))
        )}
      </div>
      <ArrowDown className="h-4 w-4 text-gray-400" />
    </div>
  );
}

export default function PipelineFlow({ trace }: { trace: TraceData }) {
  const skip = trace.skipped_moves || {};
  const move0Skipped = (trace.moves || {})['move_0'] == null;

  return (
    <div className="flex flex-col items-stretch">
      {/* Stimulus */}
      <div className="rounded-xl border-2 border-gray-800 bg-gray-900 p-4 text-white shadow">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          The text being read
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{trace.stimulus}</p>
      </div>

      {MOVE_ORDER.map((mkey, i) => {
        const entry = (trace.moves || {})[mkey] ?? null;
        const skipReason = mkey === 'move_0' ? skip['corporeal_anchoring'] : undefined;
        return (
          <React.Fragment key={mkey}>
            {i === 0 ? (
              <div className="flex flex-col items-center py-1">
                <div className="h-4 w-0.5 bg-gray-300" />
                <ArrowDown className="h-4 w-4 text-gray-400" />
              </div>
            ) : (
              <Connector
                fromKey={MOVE_ORDER[i - 1]}
                skipped={MOVE_ORDER[i - 1] === 'move_0' && move0Skipped}
              />
            )}
            <MoveBlock mkey={mkey} entry={entry} skipReason={skipReason} />
          </React.Fragment>
        );
      })}

      {/* Final reading */}
      <div className="flex flex-col items-center py-1">
        <div className="h-4 w-0.5 bg-gray-300" />
        <ArrowDown className="h-4 w-4 text-gray-400" />
      </div>
      <div className="rounded-xl border-2 border-gray-900 bg-white p-4 shadow">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          The critical reading
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
          {trace.response}
        </p>
      </div>
    </div>
  );
}

/**
 * Critical Lens — reasoning-trace types and view helpers.
 *
 * The pipeline (philosopher_agent) writes one JSON trace per run under
 * `rag_data/<philosopher>/traces/`. This module types that shape and derives
 * the bits the flow chart needs: per-move input blocks, key-signal chips, and
 * the contract handoffs that flow each move's output into the next move.
 *
 * Move #5 (aphoristic compression) is deactivated; the pipeline ends at
 * Move #4 and the flow chart visualizes Move #0 → Move #4.
 */

export interface MoveCall {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

export interface RetrievalCall {
  tool: string;
  query: string;
  results_summary: string;
  used_in_reasoning: boolean;
  phase: string;
  error?: string | null;
}

export interface PromptPair {
  move_id: string;
  system: string;
  user: string;
}

export interface MoveEntry {
  catalog_ids: string[];
  output_json: Record<string, unknown>;
  retrieval_calls: RetrievalCall[];
  confidence_note: string;
  prompts: PromptPair[];
  calls: MoveCall[];
}

export interface CoherenceCheck {
  recommendation?: string;
  consistent?: boolean;
  stance_preserved?: boolean;
  summary?: string;
  issues?: Array<Record<string, unknown>>;
}

export interface TraceData {
  philosopher: string;
  mode: string;
  stimulus: string;
  response: string;
  moves: Record<string, MoveEntry | null>;
  skipped_moves: Record<string, string>;
  coherence_check?: CoherenceCheck;
  critique_notes?: Array<Record<string, unknown>>;
  totals?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface TraceSummary {
  id: string;
  ts: string;
  verdict: string;
  cost: number;
  stimulus: string;
}

/** Ordered spec keys the flow chart renders (Move #5 deactivated). */
export const MOVE_ORDER = ['move_0', 'move_1', 'move_2', 'move_3', 'move_4'] as const;
export type MoveKey = (typeof MOVE_ORDER)[number];

export const MOVE_META: Record<MoveKey, { num: string; name: string; tagline: string }> = {
  move_0: {
    num: '0',
    name: 'Corporeal Anchoring',
    tagline: 'What kind of body does this speech come from?',
  },
  move_1: {
    num: '1',
    name: 'Functional Interrogation',
    tagline: 'What does the load-bearing concept DO?',
  },
  move_2: {
    num: '2',
    name: 'Genealogical Reduction',
    tagline: 'How did that function come to be?',
  },
  move_3: {
    num: '3',
    name: 'Vindicatory Inversion',
    tagline: 'Does the history vindicate, leave, or subvert it?',
  },
  move_4: {
    num: '4',
    name: 'Perspectival Multiplicity',
    tagline: 'From whose position was the verdict spoken?',
  },
};

/** Contract handoffs — what each move's output feeds into the next move's input. */
export const HANDOFFS: Record<string, { to: MoveKey; via: string; fields: string[] }> = {
  move_0: { to: 'move_1', via: '[STANCE]', fields: ['embodied_frame'] },
  move_1: {
    to: 'move_2',
    via: '[ANALYSIS SO FAR]',
    fields: ['target_concept', 'functional_hypothesis', 'beneficiary', 'destabilizes_when_removed'],
  },
  move_2: {
    to: 'move_3',
    via: '[GENEALOGY]',
    fields: [
      'proto_practice',
      'developmental_stages',
      'current_function_distance',
      'nietzsche_precedent',
      'genealogy_caveat',
    ],
  },
  move_3: {
    to: 'move_4',
    via: '[VERDICT]',
    fields: ['verdict', 'articulation', 'hypertrophy_diagnosis', 'ressentiment_diagnosis'],
  },
};

/**
 * Split a move's curated user prompt into its labeled blocks
 * ([STIMULUS], [STANCE], [ANALYSIS SO FAR], [SOURCE MATERIAL], …).
 * The trailing boilerplate instruction is dropped.
 */
export function parseInputBlocks(user: string): Array<{ label: string; body: string }> {
  if (!user) return [];
  const text = user.replace(/\n\nPerform the work now[\s\S]*$/, '').trim();
  const parts = text.split(/\n\n(?=\[[A-Z])/);
  const blocks: Array<{ label: string; body: string }> = [];
  for (const part of parts) {
    const m = part.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
    if (m) blocks.push({ label: m[1], body: m[2].trim() });
  }
  return blocks;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** High-signal chips shown in each move's header. */
export function keySignals(
  key: MoveKey,
  out: Record<string, unknown> | undefined,
): Array<{ label: string; value: string; tone: 'neutral' | 'warn' | 'good' }> {
  if (!out) return [];
  const chips: Array<{ label: string; value: string; tone: 'neutral' | 'warn' | 'good' }> = [];
  if (key === 'move_1') {
    chips.push({ label: 'concept', value: String(out.target_concept ?? '—'), tone: 'neutral' });
    chips.push({
      label: 'self-effacing',
      value: String(out.self_effacing_score ?? '—'),
      tone: 'neutral',
    });
  } else if (key === 'move_2') {
    chips.push({
      label: 'distance',
      value: String(asRecord(out.current_function_distance).score ?? '—'),
      tone: 'neutral',
    });
    if (out.tier_b_hedging_applied) chips.push({ label: 'tier-B', value: 'hedged', tone: 'warn' });
  } else if (key === 'move_3') {
    const verdict = String(out.verdict ?? '—');
    chips.push({
      label: 'verdict',
      value: verdict,
      tone: verdict === 'Subversive' ? 'warn' : verdict === 'Vindicatory' ? 'good' : 'neutral',
    });
    if (asRecord(out.hypertrophy_diagnosis).hypertrophy_detected)
      chips.push({ label: 'hypertrophy', value: 'detected', tone: 'warn' });
    if (asRecord(out.ressentiment_diagnosis).ressentiment_detected)
      chips.push({ label: 'ressentiment', value: 'detected', tone: 'warn' });
  } else if (key === 'move_4') {
    chips.push({
      label: 'primary lens',
      value: String(asRecord(out.primary_perspective).position_label ?? '—'),
      tone: 'neutral',
    });
  }
  return chips;
}

/** Sum cost across a move's calls. */
export function moveCost(entry: MoveEntry | null): {
  cost: number;
  latency: number;
  calls: number;
} {
  if (!entry || !entry.calls?.length) return { cost: 0, latency: 0, calls: 0 };
  const cost = entry.calls.reduce((a, c) => a + (c.cost_usd || 0), 0);
  const latency = entry.calls.reduce((a, c) => a + (c.latency_ms || 0), 0);
  return { cost, latency, calls: entry.calls.length };
}

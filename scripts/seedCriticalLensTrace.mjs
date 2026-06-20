/**
 * Seed one Critical Lens reasoning trace into MongoDB.
 *
 * Usage:
 *   MONGODB_URI="..." MONGODB_DB="agoramind" \
 *     node scripts/seedCriticalLensTrace.mjs <path-to-trace.json> [philosopher]
 *
 * Upserts by (philosopher, traceId) so re-running is idempotent and only ever
 * touches the one run you pass in.
 */
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import path from 'path';

const traceFile = process.argv[2];
const philosopher = (process.argv[3] || 'nietzsche').trim();
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'agoramind';

if (!traceFile) {
  console.error('usage: node scripts/seedCriticalLensTrace.mjs <trace.json> [philosopher]');
  process.exit(1);
}
if (!uri) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

const trace = JSON.parse(readFileSync(traceFile, 'utf-8'));
const traceId = path.basename(traceFile).replace(/\.json$/, '');
const verdict = trace?.moves?.move_3?.output_json?.verdict ?? '—';

const schema = new mongoose.Schema(
  {
    traceId: String,
    philosopher: String,
    ts: String,
    verdict: String,
    cost: Number,
    stimulus: String,
    data: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'criticallenstraces' },
);
const Model = mongoose.models.CriticalLensTrace || mongoose.model('CriticalLensTrace', schema);

await mongoose.connect(uri, { dbName });
const res = await Model.updateOne(
  { philosopher, traceId },
  {
    $set: {
      traceId,
      philosopher,
      ts: trace?.start_iso ?? '',
      verdict: String(verdict),
      cost: Number(trace?.totals?.cost_usd ?? 0),
      stimulus: String(trace?.stimulus ?? '').slice(0, 140),
      data: trace,
    },
    $setOnInsert: { createdAt: new Date() },
  },
  { upsert: true },
);
console.log(
  `seeded ${philosopher}/${traceId} (verdict=${verdict}) — matched=${res.matchedCount} upserted=${res.upsertedCount}`,
);
const total = await Model.countDocuments({ philosopher });
console.log(`total ${philosopher} traces in DB: ${total}`);
await mongoose.disconnect();

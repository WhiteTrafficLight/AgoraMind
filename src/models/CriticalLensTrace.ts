import mongoose from 'mongoose';

/**
 * A persisted philosopher-agent reasoning trace for the Critical Lens UI.
 *
 * `data` holds the full trace JSON (as written by the pipeline). The summary
 * fields are denormalized for the topic-list query so we don't deserialize
 * every full trace just to render the picker.
 */
export interface ICriticalLensTrace extends mongoose.Document {
  traceId: string;
  philosopher: string;
  ts: string;
  verdict: string;
  cost: number;
  stimulus: string;
  data: unknown;
  createdAt: Date;
}

const CriticalLensTraceSchema = new mongoose.Schema<ICriticalLensTrace>(
  {
    traceId: { type: String, required: true },
    philosopher: { type: String, required: true, index: true },
    ts: { type: String, default: '' },
    verdict: { type: String, default: '—' },
    cost: { type: Number, default: 0 },
    stimulus: { type: String, default: '' },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'criticallenstraces' },
);

CriticalLensTraceSchema.index({ philosopher: 1, traceId: 1 }, { unique: true });

export default mongoose.models.CriticalLensTrace ||
  mongoose.model<ICriticalLensTrace>('CriticalLensTrace', CriticalLensTraceSchema);

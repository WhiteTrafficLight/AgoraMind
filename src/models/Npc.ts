import mongoose from 'mongoose';

export interface ICustomNpc extends mongoose.Document {
  name: string;
  role: string;
  voice_style: string;
  reference_philosophers: string[];
  communication_style: string;
  debate_approach: string;
  created_by: string;
  created_at: Date;
  backend_id?: string;
  portrait_url?: string;
}

const CustomNpcSchema = new mongoose.Schema<ICustomNpc>({
  name: { type: String, required: true },
  role: { type: String, required: true },
  voice_style: { type: String, required: true },
  reference_philosophers: { type: [String], required: true },
  communication_style: { type: String, required: true },
  debate_approach: { type: String, required: true },
  created_by: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  backend_id: { type: String },
  portrait_url: { type: String }
});

export default mongoose.models.CustomNpc || mongoose.model<ICustomNpc>('CustomNpc', CustomNpcSchema); 
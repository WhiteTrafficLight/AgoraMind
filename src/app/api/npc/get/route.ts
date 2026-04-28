import { NextRequest, NextResponse } from 'next/server';
import { philosopherProfiles } from '@/lib/data/philosophers';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { loggers } from '@/utils/logger';

const BACKEND_API_URL = 'http://0.0.0.0:8000';

const NpcSchema = new mongoose.Schema({
  name: String,
  role: String,
  voice_style: String,
  reference_philosophers: [String],
  communication_style: String,
  debate_approach: String,
  portrait_url: String,
  created_by: String,
  created_at: String
});

export async function GET(req: NextRequest) {
  try {
    // URL id
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'No ID provided' }, { status: 400 });
    }
    
    loggers.npc.info(`🔍 Fetching NPC details for ID: ${id}`);
    
    // NPC (MongoDB )
    const isMongoId = id.length >= 24 && /^[0-9a-fA-F]{24}$/.test(id);
    const isUuid = id.length > 30 && id.split('-').length === 5;
    
    if (isMongoId || isUuid) {
      try {
        await connectDB();
        
        // NPC (mongoose )
        const NpcModel = mongoose.models.CustomNpc || mongoose.model('CustomNpc', NpcSchema);
        
        // MongoDB NPC - ObjectID backend_id
        let npc;
        if (isMongoId) {
          loggers.npc.info(`🔍 Searching by MongoDB ObjectID: ${id}`);
          npc = await NpcModel.findById(new ObjectId(id));
        }
        
        // ObjectID UUID backend_id
        if (!npc && isUuid) {
          loggers.npc.info(`🔍 Searching by backend_id (UUID): ${id}`);
          npc = await NpcModel.findOne({ backend_id: id });
        }
        
        if (!npc) {
          loggers.npc.info(`🔍 Searching by id field as fallback: ${id}`);
          npc = await NpcModel.findOne({ id: id });
        }
        
        if (npc) {
          loggers.npc.info(`✅ Found custom NPC: ${npc.name}`);
          loggers.npc.info(`   _id: ${npc._id}, backend_id: ${npc.backend_id || 'not set'}`);
          loggers.npc.info(`   portrait_url: ${npc.portrait_url || 'NONE'}`);
          return NextResponse.json({
            id: npc._id.toString(),
            name: npc.name,
            description: `Custom philosopher${npc.role ? ` with role: ${npc.role}` : ''}`,
            communication_style: npc.communication_style,
            debate_approach: npc.debate_approach,
            voice_style: npc.voice_style,
            reference_philosophers: npc.reference_philosophers,
            portrait_url: npc.portrait_url,
            is_custom: true,
            created_by: npc.created_by
          });
        } else {
          loggers.npc.info(`❌ Custom NPC not found in MongoDB with any ID method: ${id}`);
          loggers.npc.info('   Tried: ObjectID lookup, backend_id lookup, and id field lookup');
        }
      } catch (dbError) {
        loggers.npc.error('MongoDB query error:', dbError);
      }
    }
    
    try {
      // Python API
      // API - NPC
      loggers.npc.info(`🔄 Returning basic NPC data for: ${id}`);
      
      const basicNpcData = {
        id: id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        description: `${id.charAt(0).toUpperCase() + id.slice(1)} is a philosopher with unique perspectives.`,
        is_custom: false
      };
      
      return NextResponse.json(basicNpcData);
    } catch (apiError) {
      loggers.npc.error('❌ Error generating basic NPC data:', apiError);
    }
    
    const philosophers = Object.keys(philosopherProfiles);
    const matchedPhilosopher = philosophers.find(name => 
      name.toLowerCase() === id.toLowerCase() || 
      id.toLowerCase().includes(name.toLowerCase())
    );
    
    if (matchedPhilosopher) {
      const profile = philosopherProfiles[matchedPhilosopher];
      loggers.npc.info(`✅ Found local philosopher profile: ${matchedPhilosopher}`);
      
      return NextResponse.json({
        id: matchedPhilosopher.toLowerCase(),
        name: matchedPhilosopher,
        description: profile.description,
        key_concepts: profile.key_concepts,
        portrait_url: null,  // URL
        is_custom: false
      });
    }
    
    loggers.npc.info(`⚠️ Returning default info for NPC: ${id}`);
    return NextResponse.json({
      id: id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      description: "A philosopher with unique perspectives",
      is_custom: false
    });
    
  } catch (error) {
    loggers.npc.error('❌ Error in NPC get handler:', error);
    return NextResponse.json(
      { error: "Failed to get NPC details" },
      { status: 500 }
    );
  }
} 
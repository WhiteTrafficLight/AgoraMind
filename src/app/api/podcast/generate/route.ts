import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define types
interface Speaker {
  id: string;
  name: string;
}

interface Message {
  text: string;
  speaker: string;
  speakerName: string;
  timestamp: string;
}

interface PodcastRequest {
  conversation: Message[];
  title: string;
  participants: Speaker[];
}

// Voice styles for different philosophers
const voiceStyles: Record<string, any> = {
  'socrates': {
    stability: 0.6,
    similarity_boost: 0.8,
    style: 0.6,
    use_speaker_boost: true
  },
  'plato': {
    stability: 0.7,
    similarity_boost: 0.7, 
    style: 0.5,
    use_speaker_boost: true
  },
  'aristotle': {
    stability: 0.8,
    similarity_boost: 0.6,
    style: 0.4,
    use_speaker_boost: true
  },
  'kant': {
    stability: 0.9,
    similarity_boost: 0.5,
    style: 0.4,
    use_speaker_boost: true
  },
  'nietzsche': {
    stability: 0.4,
    similarity_boost: 0.9,
    style: 0.8,
    use_speaker_boost: true
  },
  'sartre': {
    stability: 0.6,
    similarity_boost: 0.7,
    style: 0.6,
    use_speaker_boost: true
  },
  'camus': {
    stability: 0.6,
    similarity_boost: 0.7,
    style: 0.5,
    use_speaker_boost: true
  },
  'default': {
    stability: 0.6,
    similarity_boost: 0.7,
    style: 0.3,
    use_speaker_boost: true
  }
};

// Default map of voice IDs
const defaultVoiceMap: Record<string, string> = {
  'default': 'TxGEqnHWrfWFTfGW9XjX', // Josh - good default voice
  'user': 'pNInz6obpgDQGcFmaJgB',     // Adam
  'socrates': 'N2lVS1w4EtoT3dr4eOWO',  // Ethan
  'plato': 'VR6AewLTigWG4xSOukaG',     // Arnold
  'aristotle': 'ErXwobaYiN019PkySvjV', // Antoni
  'kant': 'SOYHLrjzK2X1ezoPC6cr',      // Daniel
  'nietzsche': 'pNInz6obpgDQGcFmaJgB', // Adam
  'sartre': 'flq6f7yk4E4fJM5XTYuZ',    // Gigi
  'camus': 'XB0fDUnXU5powFXDhCwa'      // Thomas
};

// Function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to convert text to speech using ElevenLabs API
async function textToSpeech(text: string, voiceId: string, speakerId: string): Promise<Buffer> {
  const elevenLabsApiKey = process.env.ELEVENLABS_KEY;
  
  if (!elevenLabsApiKey) {
    throw new Error('ELEVENLABS_KEY is not defined in environment variables');
  }
  
  // Get voice settings based on speaker
  const voiceSettings = voiceStyles[speakerId] || voiceStyles['default'];
  
  const payload = {
    text: text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: voiceSettings
  };
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': elevenLabsApiKey
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
  }
  
  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
}

// Get voice ID for a speaker
function getVoiceId(speakerId: string): string {
  return defaultVoiceMap[speakerId] || defaultVoiceMap['default'];
}

// Handler for POST requests
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: PodcastRequest = await request.json();
    const { conversation, title, participants } = body;
    
    if (!conversation || !title) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create podcast directory if it doesn't exist
    const publicDir = path.join(process.cwd(), 'public');
    const podcastDir = path.join(publicDir, 'podcasts');
    
    if (!fs.existsSync(podcastDir)) {
      fs.mkdirSync(podcastDir, { recursive: true });
    }
    
    // Generate unique ID for this podcast
    const podcastId = uuidv4();
    const podcastPath = path.join(podcastDir, podcastId);
    fs.mkdirSync(podcastPath, { recursive: true });
    
    // Process each message sequentially instead of in parallel
    const audioSegments = [];
    
    // Process messages one at a time with a delay between each
    for (let index = 0; index < conversation.length; index++) {
      const message = conversation[index];
      const filename = path.join(podcastPath, `segment_${index.toString().padStart(3, '0')}.mp3`);
      
      try {
        // Get appropriate voice ID and speaker ID
        const speaker = message.speaker;
        const voiceId = getVoiceId(speaker);
        
        // Generate audio - passing speaker ID instead of style
        const audioBuffer = await textToSpeech(message.text, voiceId, speaker);
        
        // Save audio file
        fs.writeFileSync(filename, audioBuffer);
        
        audioSegments.push({
          index,
          speaker,
          filename: filename.replace(publicDir, ''),
          duration: 0 // We would need to analyze the audio to get actual duration
        });
        
        // Add delay between API calls to avoid rate limiting (500ms)
        if (index < conversation.length - 1) {
          await delay(500);
        }
      } catch (error) {
        console.error(`Error processing segment ${index}:`, error);
        // Continue with next segment even if this one fails
      }
    }
    
    // Store metadata
    const metadata = {
      id: podcastId,
      title,
      created: new Date().toISOString(),
      participants,
      segments: audioSegments,
      fullAudioPath: `/podcasts/${podcastId}/full.mp3`,
      conversation
    };
    
    // Save metadata
    fs.writeFileSync(
      path.join(podcastPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // TODO: Concatenate audio files to create full podcast
    // This would typically be done with ffmpeg, but for simplicity
    // we'll just create a reference to the individual files
    
    // Return success response
    return NextResponse.json({
      id: podcastId,
      title,
      audioPath: `/podcasts/${podcastId}`,
      segments: audioSegments.map(s => s.filename)
    });
  } catch (error: any) {
    console.error('Error generating podcast:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate podcast' },
      { status: 500 }
    );
  }
} 
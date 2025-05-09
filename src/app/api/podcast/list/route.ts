import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Get podcasts directory
    const publicDir = path.join(process.cwd(), 'public');
    const podcastDir = path.join(publicDir, 'podcasts');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(podcastDir)) {
      fs.mkdirSync(podcastDir, { recursive: true });
      return NextResponse.json({ podcasts: [] });
    }
    
    // Read podcast directories
    const podcastDirs = fs.readdirSync(podcastDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Read metadata for each podcast
    const podcasts = podcastDirs.map(dir => {
      const metadataPath = path.join(podcastDir, dir, 'metadata.json');
      
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          return {
            id: metadata.id,
            title: metadata.title,
            created: metadata.created,
            participants: metadata.participants,
            audioPath: `/podcasts/${dir}`,
            segments: metadata.segments
          };
        } catch (error) {
          console.error(`Error reading metadata for podcast ${dir}:`, error);
          return null;
        }
      }
      return null;
    }).filter(podcast => podcast !== null);
    
    // Sort podcasts by creation date (newest first)
    podcasts.sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA;
    });
    
    return NextResponse.json({ podcasts });
  } catch (error: any) {
    console.error('Error listing podcasts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list podcasts' },
      { status: 500 }
    );
  }
} 
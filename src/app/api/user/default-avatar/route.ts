import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Handler to serve the default avatar image
export async function GET(req: NextRequest) {
  try {
    // Path to default avatar image
    const imagePath = path.join(process.cwd(), 'public', 'default-avatar.png');
    
    let imageBuffer;
    
    try {
      // Try to read the image file
      imageBuffer = await fs.readFile(imagePath);
    } catch (error) {
      // If the default avatar doesn't exist, create a colorful placeholder
      const width = 200;
      const height = 200;
      const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#e0e0e0" />
          <circle cx="${width/2}" cy="${height/2 - 15}" r="${width/4}" fill="#9ca3af" />
          <rect x="${width/4}" y="${height/2 + 20}" width="${width/2}" height="${height/4}" rx="10" fill="#9ca3af" />
        </svg>
      `;
      
      // Convert SVG to buffer
      imageBuffer = Buffer.from(svg);
      
      // Set content type to SVG
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }
    
    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (error) {
    console.error('Error serving default avatar:', error);
    return NextResponse.json({ error: 'Failed to serve default avatar' }, { status: 500 });
  }
} 
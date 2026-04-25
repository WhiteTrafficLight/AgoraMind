import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    // FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    
    const fileType = file.type;
    const validTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!validTypes.includes(fileType)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Only txt, pdf, and docx files are supported' 
      }, { status: 400 });
    }
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempDir = path.join(process.cwd(), 'tmp');
    
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
    
    const uniqueFilename = `${uuidv4()}${path.extname(file.name)}`;
    const tempFilePath = path.join(tempDir, uniqueFilename);
    
    await fs.writeFile(tempFilePath, buffer);
    
    let content = '';
    
    try {
      if (fileType === 'text/plain') {
        content = await fs.readFile(tempFilePath, 'utf-8');
      } else if (fileType === 'application/pdf') {
        // PDF (pdftotext )
        try {
          const { stdout } = await execAsync(`pdftotext "${tempFilePath}" -`);
          content = stdout;
        } catch (error) {
          // pdftotext
          content = 'Failed to extract text from PDF. Please provide text directly.';
        }
      } else if (fileType.includes('docx')) {
        // DOCX (mammoth )
        try {
          content = 'DOCX file content extraction is not fully supported. Please copy and paste the content directly.';
        } catch (error) {
          content = 'Failed to extract text from DOCX file. Please provide text directly.';
        }
      }
      
      content = content.trim();
      
      if (content.length > 10000) {
        content = content.substring(0, 10000) + '...';
      }
      
      content = `Content from file: ${file.name}\n\n${content}`;
      
    } finally {
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        console.error('Error deleting temp file:', error);
      }
    }
    
    return NextResponse.json({ content, fileName: file.name });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    );
  }
} 
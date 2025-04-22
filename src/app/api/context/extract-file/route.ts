import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    // FormData에서 파일 추출
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    
    // 파일 타입 확인
    const fileType = file.type;
    const validTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!validTypes.includes(fileType)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Only txt, pdf, and docx files are supported' 
      }, { status: 400 });
    }
    
    // 임시 디렉토리에 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempDir = path.join(process.cwd(), 'tmp');
    
    // 임시 디렉토리 생성 (없는 경우)
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
    
    // 고유한 파일 이름 생성
    const uniqueFilename = `${uuidv4()}${path.extname(file.name)}`;
    const tempFilePath = path.join(tempDir, uniqueFilename);
    
    // 파일 저장
    await fs.writeFile(tempFilePath, buffer);
    
    let content = '';
    
    try {
      // 파일 타입에 따른 내용 추출
      if (fileType === 'text/plain') {
        // 텍스트 파일 직접 읽기
        content = await fs.readFile(tempFilePath, 'utf-8');
      } else if (fileType === 'application/pdf') {
        // PDF 파일 텍스트 추출 (pdftotext 사용)
        try {
          const { stdout } = await execAsync(`pdftotext "${tempFilePath}" -`);
          content = stdout;
        } catch (error) {
          // pdftotext 실패 시 대체 메시지
          content = 'Failed to extract text from PDF. Please provide text directly.';
        }
      } else if (fileType.includes('docx')) {
        // DOCX 파일 (mammoth 패키지 설치 필요)
        try {
          // 서버에서 직접 처리할 수 없는 경우 대체 메시지
          content = 'DOCX file content extraction is not fully supported. Please copy and paste the content directly.';
        } catch (error) {
          content = 'Failed to extract text from DOCX file. Please provide text directly.';
        }
      }
      
      // 내용 정리
      content = content.trim();
      
      // 너무 긴 내용은 잘라냄
      if (content.length > 10000) {
        content = content.substring(0, 10000) + '...';
      }
      
      // 파일 정보 추가
      content = `Content from file: ${file.name}\n\n${content}`;
      
    } finally {
      // 임시 파일 삭제 (항상 시도)
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
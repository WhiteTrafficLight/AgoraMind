import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // URL 형식 검증
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    // 웹 페이지 가져오기
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgoraMind/1.0; +http://agoramind.io)',
      },
      timeout: 10000, // 10초 타임아웃
    });
    
    // HTML 파싱
    const html = response.data;
    const $ = cheerio.load(html);
    
    // 메타 데이터 추출
    const title = $('title').text() || '';
    const description = $('meta[name="description"]').attr('content') || '';
    
    // 주요 컨텐츠 추출 (여러 전략 시도)
    let content = '';
    
    // 1. article 태그나 주요 컨텐츠 영역에서 추출 시도
    const articleContent = $('article, .content, .post, .article, main').text();
    if (articleContent && articleContent.length > 100) {
      content = articleContent;
    } else {
      // 2. 모든 p 태그 내용 합치기
      content = $('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
    }
    
    // 컨텐츠 정리
    content = content.replace(/\s+/g, ' ').trim();
    
    // 너무 긴 컨텐츠는 잘라내기 (5000자로 제한)
    if (content.length > 5000) {
      content = content.substring(0, 5000) + '...';
    }
    
    // 제목과 설명 추가
    let finalContent = '';
    if (title) {
      finalContent += `Title: ${title}\n\n`;
    }
    if (description) {
      finalContent += `Description: ${description}\n\n`;
    }
    finalContent += `Content from URL: ${url}\n\n${content}`;
    
    return NextResponse.json({ content: finalContent, url });
  } catch (error) {
    console.error('Error fetching URL content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content from URL' },
      { status: 500 }
    );
  }
} 
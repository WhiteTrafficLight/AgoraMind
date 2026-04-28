import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { loggers } from '@/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgoraMind/1.0; +http://agoramind.io)',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        return NextResponse.json(
          { error: `Upstream responded with ${response.status}` },
          { status: 502 }
        );
      }
      html = await response.text();
    } finally {
      clearTimeout(timeout);
    }
    const $ = cheerio.load(html);
    
    const title = $('title').text() || '';
    const description = $('meta[name="description"]').attr('content') || '';
    
    let content = '';
    
    // 1. article
    const articleContent = $('article, .content, .post, .article, main').text();
    if (articleContent && articleContent.length > 100) {
      content = articleContent;
    } else {
      content = $('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
    }
    
    content = content.replace(/\s+/g, ' ').trim();
    
    if (content.length > 5000) {
      content = content.substring(0, 5000) + '...';
    }
    
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
    loggers.api.error('Error fetching URL content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content from URL' },
      { status: 500 }
    );
  }
} 
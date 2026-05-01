import type { ChatMessage } from '@/lib/ai/chatService';

type EnrichableMetadata = {
  rag_used?: boolean;
  rag_source_count?: number;
  rag_sources?: ChatMessage['rag_sources'];
  citations?: ChatMessage['citations'];
};

export function enrichFromMetadata(msg: ChatMessage): ChatMessage {
  const meta = (msg.metadata ?? {}) as EnrichableMetadata;
  return {
    ...msg,
    skipAnimation: false,
    rag_used: meta.rag_used || false,
    rag_source_count: meta.rag_source_count || 0,
    rag_sources: meta.rag_sources || [],
    citations: meta.citations || [],
  };
}

import { API_BASE_URL } from './baseUrl';

/**
 * Path constants for the Python backend API.
 *
 * Centralizing here means:
 *   - One place to grep for what the backend exposes.
 *   - Renames stay in sync across the frontend.
 *   - TypeScript catches typos in path templates.
 *
 * Conventions:
 *   - Static paths are string constants.
 *   - Parameterized paths are functions returning the formatted string.
 *   - Group keys mirror the backend router prefixes (chat, philosophers, etc.).
 *   - Paths are leading-slash-relative; pair with `apiUrl()` to get a full URL.
 */
export const ENDPOINTS = {
  chat: {
    generate: '/api/chat/generate',
    createDebateRoom: '/api/chat/create-debate-room',
    debateNextMessage: (roomId: string) => `/api/chat/debate/${roomId}/next-message`,
    debateProcessUserMessage: (roomId: string) =>
      `/api/chat/debate/${roomId}/process-user-message`,
  },
  dialogue: {
    action: (roomId: string, action: string) => `/api/dialogue/${roomId}/${action}`,
  },
  freeDiscussion: {
    base: '/api/free-discussion',
    create: '/api/free-discussion/create',
    byId: (sessionId: string) => `/api/free-discussion/${sessionId}`,
    status: (sessionId: string) => `/api/free-discussion/${sessionId}/status`,
    pause: (sessionId: string) => `/api/free-discussion/${sessionId}/pause`,
    resume: (sessionId: string) => `/api/free-discussion/${sessionId}/resume`,
    settings: (sessionId: string) => `/api/free-discussion/${sessionId}/settings`,
    nextTurn: (sessionId: string) => `/api/free-discussion/${sessionId}/next-turn`,
    message: (sessionId: string) => `/api/free-discussion/${sessionId}/message`,
    summary: (sessionId: string) => `/api/free-discussion/${sessionId}/summary`,
  },
  npc: {
    create: '/api/npc/create',
  },
  philosophers: {
    list: '/api/philosophers',
    byId: (id: string) => `/api/philosophers/${id}`,
  },
  portraits: {
    generate: '/api/portraits/generate',
  },
} as const;

/** Build a full URL by joining `API_BASE_URL` with a path constant. */
export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;

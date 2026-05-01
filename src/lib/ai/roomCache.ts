import { loggers } from '@/utils/logger';
import type { ChatMessage, ChatRoom } from './chatTypes';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * In-memory cache of ChatRoom records used by ChatService. Wraps the
 * room array + per-room timestamp map that previously lived as private
 * fields on the service. All cached rooms are stored as JSON-cloned
 * isolated copies so external mutations don't bleed back into the cache.
 */
export class RoomCache {
  private rooms: ChatRoom[] = [];
  private timestamps: Record<string, number> = {};

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  /** Returns the room if cached (regardless of staleness). */
  get(id: string | number): ChatRoom | undefined {
    const key = String(id).trim();
    return this.rooms.find((r) => String(r.id).trim() === key);
  }

  /** Returns the room only if the cache entry is still within TTL. */
  getIfValid(id: string | number): ChatRoom | undefined {
    const key = String(id).trim();
    const room = this.get(key);
    if (!room) return undefined;
    return this.isValid(key) ? room : undefined;
  }

  isValid(id: string | number): boolean {
    const key = String(id).trim();
    const ts = this.timestamps[key];
    if (!ts) return false;
    return Date.now() - ts < this.ttlMs;
  }

  /** Snapshot of all currently cached rooms (live array reference). */
  getAll(): ChatRoom[] {
    return this.rooms;
  }

  /** Replace the entire cache with a fresh batch (e.g., after listing). */
  replaceAll(rooms: ChatRoom[]): void {
    this.rooms = rooms;
    const now = Date.now();
    for (const room of rooms) {
      this.timestamps[String(room.id).trim()] = now;
    }
  }

  /**
   * Add or update a room in the cache. The room is JSON-cloned so the
   * caller's reference is not retained.
   */
  set(room: ChatRoom): void {
    if (!room.id) {
      loggers.api.error('Attempted to cache room with no ID', { room });
      return;
    }
    const key = String(room.id).trim();
    loggers.api.debug('Updating cache for room', {
      roomId: key,
      originalId: room.id,
      idType: typeof room.id,
    });
    room.id = key;

    const isolated: ChatRoom = JSON.parse(JSON.stringify(room));
    const existing = this.rooms.findIndex((r) => r.id === key);
    if (existing >= 0) {
      this.rooms[existing] = isolated;
      loggers.api.info('Updated existing cache entry for room', { roomId: key });
    } else {
      this.rooms.push(isolated);
      loggers.api.info('Added new cache entry for room', { roomId: key });
    }
    this.timestamps[key] = Date.now();
  }

  /**
   * Append a message to a room's messages array in place. Returns true
   * if the room was found and the message was appended.
   */
  appendMessage(roomId: string | number, message: ChatMessage): boolean {
    const key = String(roomId).trim();
    const idx = this.rooms.findIndex((r) => String(r.id).trim() === key);
    if (idx < 0) return false;
    if (!this.rooms[idx].messages) {
      this.rooms[idx].messages = [];
    }
    this.rooms[idx].messages!.push(message);
    return true;
  }
}

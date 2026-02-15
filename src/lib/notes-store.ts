/**
 * Notes storage: Upstash Redis when env vars set (Vercel), else in-memory fallback.
 * Admin reads from the same store so notes appear in the dashboard.
 */

import { Redis } from "@upstash/redis";

const KEY = "ndmo:notes";
const MAX_NOTES = 200;

export interface StoredNote {
  id: string;
  sessionId: string;
  content: string;
  timestamp: string;
  locale: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getNotesFromStore(): Promise<StoredNote[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get(KEY);
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr as StoredNote[] : [];
  } catch {
    return [];
  }
}

export async function appendNoteToStore(note: StoredNote): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const notes = await getNotesFromStore();
    notes.push(note);
    const trimmed = notes.length > MAX_NOTES ? notes.slice(-MAX_NOTES) : notes;
    await redis.set(KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

export function isNotesStoreAvailable(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

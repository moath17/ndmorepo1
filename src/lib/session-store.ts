/**
 * Session storage: Upstash Redis when env vars set (Vercel).
 * Enables admin users tab to work on production.
 */

import { Redis } from "@upstash/redis";

const KEY = "ndmo:sessions";
const MAX_SESSIONS = 500;

export interface StoredSession {
  id: string;
  name?: string;
  createdAt: string;
  lastActive: string;
  questionsCount: number;
  locale?: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getSessionsFromStore(): Promise<StoredSession[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get(KEY);
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as StoredSession[]) : [];
  } catch {
    return [];
  }
}

export async function saveSessionsToStore(sessions: StoredSession[]): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const trimmed = sessions.length > MAX_SESSIONS ? sessions.slice(-MAX_SESSIONS) : sessions;
    await redis.set(KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

export function isSessionStoreAvailable(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return !!(url && token);
}

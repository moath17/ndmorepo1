/**
 * Interactions storage (for chat + ratings): Upstash Redis when env vars set (Vercel).
 * Enables like button and admin feedback tab to work on production.
 */

import { Redis } from "@upstash/redis";

const KEY = "ndmo:interactions";
const MAX_INTERACTIONS = 1000;

export interface StoredInteraction {
  id: string;
  sessionId: string;
  userName?: string;
  timestamp: string;
  locale: string;
  question: string;
  answer: string;
  sources: Array<{ document: string; page?: number }>;
  rating?: "up" | "down" | null;
  feedbackReason?: string | null;
  responseTimeMs?: number;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getInteractionsFromStore(): Promise<StoredInteraction[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get(KEY);
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as StoredInteraction[]) : [];
  } catch {
    return [];
  }
}

export async function saveInteractionsToStore(interactions: StoredInteraction[]): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const trimmed = interactions.length > MAX_INTERACTIONS ? interactions.slice(-MAX_INTERACTIONS) : interactions;
    await redis.set(KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

export function isInteractionsStoreAvailable(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

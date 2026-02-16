/**
 * API Usage tracking: Upstash Redis storage for OpenAI API usage metrics.
 * Tracks daily request counts, token usage, and estimated costs.
 */

import { Redis } from "@upstash/redis";

const KEY = "ndmo:api-usage";
const MAX_DAYS = 90;

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number; // USD
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// GPT-4.1-mini pricing (per 1M tokens)
const INPUT_PRICE_PER_1M = 0.40;
const OUTPUT_PRICE_PER_1M = 1.60;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_PRICE_PER_1M +
         (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;
}

export async function getUsageFromStore(): Promise<DailyUsage[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get(KEY);
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as DailyUsage[]) : [];
  } catch {
    return [];
  }
}

export async function recordUsage(inputTokens: number, outputTokens: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const list = await getUsageFromStore();
    const today = new Date().toISOString().split("T")[0];
    let entry = list.find((d) => d.date === today);

    if (entry) {
      entry.requests += 1;
      entry.inputTokens += inputTokens;
      entry.outputTokens += outputTokens;
      entry.estimatedCost += estimateCost(inputTokens, outputTokens);
    } else {
      entry = {
        date: today,
        requests: 1,
        inputTokens,
        outputTokens,
        estimatedCost: estimateCost(inputTokens, outputTokens),
      };
      list.push(entry);
    }

    // Keep only last MAX_DAYS
    const trimmed = list.length > MAX_DAYS ? list.slice(-MAX_DAYS) : list;
    await redis.set(KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

export function isUsageStoreAvailable(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return !!(url && token);
}

/**
 * Assessments storage: Upstash Redis when env vars set (Vercel).
 * Enables admin assessments tab to work on production.
 */

import { Redis } from "@upstash/redis";

const KEY = "ndmo:assessments";
const MAX_ASSESSMENTS = 200;

export interface StoredAssessment {
  id: string;
  userName: string;
  locale: string;
  overallScore: number;
  categoryScores: { id: string; name: string; score: number }[];
  totalQuestions: number;
  answeredYes: number;
  answeredPartial: number;
  answeredNo: number;
  timestamp: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getAssessmentsFromStore(): Promise<StoredAssessment[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get(KEY);
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as StoredAssessment[]) : [];
  } catch {
    return [];
  }
}

export async function appendAssessmentToStore(assessment: StoredAssessment): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const list = await getAssessmentsFromStore();
    list.push(assessment);
    const trimmed = list.length > MAX_ASSESSMENTS ? list.slice(-MAX_ASSESSMENTS) : list;
    await redis.set(KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

export function isAssessmentsStoreAvailable(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return !!(url && token);
}

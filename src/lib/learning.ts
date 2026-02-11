/**
 * Learning engine for the NDMO chat system.
 * Manages interactions, cached answers, and ambiguous question patterns.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import type { Source } from "@/types";

// --- Data paths ---
const DATA_DIR = resolve(process.cwd(), "data");
const INTERACTIONS_FILE = resolve(DATA_DIR, "interactions.json");
const PATTERNS_FILE = resolve(DATA_DIR, "learned-patterns.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

// --- Types ---
export interface Interaction {
  id: string;
  sessionId: string;
  userName?: string;
  timestamp: string;
  locale: string;
  question: string;
  answer: string;
  sources: Source[];
  rating?: "up" | "down" | null;
  feedbackReason?: string | null;
  responseTimeMs?: number;
}

interface CachedAnswer {
  patterns: string[];
  answer: string;
  sources: Source[];
  confidence: number;
  usageCount: number;
  lastUsed: string;
}

interface AmbiguousQuestion {
  patterns: string[];
  clarificationOptions: string[];
  addedFrom: string;
}

interface LearnedPatterns {
  cachedAnswers: CachedAnswer[];
  ambiguousQuestions: AmbiguousQuestion[];
}

// --- Load/Save ---
function loadInteractions(): { interactions: Interaction[] } {
  if (!existsSync(INTERACTIONS_FILE)) return { interactions: [] };
  try {
    return JSON.parse(readFileSync(INTERACTIONS_FILE, "utf-8"));
  } catch {
    return { interactions: [] };
  }
}

function saveInteractions(data: { interactions: Interaction[] }) {
  ensureDataDir();
  writeFileSync(INTERACTIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function loadPatterns(): LearnedPatterns {
  if (!existsSync(PATTERNS_FILE))
    return { cachedAnswers: [], ambiguousQuestions: [] };
  try {
    return JSON.parse(readFileSync(PATTERNS_FILE, "utf-8"));
  } catch {
    return { cachedAnswers: [], ambiguousQuestions: [] };
  }
}

function savePatterns(data: LearnedPatterns) {
  ensureDataDir();
  writeFileSync(PATTERNS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// --- Fuzzy matching ---
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[؟?!.,،]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  // Simple word overlap (Jaccard)
  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  const intersection = Array.from(wordsA).filter((w) => wordsB.has(w));
  const unionArr = Array.from(wordsA);
  wordsB.forEach((w) => { if (!wordsA.has(w)) unionArr.push(w); });
  return unionArr.length === 0 ? 0 : intersection.length / unionArr.length;
}

// --- Public API ---

/** Record a new interaction (question + answer) */
export function recordInteraction(interaction: Omit<Interaction, "id">) {
  const data = loadInteractions();
  const newInteraction: Interaction = {
    ...interaction,
    id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  data.interactions.push(newInteraction);
  // Keep only the last 1000 interactions to avoid file bloat
  if (data.interactions.length > 1000) {
    data.interactions = data.interactions.slice(-1000);
  }
  saveInteractions(data);
  return newInteraction.id;
}

/** Update the rating of an existing interaction */
export function rateInteraction(
  interactionId: string,
  rating: "up" | "down",
  feedbackReason?: string
) {
  const data = loadInteractions();
  const interaction = data.interactions.find((i) => i.id === interactionId);
  if (interaction) {
    interaction.rating = rating;
    interaction.feedbackReason = feedbackReason || null;
    saveInteractions(data);

    // Auto-learn from feedback
    if (rating === "up") {
      maybeAddToCache(interaction);
    } else if (rating === "down") {
      maybeAddToAmbiguous(interaction, feedbackReason);
    }
    return true;
  }
  return false;
}

/** Check if there's a cached high-quality answer for this question */
export function getCachedAnswer(
  question: string
): { answer: string; sources: Source[] } | null {
  const patterns = loadPatterns();
  for (const cached of patterns.cachedAnswers) {
    for (const pattern of cached.patterns) {
      if (similarity(question, pattern) >= 0.85) {
        // Update usage stats
        cached.usageCount++;
        cached.lastUsed = new Date().toISOString().split("T")[0];
        savePatterns(patterns);
        return { answer: cached.answer, sources: cached.sources };
      }
    }
  }
  return null;
}

/** Check if the question matches a known ambiguous pattern */
export function getAmbiguousPattern(
  question: string
): { clarificationOptions: string[] } | null {
  const patterns = loadPatterns();
  for (const ambig of patterns.ambiguousQuestions) {
    for (const pattern of ambig.patterns) {
      if (similarity(question, pattern) >= 0.7) {
        return { clarificationOptions: ambig.clarificationOptions };
      }
    }
  }
  return null;
}

/** Get all interactions (for admin panel) */
export function getAllInteractions(): Interaction[] {
  return loadInteractions().interactions;
}

/** Get analytics for admin panel */
export function getAnalytics() {
  const { interactions } = loadInteractions();
  const total = interactions.length;
  const rated = interactions.filter((i) => i.rating !== null && i.rating !== undefined);
  const upCount = rated.filter((i) => i.rating === "up").length;
  const downCount = rated.filter((i) => i.rating === "down").length;

  // Group feedback reasons
  const reasonCounts: Record<string, number> = {};
  for (const i of rated) {
    if (i.rating === "down" && i.feedbackReason) {
      reasonCounts[i.feedbackReason] =
        (reasonCounts[i.feedbackReason] || 0) + 1;
    }
  }

  // Most asked questions (by similarity clusters)
  const questionCounts: Record<string, number> = {};
  for (const i of interactions) {
    const norm = normalize(i.question);
    questionCounts[norm] = (questionCounts[norm] || 0) + 1;
  }
  const topQuestions = Object.entries(questionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([q, count]) => ({ question: q, count }));

  return {
    total,
    upCount,
    downCount,
    unrated: total - upCount - downCount,
    satisfactionRate:
      upCount + downCount > 0
        ? Math.round((upCount / (upCount + downCount)) * 100)
        : 0,
    reasonCounts,
    topQuestions,
  };
}

// --- Internal learning logic ---
function maybeAddToCache(interaction: Interaction) {
  const patterns = loadPatterns();
  const norm = normalize(interaction.question);

  // Check if already cached
  for (const cached of patterns.cachedAnswers) {
    for (const p of cached.patterns) {
      if (similarity(norm, p) >= 0.85) {
        cached.usageCount++;
        cached.confidence = Math.min(1, cached.confidence + 0.05);
        savePatterns(patterns);
        return;
      }
    }
  }

  // Check if this question has been asked multiple times with positive ratings
  const { interactions } = loadInteractions();
  const similar = interactions.filter(
    (i) =>
      i.rating === "up" && similarity(i.question, interaction.question) >= 0.7
  );

  if (similar.length >= 2) {
    // Add to cache
    patterns.cachedAnswers.push({
      patterns: [norm],
      answer: interaction.answer,
      sources: interaction.sources,
      confidence: 0.8,
      usageCount: 1,
      lastUsed: new Date().toISOString().split("T")[0],
    });
    // Keep cache reasonable size
    if (patterns.cachedAnswers.length > 50) {
      patterns.cachedAnswers = patterns.cachedAnswers
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 50);
    }
    savePatterns(patterns);
  }
}

function maybeAddToAmbiguous(
  interaction: Interaction,
  reason?: string
) {
  if (reason !== "didnt_understand") return;

  const patterns = loadPatterns();
  const norm = normalize(interaction.question);

  // Check if already tracked
  for (const ambig of patterns.ambiguousQuestions) {
    for (const p of ambig.patterns) {
      if (similarity(norm, p) >= 0.7) return;
    }
  }

  // Check if multiple "didn't understand" for similar questions
  const { interactions } = loadInteractions();
  const similar = interactions.filter(
    (i) =>
      i.rating === "down" &&
      i.feedbackReason === "didnt_understand" &&
      similarity(i.question, interaction.question) >= 0.6
  );

  if (similar.length >= 2) {
    patterns.ambiguousQuestions.push({
      patterns: [norm],
      clarificationOptions: [],
      addedFrom: "repeated-negative-feedback",
    });
    savePatterns(patterns);
  }
}

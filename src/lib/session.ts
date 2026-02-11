/**
 * Simple session tracking for user analytics.
 * Uses file-based storage — no database needed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const DATA_DIR = resolve(process.cwd(), "data");
const SESSIONS_FILE = resolve(DATA_DIR, "sessions.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export interface Session {
  id: string;
  name?: string;
  createdAt: string;
  lastActive: string;
  questionsCount: number;
  locale?: string;
}

function loadSessions(): { sessions: Session[] } {
  if (!existsSync(SESSIONS_FILE)) return { sessions: [] };
  try {
    return JSON.parse(readFileSync(SESSIONS_FILE, "utf-8"));
  } catch {
    return { sessions: [] };
  }
}

function saveSessions(data: { sessions: Session[] }) {
  ensureDataDir();
  writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function trackSession(
  sessionId: string,
  name?: string,
  locale?: string
): Session {
  const data = loadSessions();
  let session = data.sessions.find((s) => s.id === sessionId);

  if (session) {
    session.lastActive = new Date().toISOString();
    session.questionsCount++;
    if (name && !session.name) session.name = name;
    if (locale) session.locale = locale;
  } else {
    session = {
      id: sessionId,
      name: name || undefined,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      questionsCount: 1,
      locale,
    };
    data.sessions.push(session);
  }

  // Keep only last 500 sessions
  if (data.sessions.length > 500) {
    data.sessions = data.sessions.slice(-500);
  }

  saveSessions(data);
  return session;
}

export function getAllSessions(): Session[] {
  return loadSessions().sessions;
}

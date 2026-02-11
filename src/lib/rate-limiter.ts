interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute window for burst protection
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REQUESTS_PER_MINUTE = 5; // Max 5 requests per minute (burst protection)
const MAX_REQUESTS_PER_DAY = 20; // Max 20 requests per day per user
const MAX_REQUESTS_UPLOAD = 10;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Periodic cleanup of stale entries
if (typeof globalThis !== "undefined") {
  const intervalKey = "__rateLimitCleanup";
  if (!(globalThis as Record<string, unknown>)[intervalKey]) {
    (globalThis as Record<string, unknown>)[intervalKey] = setInterval(() => {
      const now = Date.now();
      store.forEach((entry, key) => {
        entry.timestamps = entry.timestamps.filter(
          (t) => now - t < DAILY_WINDOW_MS
        );
        if (entry.timestamps.length === 0) {
          store.delete(key);
        }
      });
    }, CLEANUP_INTERVAL_MS);
  }
}

export function checkRateLimit(
  ip: string,
  endpoint: "chat" | "upload"
): { allowed: boolean; retryAfterMs?: number; reason?: "minute" | "daily" } {
  const key = `${endpoint}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Clean timestamps older than 24 hours
  entry.timestamps = entry.timestamps.filter(
    (t) => now - t < DAILY_WINDOW_MS
  );

  if (endpoint === "upload") {
    // Upload: simple per-minute limit
    const recentUploads = entry.timestamps.filter(
      (t) => now - t < WINDOW_MS
    );
    if (recentUploads.length >= MAX_REQUESTS_UPLOAD) {
      const oldestInWindow = recentUploads[0];
      const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
      return { allowed: false, retryAfterMs, reason: "minute" };
    }
    entry.timestamps.push(now);
    return { allowed: true };
  }

  // Chat: check daily limit first
  if (entry.timestamps.length >= MAX_REQUESTS_PER_DAY) {
    const oldestToday = entry.timestamps[0];
    const retryAfterMs = DAILY_WINDOW_MS - (now - oldestToday);
    return { allowed: false, retryAfterMs, reason: "daily" };
  }

  // Chat: check per-minute burst limit
  const recentMinute = entry.timestamps.filter((t) => now - t < WINDOW_MS);
  if (recentMinute.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestInWindow = recentMinute[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, retryAfterMs, reason: "minute" };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}

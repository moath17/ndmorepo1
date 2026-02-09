interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_CHAT = 20;
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
          (t) => now - t < WINDOW_MS
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
): { allowed: boolean; retryAfterMs?: number } {
  const key = `${endpoint}:${ip}`;
  const maxRequests =
    endpoint === "chat" ? MAX_REQUESTS_CHAT : MAX_REQUESTS_UPLOAD;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}

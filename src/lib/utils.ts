/**
 * Shared utility functions.
 */

import { NextRequest } from "next/server";

/**
 * Extract the client's IP address from request headers.
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

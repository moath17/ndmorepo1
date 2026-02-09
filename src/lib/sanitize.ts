/**
 * Sanitize a filename for safe storage and display.
 * - Strips path components
 * - Removes dangerous characters
 * - Limits length
 * - Preserves Arabic/Unicode alphanumeric characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators
  let sanitized = filename.replace(/[/\\]/g, "");

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Get name and extension
  const lastDot = sanitized.lastIndexOf(".");
  let name = lastDot > 0 ? sanitized.slice(0, lastDot) : sanitized;
  const ext = lastDot > 0 ? sanitized.slice(lastDot) : "";

  // Remove dangerous characters but keep word chars, spaces, hyphens, underscores
  // Also keep Arabic/Unicode characters by removing only ASCII special chars
  name = name.replace(/[<>:"/|?*\x00-\x1f`~!@#$%^&()+={}[\];',]/g, "");

  // Collapse multiple spaces/underscores
  name = name.replace(/[\s_]+/g, "_");

  // Trim leading/trailing underscores
  name = name.replace(/^_+|_+$/g, "");

  // Limit length (200 chars max for name)
  if (name.length > 200) {
    name = name.slice(0, 200);
  }

  // Fallback if name is empty
  if (!name) {
    name = `document_${Date.now()}`;
  }

  return name + ext.toLowerCase();
}

/**
 * Generate a unique ID for tracking uploads
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

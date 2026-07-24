/**
 * Helper utilities for deployment-agnostic R2 file storage and object key normalization.
 */

/**
 * Returns the active Cloudflare R2 bucket instance from env bindings.
 * Supports fallback order: STORAGE -> FILES -> MEDIA -> IMAGES
 */
export function getStorageBucket(env) {
  if (!env) return null;
  return env.STORAGE || env.FILES || env.MEDIA || env.IMAGES || null;
}

/**
 * Extracts and returns clean object key from any URL, path, or key string.
 * Examples:
 *   "https://roadlink-api.../api/v1/public/files/uploads/123.jpg" -> "uploads/123.jpg"
 *   "/api/v1/public/images/uploads/123.jpg"                       -> "uploads/123.jpg"
 *   "uploads/123.jpg"                                             -> "uploads/123.jpg"
 *   "https://images.unsplash.com/photo-123..."                    -> "https://images.unsplash.com/photo-123..."
 */
export function extractObjectKey(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== "string") return "";
  const trimmed = urlOrKey.trim();
  if (!trimmed) return "";

  // External URLs (e.g., Unsplash, Youtube, external CDNs) remain as-is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes("uploads/")) {
      const idx = trimmed.indexOf("uploads/");
      return trimmed.substring(idx);
    }
    return trimmed;
  }

  // Strip leading API route prefixes if present
  let clean = trimmed;
  clean = clean.replace(/^\/?api\/v1\/public\/(files|images)\//, "");
  clean = clean.replace(/^\/+/, "");

  return clean;
}

/**
 * Formats a stored object key or URL into a relative API endpoint path.
 * Examples:
 *   "uploads/123.jpg"                             -> "/api/v1/public/files/uploads/123.jpg"
 *   "https://images.unsplash.com/photo-123..."    -> "https://images.unsplash.com/photo-123..."
 */
export function resolveFileUrl(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== "string") return "";
  const trimmed = urlOrKey.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    // If it's an HTTP URL containing an upload path, convert to relative API route
    if (trimmed.includes("uploads/")) {
      const key = extractObjectKey(trimmed);
      return `/api/v1/public/files/${key}`;
    }
    return trimmed;
  }

  const key = extractObjectKey(trimmed);
  if (!key) return "";
  return `/api/v1/public/files/${key}`;
}

/**
 * Deletes a file from R2 storage if it is an object key in the storage bucket.
 */
export async function deleteStoredFile(env, urlOrKey) {
  const bucket = getStorageBucket(env);
  if (!bucket) return false;

  const key = extractObjectKey(urlOrKey);
  // Only attempt deletion for internal R2 objects (keys starting with "uploads/" or no protocol)
  if (!key || key.startsWith("http://") || key.startsWith("https://")) {
    return false;
  }

  try {
    await bucket.delete(key);
    return true;
  } catch (err) {
    console.error(`Failed to delete stored file ${key}:`, err);
    return false;
  }
}

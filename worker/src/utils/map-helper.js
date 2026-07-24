/**
 * Helper utilities for parsing and validating Google Maps Embed URLs.
 * Serves as the single source of truth for Google Maps Embed handling.
 */

/**
 * Extracts and validates a Google Maps Embed URL from either iframe HTML code or a direct embed URL.
 *
 * @param {string} input - Raw input string (iframe HTML string or embed URL)
 * @returns {{ valid: boolean, embedUrl?: string, error?: string }}
 */
export function parseAndValidateEmbedMapUrl(input) {
  if (!input || typeof input !== "string" || !input.trim()) {
    return { valid: true, embedUrl: "" };
  }

  let clean = input.trim();

  // 1. If iframe HTML is pasted, extract the src attribute
  if (clean.toLowerCase().includes("<iframe")) {
    const srcMatch = clean.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      clean = srcMatch[1].trim();
    } else {
      return {
        valid: false,
        error: "Please use Google Maps → Share → Embed a map → Copy HTML, or paste the Google Maps Embed URL."
      };
    }
  }

  // 2. Reject shortened or standard share links explicitly (maps.app.goo.gl, google.com/maps/place, etc.)
  const lower = clean.toLowerCase();
  if (
    lower.includes("maps.app.goo.gl") ||
    lower.includes("goo.gl/maps") ||
    lower.includes("/maps/place/") ||
    lower.includes("/maps/dir/") ||
    lower.includes("/maps/search/")
  ) {
    return {
      valid: false,
      error: "Please use Google Maps → Share → Embed a map → Copy HTML, or paste the Google Maps Embed URL."
    };
  }

  // 3. Ensure it is a valid Google Maps Embed URL
  const isEmbed =
    (lower.startsWith("https://www.google.com/maps/embed") ||
     lower.startsWith("https://google.com/maps/embed") ||
     lower.startsWith("https://maps.google.com/maps")) &&
    (lower.includes("/embed") || lower.includes("output=embed"));

  if (!isEmbed) {
    return {
      valid: false,
      error: "Please use Google Maps → Share → Embed a map → Copy HTML, or paste the Google Maps Embed URL."
    };
  }

  return {
    valid: true,
    embedUrl: clean
  };
}

/**
 * Helper to check if a given string is a valid embed URL or iframe code.
 */
export function isValidGoogleMapsUrl(input) {
  return parseAndValidateEmbedMapUrl(input).valid;
}

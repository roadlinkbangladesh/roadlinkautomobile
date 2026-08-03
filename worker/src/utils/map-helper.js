/**
 * Helper utilities for parsing, normalizing, and validating Google Maps URLs.
 * Serves as the single source of truth for Google Maps Embed and Navigation handling.
 */

/**
 * Derives a Google Maps navigation/directions URL from a map embed URL, place link, or location details.
 * Google Maps Embed URLs contain a `pb` parameter like:
 * `pb=!1m18!1m12!1m3!1d3652.336495143309!2d90.4143438!3d23.7354316!...!2sFakirerpool%2C%20Dhaka%201000`
 * Note: !3d is latitude, !2d is longitude, !2s is encoded place query/name.
 */
export function deriveNavigationUrl(mapUrl, mapEmbedUrl, title = "", address = "") {
  // If mapUrl is already a valid navigation/directions URL (and not an embed URL), use it
  if (mapUrl && typeof mapUrl === "string") {
    const trimmed = mapUrl.trim();
    if (trimmed && !trimmed.toLowerCase().includes("/embed") && !trimmed.toLowerCase().includes("output=embed")) {
      return trimmed;
    }
  }

  const source = (mapEmbedUrl || mapUrl || "").trim();

  if (source) {
    // 1. Try extracting latitude and longitude from the pb parameter in Google Maps embed URL
    const latMatch = source.match(/!3d([-+]?\d+(?:\.\d+)?)/i);
    const lngMatch = source.match(/!2d([-+]?\d+(?:\.\d+)?)/i);
    if (latMatch && lngMatch) {
      const lat = latMatch[1];
      const lng = lngMatch[1];
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }

    // 2. Try extracting place query string from !2s parameter
    const placeMatch = source.match(/!2s([^!&#]+)/i);
    if (placeMatch && placeMatch[1]) {
      try {
        const decoded = decodeURIComponent(placeMatch[1]);
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(decoded)}`;
      } catch (e) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(placeMatch[1])}`;
      }
    }

    // 3. Try extracting coordinates from standard Google Maps place/search URLs (@lat,lng or q=lat,lng)
    const coordMatch = source.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/i) || source.match(/[?&]q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/i);
    if (coordMatch) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coordMatch[1]},${coordMatch[2]}`;
    }

    // 4. If source is a direct share link or navigation link that isn't /embed
    if (!source.toLowerCase().includes("/embed") && !source.toLowerCase().includes("output=embed")) {
      return source;
    }
  }

  // 5. Fallback: Build directions URL from location title + address
  const query = [title, address].map(s => (s || "").trim()).filter(Boolean).join(" ");
  if (query) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }

  return "#";
}

/**
 * Parses raw input (iframe snippet, embed URL, share link, etc.) and extracts/normalizes:
 * - embedUrl: for <iframe src="...">
 * - navUrl: for "Get Directions" navigation
 */
export function parseAndNormalizeMapInput(input, title = "", address = "") {
  if (!input || typeof input !== "string" || !input.trim()) {
    const fallbackNav = deriveNavigationUrl("", "", title, address);
    let fallbackEmbed = "";
    const query = [title, address].map(s => (s || "").trim()).filter(Boolean).join(" ");
    if (query) {
      fallbackEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    }
    return {
      valid: true,
      embedUrl: fallbackEmbed,
      navUrl: fallbackNav
    };
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
        error: "Invalid iframe HTML snippet. Please copy HTML from Google Maps → Share → Embed a map."
      };
    }
  }

  const lower = clean.toLowerCase();

  // 2. Check if clean is a Google Maps Embed URL (contains /embed or output=embed)
  const isEmbedUrl =
    (lower.startsWith("https://www.google.com/maps/embed") ||
     lower.startsWith("https://google.com/maps/embed") ||
     lower.startsWith("https://maps.google.com/maps")) &&
    (lower.includes("/embed") || lower.includes("output=embed"));

  if (isEmbedUrl) {
    const embedUrl = clean;
    const navUrl = deriveNavigationUrl("", embedUrl, title, address);
    return {
      valid: true,
      embedUrl,
      navUrl
    };
  }

  // 3. Handle Google Maps share links, place links, or direct navigation URLs
  const isGoogleMapsLink =
    lower.includes("maps.app.goo.gl") ||
    lower.includes("goo.gl/maps") ||
    lower.includes("google.com/maps") ||
    lower.includes("maps.google.com");

  if (isGoogleMapsLink) {
    const navUrl = clean;
    let embedUrl = "";
    const coordMatch = clean.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/i) || clean.match(/[?&]q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/i);
    if (coordMatch) {
      embedUrl = `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&output=embed`;
    } else {
      const query = [title, address].map(s => (s || "").trim()).filter(Boolean).join(" ");
      embedUrl = query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : clean;
    }
    return {
      valid: true,
      embedUrl,
      navUrl
    };
  }

  // 4. Generic http/https URL check
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    const navUrl = clean;
    const query = [title, address].map(s => (s || "").trim()).filter(Boolean).join(" ");
    const embedUrl = query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : clean;
    return {
      valid: true,
      embedUrl,
      navUrl
    };
  }

  return {
    valid: false,
    error: "Please paste a valid Google Maps embed iframe, embed URL, or Google Maps link."
  };
}

/**
 * Extracts and validates a Google Maps Embed URL from either iframe HTML code or a direct embed URL.
 * Preserves backward compatibility.
 */
export function parseAndValidateEmbedMapUrl(input, title = "", address = "") {
  const normalized = parseAndNormalizeMapInput(input, title, address);
  if (!normalized.valid) {
    return { valid: false, error: normalized.error };
  }
  return {
    valid: true,
    embedUrl: normalized.embedUrl,
    navUrl: normalized.navUrl
  };
}

/**
 * Helper to check if a given string is a valid embed URL or iframe code.
 */
export function isValidGoogleMapsUrl(input) {
  return parseAndNormalizeMapInput(input).valid;
}


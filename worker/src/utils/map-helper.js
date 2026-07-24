/**
 * Helper utilities for parsing and normalizing Google Maps URLs for embedding and external navigation.
 */

/**
 * Validates whether a given URL string or iframe code is a valid Google Maps reference.
 */
export function isValidGoogleMapsUrl(input) {
  if (!input || typeof input !== "string") return false;
  const clean = input.trim().toLowerCase();
  
  if (clean.includes("<iframe") && clean.includes("google.com/maps")) return true;
  if (clean.includes("maps.app.goo.gl")) return true;
  if (clean.includes("google.com/maps")) return true;
  if (clean.includes("maps.google.com")) return true;
  if (clean.includes("goo.gl/maps")) return true;
  
  return false;
}

/**
 * Generates an embeddable Google Maps iframe URL from any standard Google Maps link or address.
 */
export function deriveEmbedMapUrl(mapInput, address = "") {
  if (!mapInput || typeof mapInput !== "string") {
    return address ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : "";
  }

  const clean = mapInput.trim();

  // 1. If iframe HTML string pasted:
  if (clean.startsWith("<iframe")) {
    const match = clean.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
  }

  // 2. If already an embed URL:
  if (clean.includes("output=embed") || clean.includes("/maps/embed")) {
    return clean;
  }

  // 3. Extract @lat,lng coordinates if present:
  const coordMatch = clean.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) {
    return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&output=embed`;
  }

  // 4. Extract /place/Name if present:
  const placeMatch = clean.match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) {
    const rawPlace = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    return `https://maps.google.com/maps?q=${encodeURIComponent(rawPlace)}&output=embed`;
  }

  // 5. Extract q= parameter if present:
  const qMatch = clean.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    return `https://maps.google.com/maps?q=${qMatch[1]}&output=embed`;
  }

  // 6. Default fallback: use location address or map input as query
  const query = address || clean;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/**
 * Generates a clean external Google Maps navigation link for target="_blank".
 */
export function deriveExternalMapUrl(mapInput, address = "") {
  if (!mapInput || typeof mapInput !== "string") {
    return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "#";
  }

  let clean = mapInput.trim();

  // If iframe string pasted, extract src
  if (clean.startsWith("<iframe")) {
    const match = clean.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) {
      clean = match[1];
    }
  }

  return clean;
}

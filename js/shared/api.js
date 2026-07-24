/**
 * Roadlink Automobiles - Shared API Helper
 * Application-agnostic HTTP client wrapper that constructs URLs using API_BASE_URL
 * and standardizes fetch communication for all frontend modules.
 */

import { API_BASE_URL } from "./config.js";

/**
 * Normalizes and builds a full URL using API_BASE_URL and the specified endpoint path.
 * @param {string} endpoint - Relative API path (e.g. "/api/v1/public/vehicles") or full URL
 * @returns {string} Fully qualified URL string
 */
export function buildUrl(endpoint) {
  if (!endpoint) return API_BASE_URL;
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const cleanBase = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

/**
 * Shared helper responsible for generating public media URLs.
 * Converts stored object keys or paths into deployment-agnostic public media URLs.
 * Handles keys ("uploads/roadlink/vehicles/RL-2025-001/front.jpg"), relative paths, and absolute URLs.
 * @param {string} objectKey - Object key or URL string
 * @returns {string} Fully qualified media URL string
 */
export function getPublicFileUrl(objectKey) {
  if (!objectKey || typeof objectKey !== "string") return "";
  const trimmed = objectKey.trim();
  if (!trimmed) return "";

  // Data URLs (base64) remain as-is
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  // Handle full HTTP/HTTPS URLs
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes("uploads/")) {
      const key = trimmed.substring(trimmed.indexOf("uploads/"));
      return buildUrl(`/api/v1/public/files/${key}`);
    }
    return trimmed;
  }

  // Handle relative API paths
  if (trimmed.startsWith("/api/")) {
    return buildUrl(trimmed);
  }

  // Clean leading slashes and construct public file endpoint URL
  const cleanKey = trimmed.replace(/^\/+/, "");
  return buildUrl(`/api/v1/public/files/${cleanKey}`);
}

/**
 * MediaService - Centralized media URL generator and key helper.
 */
export const MediaService = {
  getPublicUrl(objectKey) {
    return getPublicFileUrl(objectKey);
  }
};

/**
 * Alias for backward compatibility
 */
export const resolveMediaUrl = getPublicFileUrl;

/**
 * Generic API HTTP Request Wrapper.
 *
 * @param {string} endpoint - API path (e.g. "/api/v1/public/settings")
 * @param {Object} [options={}] - Request configuration options (method, headers, body, etc.)
 * @returns {Promise<Response>} Native fetch Response object
 */
export async function apiRequest(endpoint, options = {}) {
  const url = buildUrl(endpoint);

  const headers = {
    ...(options.headers || {})
  };

  // Set default Content-Type to application/json for non-FormData requests with body
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  const config = {
    ...options,
    headers
  };

  return await fetch(url, config);
}

/**
 * Convenient REST verb methods for application-agnostic requests.
 */
export const api = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { 
    ...options, 
    method: "POST", 
    body: body instanceof FormData || typeof body === "string" ? body : JSON.stringify(body) 
  }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { 
    ...options, 
    method: "PUT", 
    body: body instanceof FormData || typeof body === "string" ? body : JSON.stringify(body) 
  }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { 
    ...options, 
    method: "PATCH", 
    body: body instanceof FormData || typeof body === "string" ? body : JSON.stringify(body) 
  }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: "DELETE" })
};

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

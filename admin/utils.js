/**
 * Roadlink Automobiles - Admin Utilities
 * Small shared helpers for DOM selection and manipulation.
 */

let unauthorizedHandler = null;

import { API_BASE_URL } from "./config.js";

/**
 * Shorthand for document.getElementById
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Shared API Fetch helper with automatic authorization headers and base URL.
 * @param {string} endpoint - The api path (e.g. "/api/v1/admin/settings")
 * @param {Object} options - Request configuration options
 * @returns {Promise<Response>} Fetch Response object
 */
export async function apiFetch(endpoint, options = {}) {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Registers a global callback that is invoked whenever
 * the API returns HTTP 401 Unauthorized.
 *
 * @param {Function} handler
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

/**
 * Invokes the registered unauthorized handler.
 */
export function handleUnauthorized() {
  if (typeof unauthorizedHandler === "function") {
    unauthorizedHandler();
  }
}

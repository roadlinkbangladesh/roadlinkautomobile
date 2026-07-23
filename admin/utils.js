/**
 * Roadlink Automobiles - Admin Utilities
 * Small shared helpers for DOM selection and manipulation.
 */

let unauthorizedHandler = null;

import { apiRequest } from "../js/shared/api.js";

/**
 * Shorthand for document.getElementById
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Shared Admin API Fetch helper with automatic authorization headers and 401 handling.
 * Delegates low-level URL resolution and fetch execution to shared API helper.
 * @param {string} endpoint - The api path (e.g. "/api/v1/admin/settings")
 * @param {Object} options - Request configuration options
 * @returns {Promise<Response>} Fetch Response object
 */
export async function apiFetch(endpoint, options = {}) {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");

  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await apiRequest(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401 && !endpoint.includes("/auth/login")) {
    handleUnauthorized();
  }

  return response;
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

/**
 * Escapes HTML characters to prevent XSS injection in dynamic text rendering.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


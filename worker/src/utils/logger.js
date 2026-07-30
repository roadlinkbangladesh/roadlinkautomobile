/**
 * Roadlink Automobiles - Structured Diagnostic Logger Utility
 * Provides standardized JSON console logging with request metadata context.
 */

export const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR"
};

/**
 * Extracts diagnostic request context from standard Request object.
 * @param {Request} [request]
 * @param {Object} [user]
 * @returns {Object}
 */
export function extractRequestContext(request, user = null) {
  if (!request) return {};

  const context = {};

  try {
    const url = new URL(request.url);
    context.method = request.method;
    context.path = url.pathname;
    if (url.search) {
      context.search = url.search;
    }

    const cfIp = request.headers.get("cf-connecting-ip");
    const forwardedFor = request.headers.get("x-forwarded-for");
    context.ip = cfIp || (forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1");

    const userAgent = request.headers.get("user-agent");
    if (userAgent) {
      context.userAgent = userAgent;
    }
  } catch (e) {
    // Fallback if URL parsing fails
  }

  const activeUser = user || request?.user;
  if (activeUser) {
    context.userId = activeUser.id;
    if (activeUser.email) context.userEmail = activeUser.email;
    if (activeUser.role) context.userRole = activeUser.role;
  }

  return context;
}

/**
 * Formats structured log entry as JSON.
 * @param {string} level
 * @param {string|Error|Object} message
 * @param {Object} [context={}]
 * @returns {string}
 */
function formatLogPayload(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === "string" ? message : (message?.message || String(message))
  };

  if (context && typeof context === "object") {
    if (context.error instanceof Error) {
      payload.error = {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack
      };
      const { error, ...rest } = context;
      Object.assign(payload, rest);
    } else if (context instanceof Error) {
      payload.error = {
        name: context.name,
        message: context.message,
        stack: context.stack
      };
    } else {
      Object.assign(payload, context);
    }
  }

  return JSON.stringify(payload);
}

export const logger = {
  info(message, context = {}) {
    console.log(formatLogPayload(LOG_LEVELS.INFO, message, context));
  },

  warn(message, context = {}) {
    console.warn(formatLogPayload(LOG_LEVELS.WARN, message, context));
  },

  error(message, context = {}) {
    console.error(formatLogPayload(LOG_LEVELS.ERROR, message, context));
  },

  debug(message, context = {}) {
    console.log(formatLogPayload(LOG_LEVELS.DEBUG, message, context));
  },

  /**
   * Log an HTTP request event
   */
  request(request, message = "HTTP Request", extraContext = {}) {
    const reqCtx = extractRequestContext(request);
    this.info(message, { ...reqCtx, ...extraContext });
  },

  /**
   * Log an HTTP request error event
   */
  requestError(request, error, extraContext = {}) {
    const reqCtx = extractRequestContext(request);
    this.error(error?.message || "HTTP Request Error", {
      ...reqCtx,
      error,
      ...extraContext
    });
  }
};

export default logger;

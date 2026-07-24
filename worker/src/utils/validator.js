/**
 * Centralized Validation & Business Rule Enforcement Utilities
 */

export const VEHICLE_STATUSES = ["draft", "available", "incoming", "reserved", "sold", "archived"];

/**
 * Validates string format and constraints
 */
export function validateString(value, options = {}) {
  const { name = "Field", required = false, minLength = 0, maxLength = 255, pattern = null } = options;
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) return `${name} is required.`;
    return null;
  }
  const str = String(value).trim();
  if (str.length < minLength) return `${name} must be at least ${minLength} characters.`;
  if (maxLength && str.length > maxLength) return `${name} cannot exceed ${maxLength} characters.`;
  if (pattern && !pattern.test(str)) return `${name} format is invalid.`;
  return null;
}

/**
 * Validates numeric values and ranges
 */
export function validateNumber(value, options = {}) {
  const { name = "Field", required = false, min = null, max = null, integer = false } = options;
  if (value === undefined || value === null || value === "") {
    if (required) return `${name} is required.`;
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) return `${name} must be a valid number.`;
  if (integer && !Number.isInteger(num)) return `${name} must be an integer.`;
  if (min !== null && num < min) return `${name} cannot be less than ${min}.`;
  if (max !== null && num > max) return `${name} cannot exceed ${max}.`;
  return null;
}

/**
 * Validates email address format
 */
export function validateEmail(email, required = false) {
  if (!email || !String(email).trim()) {
    if (required) return "Email address is required.";
    return null;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email).trim())) {
    return "Please enter a valid email address.";
  }
  return null;
}

/**
 * Validates phone number format
 */
export function validatePhone(phone, required = false) {
  if (!phone || !String(phone).trim()) {
    if (required) return "Phone number is required.";
    return null;
  }
  const phoneRegex = /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,20}$/;
  if (!phoneRegex.test(String(phone).trim())) {
    return "Please enter a valid phone number.";
  }
  return null;
}

/**
 * Validates URL format or object key path
 */
export function validateUrlOrKey(url, required = false, name = "URL") {
  if (!url || !String(url).trim()) {
    if (required) return `${name} is required.`;
    return null;
  }
  const str = String(url).trim();
  if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("/") || str.startsWith("uploads/")) {
    return null;
  }
  return `${name} must be a valid web URL or storage path.`;
}

/**
 * Validates stock number format (alphanumeric, hyphens, underscores)
 */
export function validateStockNumber(stockNumber) {
  if (!stockNumber || !String(stockNumber).trim()) return "Stock number is required.";
  const clean = String(stockNumber).trim();
  if (clean.length < 2 || clean.length > 50) return "Stock number must be between 2 and 50 characters.";
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) return "Stock number can only contain letters, numbers, hyphens, and underscores.";
  return null;
}

/**
 * Validates slug format
 */
export function validateSlug(slug) {
  if (!slug || !String(slug).trim()) return "Slug is required.";
  const clean = String(slug).trim();
  if (!/^[a-z0-9-]+$/.test(clean)) return "Slug can only contain lowercase letters, numbers, and hyphens.";
  return null;
}

/**
 * Validates vehicle lifecycle state transitions
 */
export function validateVehicleStateTransition(currentStatus, newStatus, isRestore = false) {
  const current = (currentStatus || "available").toLowerCase();
  const next = (newStatus || "available").toLowerCase();

  if (!VEHICLE_STATUSES.includes(next)) {
    return `Invalid status "${next}". Allowed statuses: ${VEHICLE_STATUSES.join(", ")}.`;
  }

  if (current === "sold" && next === "available" && !isRestore) {
    return "Transitioning a vehicle from Sold back to Available requires an explicit Restore action.";
  }

  return null;
}

/**
 * Validates file upload against platform bounds
 */
export function validateFileUpload(file, category, config) {
  if (!file) return "No file selected for upload.";

  const size = file.size || 0;
  const fileName = file.name || "";
  const mimeType = (file.type || "").toLowerCase();
  const ext = fileName.split(".").pop().toLowerCase() || "";

  const isDocument = category === "documents" || category === "document" || category === "auction_sheet" || category === "auction-sheet" || ext === "pdf";

  if (isDocument) {
    if (ext !== "pdf" && mimeType !== "application/pdf") {
      return "Auction sheets and documents must be in PDF format.";
    }
    const maxPdfBytes = (config.max_auction_sheet_mb || 20) * 1024 * 1024;
    if (size > maxPdfBytes) {
      return `Auction sheet PDF file size exceeds maximum allowed limit of ${config.max_auction_sheet_mb}MB.`;
    }
  } else {
    const validImageMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
    const validImageExts = ["jpg", "jpeg", "png", "webp", "heic"];
    if (!validImageExts.includes(ext) && !validImageMimes.some(m => mimeType.includes(m))) {
      return "Uploaded file must be a valid image (JPEG, PNG, WEBP).";
    }
    const maxImgBytes = (config.max_image_upload_mb || 5) * 1024 * 1024;
    if (size > maxImgBytes) {
      return `Image file size exceeds maximum allowed limit of ${config.max_image_upload_mb}MB.`;
    }
  }

  return null;
}

/**
 * Roadlink Automobiles - Inventory Service Integration Layer
 * Replaces localStorage persistence with Cloudflare Worker D1/R2 REST APIs.
 */

import { apiRequest, getPublicFileUrl, resolveMediaUrl, MediaService } from "./shared/api.js";

let cachedVehicles = [];
let publicVehicles = [];
let adminVehicles = [];
let isLoaded = false;

/**
 * Normalizes vehicle media URLs and auction sheet availability flags.
 */
export function normalizeVehicleMedia(v) {
  if (!v) return v;
  const images = (v.images || []).map(resolveMediaUrl);
  const exteriorImages = (v.exteriorImages || []).map(resolveMediaUrl);
  const interiorImages = (v.interiorImages || []).map(resolveMediaUrl);
  const rawSheet = v.auctionSheetUrl || "";
  const auctionSheetUrl = resolveMediaUrl(rawSheet);
  const coverImage = resolveMediaUrl(v.coverImage) || exteriorImages[0] || images[0] || "";
  const posterImage = resolveMediaUrl(v.posterImage) || coverImage;

  return {
    ...v,
    images: images.length > 0 ? images : (coverImage ? [coverImage] : []),
    exteriorImages: exteriorImages.length > 0 ? exteriorImages : (coverImage ? [coverImage] : []),
    interiorImages,
    auctionSheetUrl,
    coverImage,
    posterImage,
    auctionSheetAvailable: Boolean(v.auctionSheetAvailable && rawSheet && rawSheet.trim() !== "")
  };
}

function getToken() {
  if (typeof sessionStorage !== "undefined") {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (token) return token;
  }
  return null;
}

export function isAdminContext() {
  if (typeof window !== "undefined") {
    return window.location.pathname.includes("/admin");
  }
  return false;
}

/**
 * Fetches published vehicles for public portal from Public REST API.
 */
export async function loadVehiclesAsync(params = {}, forceAdmin = false) {
  if (forceAdmin || isAdminContext()) {
    return loadAdminVehiclesAsync(params);
  }

  let endpoint = "/api/v1/public/vehicles";
  
  const queryParts = [];
  if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
  if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
  if (params.make) queryParts.push(`make=${encodeURIComponent(params.make)}`);
  if (params.sort) queryParts.push(`sort=${encodeURIComponent(params.sort)}`);
  if (params.page) queryParts.push(`page=${params.page}`);
  if (params.limit) queryParts.push(`limit=${params.limit || 100}`);

  if (queryParts.length > 0) {
    endpoint += `?${queryParts.join("&")}`;
  }

  try {
    const response = await apiRequest(endpoint);
    const contentType = response.headers.get("content-type") || "";
    
    if (response.ok && contentType.includes("application/json")) {
      const payload = await response.json();
      if (payload && payload.success && payload.data) {
        let items = (payload.data.items || []).map(normalizeVehicleMedia);
        // Public portal inventory filtering: Exclude unpublished, draft, and sold vehicles
        items = items.filter(v => 
          v.published !== false && 
          v.isPublished !== false &&
          v.status?.toLowerCase() !== 'draft' && 
          v.status?.toLowerCase() !== 'sold'
        );
        publicVehicles = items;
        if (!isAdminContext()) {
          cachedVehicles = items;
          isLoaded = true;
        }
        return items;
      }
    }
  } catch (err) {
    console.error("Failed to load vehicles from Public Worker API:", err);
  }

  return publicVehicles.length > 0 ? publicVehicles : cachedVehicles;
}

/**
 * Explicit helper to fetch all vehicles (including sold, draft, unpublished) strictly from Admin REST API.
 */
export async function loadAdminVehiclesAsync(params = {}) {
  const token = getToken();
  let endpoint = "/api/v1/admin/vehicles";

  const queryParts = [];
  if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
  if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
  if (params.make) queryParts.push(`make=${encodeURIComponent(params.make)}`);
  if (params.sort) queryParts.push(`sort=${encodeURIComponent(params.sort)}`);
  if (params.page) queryParts.push(`page=${params.page}`);
  if (params.limit) queryParts.push(`limit=${params.limit || 100}`);

  if (queryParts.length > 0) {
    endpoint += `?${queryParts.join("&")}`;
  }

  try {
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await apiRequest(endpoint, { headers });
    const contentType = response.headers.get("content-type") || "";

    if (response.ok && contentType.includes("application/json")) {
      const payload = await response.json();
      if (payload && payload.success && payload.data) {
        const items = (payload.data.items || []).map(normalizeVehicleMedia);
        adminVehicles = items;
        cachedVehicles = items;
        isLoaded = true;
        return adminVehicles;
      }
    } else if (!response.ok) {
      console.warn(`Admin vehicles request returned status ${response.status}`);
    }
  } catch (err) {
    console.error("Failed to load vehicles from Admin Worker API:", err);
  }

  return adminVehicles.length > 0 ? adminVehicles : cachedVehicles;
}

/**
 * Returns cached vehicles or triggers async load.
 * For public portal viewers, returns publicVehicles or filters out unpublished, draft, and sold vehicles.
 * For admin viewers, returns all adminVehicles (including sold, draft, reserved).
 */
export function getAllVehicles() {
  if (isAdminContext()) {
    if (adminVehicles.length > 0) return adminVehicles;
    if (!isLoaded && typeof window !== "undefined") {
      loadAdminVehiclesAsync();
    }
    return adminVehicles.length > 0 ? adminVehicles : cachedVehicles;
  }

  if (publicVehicles.length > 0) return publicVehicles;
  if (!isLoaded && typeof window !== "undefined") {
    loadVehiclesAsync();
  }

  return cachedVehicles.filter(v => 
    v.published !== false && 
    v.isPublished !== false &&
    v.status?.toLowerCase() !== 'draft' && 
    v.status?.toLowerCase() !== 'sold'
  );
}

/**
 * Synonym for getAllVehicles
 */
export function loadVehicles() {
  return getAllVehicles();
}

/**
 * Placeholder for legacy saveVehicles function.
 */
export function saveVehicles(vehicles) {
  cachedVehicles = vehicles;
  if (isAdminContext()) adminVehicles = vehicles;
  else publicVehicles = vehicles;
}

/**
 * Retrieves a single published vehicle by ID or stock number strictly from the public REST API.
 */
export async function getVehicleByIdAsync(id) {
  const endpoint = `/api/v1/public/vehicles/${encodeURIComponent(id)}`;
  
  try {
    const response = await apiRequest(endpoint);
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("application/json")) {
      const payload = await response.json();
      if (payload && payload.success && payload.data) {
        return normalizeVehicleMedia(payload.data);
      }
    }
  } catch (err) {
    console.error("Failed to get vehicle by ID from Public Worker API:", err);
  }

  return getAllVehicles().find(v => v.id === String(id) || v.stockNumber === String(id)) || null;
}

export function getVehicleById(id) {
  return getAllVehicles().find(v => v.id === String(id) || v.stockNumber === String(id)) || null;
}

/**
 * Adds a new vehicle via POST /api/v1/admin/vehicles.
 */
export async function addVehicleAsync(vehicle) {
  const token = getToken();
  if (!token) throw new Error("Unauthorized: Admin login token required.");

  const response = await apiRequest("/api/v1/admin/vehicles", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(vehicle)
  });

  const contentType = response.headers.get("content-type") || "";
  let payload = {};
  if (contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Failed to create vehicle (HTTP ${response.status}).`);
  }

  await loadAdminVehiclesAsync();
  return payload.data;
}

export function addVehicle(vehicle) {
  addVehicleAsync(vehicle).catch(err => console.error("addVehicle error:", err));
  return vehicle;
}

/**
 * Updates an existing vehicle via PUT /api/v1/admin/vehicles/:id.
 */
export async function updateVehicleAsync(id, updatedFields) {
  const token = getToken();
  if (!token) throw new Error("Unauthorized: Admin login token required.");

  const response = await apiRequest(`/api/v1/admin/vehicles/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(updatedFields)
  });

  const contentType = response.headers.get("content-type") || "";
  let payload = {};
  if (contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Failed to update vehicle (HTTP ${response.status}).`);
  }

  await loadAdminVehiclesAsync();
  return payload.data;
}

export function updateVehicle(id, updatedFields) {
  updateVehicleAsync(id, updatedFields).catch(err => console.error("updateVehicle error:", err));
  return { id, ...updatedFields };
}

/**
 * Deletes a vehicle via DELETE /api/v1/admin/vehicles/:id.
 */
export async function deleteVehicleAsync(id) {
  const token = getToken();
  if (!token) throw new Error("Unauthorized: Admin login token required.");

  const response = await apiRequest(`/api/v1/admin/vehicles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const contentType = response.headers.get("content-type") || "";
  let payload = {};
  if (contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Failed to delete vehicle (HTTP ${response.status}).`);
  }

  await loadAdminVehiclesAsync();
  return true;
}

export function deleteVehicle(id) {
  deleteVehicleAsync(id).catch(err => console.error("deleteVehicle error:", err));
  return true;
}

/**
 * Updates vehicle status / publish state via PUT /api/v1/admin/vehicles/:id/status.
 */
export async function updateVehicleStatusAsync(id, statusData) {
  const token = getToken();
  if (!token) throw new Error("Unauthorized: Admin login token required.");

  const response = await apiRequest(`/api/v1/admin/vehicles/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(statusData)
  });

  const contentType = response.headers.get("content-type") || "";
  let payload = {};
  if (contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Failed to update vehicle status (HTTP ${response.status}).`);
  }

  await loadAdminVehiclesAsync();
  return payload.data;
}

/**
 * Uploads a file (image or PDF) to R2 via POST /api/v1/admin/upload.
 * @param {File} file - The file object to upload
 * @param {string} [stockNumber=""] - Optional vehicle stock number context for folder structure
 */
export async function uploadFileAsync(file, stockNumber = "") {
  const token = getToken();
  if (!token) throw new Error("Unauthorized: Admin login token required.");

  const formData = new FormData();
  formData.append("file", file);
  if (stockNumber) {
    formData.append("stockNumber", stockNumber);
  }

  const response = await apiRequest("/api/v1/admin/upload", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData
  });

  const contentType = response.headers.get("content-type") || "";
  let payload = {};
  if (contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Failed to upload file (HTTP ${response.status}).`);
  }

  return payload.data; // { url, key, name, type }
}

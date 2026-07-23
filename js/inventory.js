/**
 * Roadlink Automobiles - Inventory Service Integration Layer
 * Replaces localStorage persistence with Cloudflare Worker D1/R2 REST APIs.
 */

let cachedVehicles = [];
let isLoaded = false;

function getToken() {
  if (typeof sessionStorage !== "undefined") {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (token) return token;
  }
  return null;
}

/**
 * Fetches published vehicles from the public REST API backend.
 */
export async function loadVehiclesAsync(params = {}) {
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
    const response = await fetch(endpoint);
    if (response.ok) {
      const payload = await response.json();
      if (payload && payload.success && payload.data) {
        cachedVehicles = payload.data.items || [];
        isLoaded = true;
        return cachedVehicles;
      }
    }
  } catch (err) {
    console.error("Failed to load vehicles from Public Worker API:", err);
  }

  return cachedVehicles;
}

/**
 * Returns cached vehicles or triggers async load.
 */
export function getAllVehicles() {
  if (!isLoaded && typeof window !== "undefined") {
    loadVehiclesAsync();
  }
  return cachedVehicles;
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
}

/**
 * Retrieves a single published vehicle by ID or stock number from the public REST API.
 */
export async function getVehicleByIdAsync(id) {
  const endpoint = `/api/v1/public/vehicles/${encodeURIComponent(id)}`;
  
  try {
    const response = await fetch(endpoint);
    if (response.ok) {
      const payload = await response.json();
      if (payload && payload.success && payload.data) {
        return payload.data;
      }
    }
  } catch (err) {
    console.error("Failed to get vehicle by ID from Public Worker API:", err);
  }

  return cachedVehicles.find(v => v.id === id || v.stockNumber === id) || null;
}

export function getVehicleById(id) {
  return cachedVehicles.find(v => v.id === id || v.stockNumber === id) || null;
}

/**
 * Adds a new vehicle via POST /api/v1/admin/vehicles.
 */
export async function addVehicleAsync(vehicle) {
  const token = getToken();
  if (!token) throw new Error("Unauthorized: Admin login token required.");

  const response = await fetch("/api/v1/admin/vehicles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(vehicle)
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to create vehicle.");
  }

  await loadVehiclesAsync();
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

  const response = await fetch(`/api/v1/admin/vehicles/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(updatedFields)
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to update vehicle.");
  }

  await loadVehiclesAsync();
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

  const response = await fetch(`/api/v1/admin/vehicles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to delete vehicle.");
  }

  await loadVehiclesAsync();
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

  const response = await fetch(`/api/v1/admin/vehicles/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(statusData)
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to update vehicle status.");
  }

  await loadVehiclesAsync();
  return payload.data;
}

/**
 * Uploads a file (image or PDF) to R2 via POST /api/v1/admin/upload.
 */
export async function uploadFileAsync(file) {
  const token = getToken();
  if (!token) throw new Error("Unauthorized: Admin login token required.");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/v1/admin/upload", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to upload file to R2.");
  }

  return payload.data; // { url, key, name, type }
}

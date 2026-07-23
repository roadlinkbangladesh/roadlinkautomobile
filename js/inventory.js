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

function isAdminContext() {
  if (typeof window !== "undefined") {
    return window.location.pathname.includes("/admin");
  }
  return false;
}

/**
 * Fetches vehicles from REST API backend.
 * Automatically selects Admin or Public endpoint based on window context or forceAdmin flag.
 */
export async function loadVehiclesAsync(params = {}, forceAdmin = false) {
  const useAdmin = forceAdmin || isAdminContext();
  const token = getToken();
  let endpoint = useAdmin ? "/api/v1/admin/vehicles" : "/api/v1/public/vehicles";
  
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
    if (useAdmin && token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, { headers });
    if (response.ok) {
      const payload = await response.json();
      if (payload && payload.success && payload.data) {
        let items = payload.data.items || [];
        if (!useAdmin) {
          // Public portal inventory filtering: Exclude unpublished, draft, and sold vehicles
          items = items.filter(v => 
            v.published !== false && 
            v.isPublished !== false &&
            v.status?.toLowerCase() !== 'draft' && 
            v.status?.toLowerCase() !== 'sold'
          );
        }
        cachedVehicles = items;
        isLoaded = true;
        return cachedVehicles;
      }
    }
  } catch (err) {
    console.error(`Failed to load vehicles from ${useAdmin ? "Admin" : "Public"} Worker API:`, err);
  }

  return cachedVehicles;
}

/**
 * Explicit helper to fetch all vehicles from Admin REST API.
 */
export async function loadAdminVehiclesAsync(params = {}) {
  return loadVehiclesAsync(params, true);
}

/**
 * Returns cached vehicles or triggers async load.
 * For public portal viewers, filters out unpublished, draft, and sold vehicles.
 */
export function getAllVehicles() {
  if (!isLoaded && typeof window !== "undefined") {
    if (isAdminContext()) {
      loadAdminVehiclesAsync();
    } else {
      loadVehiclesAsync();
    }
  }

  if (!isAdminContext()) {
    return cachedVehicles.filter(v => 
      v.published !== false && 
      v.isPublished !== false &&
      v.status?.toLowerCase() !== 'draft' && 
      v.status?.toLowerCase() !== 'sold'
    );
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
 * Retrieves a single published vehicle by ID or stock number strictly from the public REST API.
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

  await loadAdminVehiclesAsync();
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

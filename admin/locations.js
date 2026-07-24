/**
 * Roadlink Automobiles - Business Locations Management Module
 * Manages physical showrooms, corporate offices, contact phone numbers,
 * map embed links, visibility toggles, and default location assignment.
 */

import { $, apiFetch, sanitizeHTML } from "./utils.js";
import { hasPermission } from "./auth.js";

let locationsData = [];
let isSubmitting = false;

/**
 * Initializes the Business Locations view
 */
export async function initLocationsView() {
  bindLocationsEvents();
  await loadLocationsList();
}

/**
 * Binds DOM event listeners for locations view
 */
function bindLocationsEvents() {
  const btnAdd = $("btn-add-location");
  if (btnAdd) {
    btnAdd.onclick = () => openLocationModal();
  }

  const btnCloseModal = $("btn-close-location-modal");
  const btnCancelModal = $("btn-cancel-location");
  if (btnCloseModal) btnCloseModal.onclick = closeLocationModal;
  if (btnCancelModal) btnCancelModal.onclick = closeLocationModal;

  const phoneAddBtn = $("btn-add-phone-field");
  if (phoneAddBtn) {
    phoneAddBtn.onclick = () => appendPhoneInputField("");
  }

  const form = $("location-form");
  if (form) {
    form.onsubmit = handleLocationFormSubmit;
  }
}

/**
 * Loads all business locations from backend API
 */
export async function loadLocationsList() {
  const tbody = $("locations-table-body");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
          <div class="spinner" style="width: 20px; height: 20px;"></div>
          <span>Loading business locations...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await apiFetch("/api/v1/admin/locations");
    if (!response.ok) {
      throw new Error("Failed to load business locations.");
    }

    const payload = await response.json();
    locationsData = payload.data || [];
    renderLocationsTable(locationsData);
  } catch (error) {
    console.error("Error loading locations:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; color: var(--primary-red);">
          Failed to load business locations. Please check your permissions or try refreshing.
        </td>
      </tr>
    `;
  }
}

/**
 * Renders locations inside the table view
 */
function renderLocationsTable(locations) {
  const tbody = $("locations-table-body");
  if (!tbody) return;

  if (locations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
          No business locations found. Click <strong>Add Business Location</strong> above to create one.
        </td>
      </tr>
    `;
    return;
  }

  const canManage = hasPermission("locations.manage") || hasPermission("settings.edit");

  tbody.innerHTML = locations.map((loc, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === locations.length - 1;
    const phonesList = (loc.phones || []).map(p => `
      <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <a href="tel:${sanitizeHTML(p).replace(/[^0-9+]/g, '')}" style="color: inherit; text-decoration: none;">${sanitizeHTML(p)}</a>
      </div>
    `).join('') || '<span style="color: var(--text-muted); font-size: 0.8rem;">No phones added</span>';

    return `
      <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
        <td style="padding: 14px 16px; vertical-align: middle;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-weight: 700; width: 18px; text-align: center;">${loc.displayOrder || (idx + 1)}</span>
            ${canManage ? `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <button type="button" class="btn-order-up" data-id="${loc.id}" ${isFirst ? 'disabled style="opacity:0.3; cursor:default;"' : 'style="background:none; border:none; cursor:pointer; padding:2px; color:var(--text-muted);"'}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up"><path d="m18 15-6-6-6 6"/></svg>
                </button>
                <button type="button" class="btn-order-down" data-id="${loc.id}" ${isLast ? 'disabled style="opacity:0.3; cursor:default;"' : 'style="background:none; border:none; cursor:pointer; padding:2px; color:var(--text-muted);"'}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>
                </button>
              </div>
            ` : ''}
          </div>
        </td>
        <td style="padding: 14px 16px; vertical-align: middle;">
          <div style="font-weight: 700; color: var(--text-dark); font-size: 0.95rem;">${sanitizeHTML(loc.title)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">slug: ${sanitizeHTML(loc.slug)}</div>
          ${loc.isDefault ? `
            <span style="display: inline-block; margin-top: 4px; padding: 2px 8px; background: rgba(37, 99, 235, 0.1); color: var(--primary-blue); font-size: 0.75rem; font-weight: 700; border-radius: 12px; border: 1px solid rgba(37, 99, 235, 0.2);">
              ★ Default Location
            </span>
          ` : ''}
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; max-width: 250px;">
          <div style="line-height: 1.4; color: var(--text-dark);">${sanitizeHTML(loc.address)}</div>
          ${loc.mapUrl ? `
            <a href="${sanitizeHTML(loc.mapUrl)}" target="_blank" rel="noopener" style="font-size: 0.75rem; color: var(--primary-blue); text-decoration: underline; display: inline-flex; align-items: center; gap: 3px; margin-top: 4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              View Map
            </a>
          ` : ''}
        </td>
        <td style="padding: 14px 16px; vertical-align: middle;">
          <div style="display: flex; flex-direction: column; gap: 4px;">${phonesList}</div>
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; text-align: center;">
          ${loc.isVisible ? `
            <span style="padding: 4px 10px; background: rgba(34, 197, 94, 0.1); color: #16a34a; font-size: 0.75rem; font-weight: 600; border-radius: 12px; border: 1px solid rgba(34, 197, 94, 0.2);">
              Visible
            </span>
          ` : `
            <span style="padding: 4px 10px; background: rgba(100, 116, 139, 0.1); color: #64748b; font-size: 0.75rem; font-weight: 600; border-radius: 12px; border: 1px solid rgba(100, 116, 139, 0.2);">
              Hidden
            </span>
          `}
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; text-align: right;">
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
            ${!loc.isDefault && canManage ? `
              <button type="button" class="btn-make-default btn btn-secondary" data-id="${loc.id}" title="Make default location" style="padding: 5px 10px; font-size: 0.75rem; height: auto;">
                Set Default
              </button>
            ` : ''}
            ${canManage ? `
              <button type="button" class="btn-edit-loc btn btn-secondary" data-id="${loc.id}" style="padding: 5px 10px; font-size: 0.75rem; height: auto;">
                Edit
              </button>
              <button type="button" class="btn-delete-loc btn btn-danger" data-id="${loc.id}" ${loc.isDefault || locations.length <= 1 ? 'disabled title="Default or last location cannot be deleted"' : ''} style="padding: 5px 10px; font-size: 0.75rem; height: auto; ${loc.isDefault || locations.length <= 1 ? 'opacity: 0.4; cursor: not-allowed;' : ''}">
                Delete
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind Row Action Buttons
  tbody.querySelectorAll(".btn-order-up").forEach(btn => {
    btn.onclick = () => moveLocationOrder(parseInt(btn.dataset.id, 10), -1);
  });
  tbody.querySelectorAll(".btn-order-down").forEach(btn => {
    btn.onclick = () => moveLocationOrder(parseInt(btn.dataset.id, 10), 1);
  });
  tbody.querySelectorAll(".btn-make-default").forEach(btn => {
    btn.onclick = () => handleSetDefault(parseInt(btn.dataset.id, 10));
  });
  tbody.querySelectorAll(".btn-edit-loc").forEach(btn => {
    btn.onclick = () => editLocation(parseInt(btn.dataset.id, 10));
  });
  tbody.querySelectorAll(".btn-delete-loc").forEach(btn => {
    btn.onclick = () => handleDeleteLocation(parseInt(btn.dataset.id, 10));
  });
}

/**
 * Handles location modal opening
 */
function openLocationModal(locationObj = null) {
  const modal = $("location-modal");
  const modalTitle = $("location-modal-title");
  const locIdInput = $("loc-id-input");
  const titleInput = $("loc-title");
  const slugHint = $("loc-slug-hint");
  const addressInput = $("loc-address");
  const mapUrlInput = $("loc-map-url");
  const isVisibleCheck = $("loc-is-visible");
  const isDefaultCheck = $("loc-is-default");

  if (!modal) return;

  // Clear phone container
  const phonesContainer = $("loc-phones-container");
  if (phonesContainer) phonesContainer.innerHTML = "";

  if (locationObj) {
    if (modalTitle) modalTitle.textContent = "Edit Business Location";
    if (locIdInput) locIdInput.value = locationObj.id;
    if (titleInput) titleInput.value = locationObj.title || "";
    if (slugHint) slugHint.textContent = `System Identifier (Slug): '${locationObj.slug}' (Immutable identifier).`;
    if (addressInput) addressInput.value = locationObj.address || "";
    if (mapUrlInput) mapUrlInput.value = locationObj.mapUrl || "";
    if (isVisibleCheck) isVisibleCheck.checked = Boolean(locationObj.isVisible);
    if (isDefaultCheck) {
      isDefaultCheck.checked = Boolean(locationObj.isDefault);
      // Disable unchecking if it's currently the default location
      isDefaultCheck.disabled = Boolean(locationObj.isDefault);
    }

    const phones = Array.isArray(locationObj.phones) && locationObj.phones.length > 0 ? locationObj.phones : [""];
    phones.forEach(p => appendPhoneInputField(p));
  } else {
    if (modalTitle) modalTitle.textContent = "Add Business Location";
    if (locIdInput) locIdInput.value = "";
    if (titleInput) titleInput.value = "";
    if (slugHint) slugHint.textContent = "System identifier (slug) will be generated automatically and remain stable.";
    if (addressInput) addressInput.value = "";
    if (mapUrlInput) mapUrlInput.value = "";
    if (isVisibleCheck) isVisibleCheck.checked = true;
    if (isDefaultCheck) {
      isDefaultCheck.checked = locationsData.length === 0;
      isDefaultCheck.disabled = false;
    }
    appendPhoneInputField("");
  }

  modal.style.display = "flex";
}

/**
 * Closes the location modal
 */
function closeLocationModal() {
  const modal = $("location-modal");
  if (modal) modal.style.display = "none";
}

/**
 * Appends a phone number input row inside the modal
 */
function appendPhoneInputField(val = "") {
  const container = $("loc-phones-container");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "phone-input-row";
  row.style.cssText = "display: flex; gap: 8px; align-items: center;";

  row.innerHTML = `
    <input type="text" class="form-control loc-phone-val" placeholder="e.g. +880 1311-503840" value="${sanitizeHTML(val)}" style="flex: 1; padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.85rem;">
    <button type="button" class="btn-remove-phone" title="Remove phone number" style="background: none; border: none; color: var(--primary-red); cursor: pointer; padding: 4px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
    </button>
  `;

  row.querySelector(".btn-remove-phone").onclick = () => {
    if (container.children.length > 1) {
      row.remove();
    } else {
      row.querySelector(".loc-phone-val").value = "";
    }
  };

  container.appendChild(row);
}

/**
 * Handles Form Submission for creating/updating location
 */
async function handleLocationFormSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const locId = $("loc-id-input")?.value;
  const title = $("loc-title")?.value.trim();
  const address = $("loc-address")?.value.trim();
  const mapUrl = $("loc-map-url")?.value.trim();
  const isVisible = $("loc-is-visible")?.checked ?? true;
  const isDefault = $("loc-is-default")?.checked ?? false;

  const phoneInputs = document.querySelectorAll(".loc-phone-val");
  const phones = Array.from(phoneInputs).map(i => i.value.trim()).filter(Boolean);

  if (!title) {
    alert("Please enter a location title.");
    return;
  }
  if (!address) {
    alert("Please enter full address.");
    return;
  }

  const saveBtn = $("btn-save-location");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }
  isSubmitting = true;

  try {
    const endpoint = locId ? `/api/v1/admin/locations/${locId}` : "/api/v1/admin/locations";
    const method = locId ? "PUT" : "POST";

    const response = await apiFetch(endpoint, {
      method,
      body: JSON.stringify({
        title,
        address,
        mapUrl,
        isVisible,
        isDefault,
        phones
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Failed to save location.");
    }

    closeLocationModal();
    await loadLocationsList();
  } catch (error) {
    console.error("Error saving location:", error);
    alert(error.message || "An error occurred while saving the location.");
  } finally {
    isSubmitting = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Location";
    }
  }
}

/**
 * Opens edit modal for location
 */
function editLocation(id) {
  const loc = locationsData.find(l => l.id === id);
  if (!loc) return;
  openLocationModal(loc);
}

/**
 * Reorders locations by swapping or moving up/down
 */
async function moveLocationOrder(id, direction) {
  const index = locationsData.findIndex(l => l.id === id);
  if (index === -1) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= locationsData.length) return;

  const reordered = [...locationsData];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(newIndex, 0, moved);

  const locationIds = reordered.map(l => l.id);

  try {
    const response = await apiFetch("/api/v1/admin/locations/reorder", {
      method: "PUT",
      body: JSON.stringify({ locationIds })
    });
    if (!response.ok) throw new Error("Failed to reorder locations.");
    await loadLocationsList();
  } catch (error) {
    console.error("Reorder error:", error);
    alert("Failed to reorder locations.");
  }
}

/**
 * Sets a location as default
 */
async function handleSetDefault(id) {
  const loc = locationsData.find(l => l.id === id);
  if (!loc) return;

  if (!confirm(`Are you sure you want to set '${loc.title}' as the primary default business location?`)) {
    return;
  }

  try {
    const response = await apiFetch(`/api/v1/admin/locations/${id}/default`, {
      method: "PUT"
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Failed to set default location.");
    }
    await loadLocationsList();
  } catch (error) {
    console.error("Set default error:", error);
    alert(error.message || "Failed to set default location.");
  }
}

/**
 * Handles soft deleting a location
 */
async function handleDeleteLocation(id) {
  const loc = locationsData.find(l => l.id === id);
  if (!loc) return;

  if (loc.isDefault) {
    alert("Cannot delete the default business location. Please set another location as default first.");
    return;
  }

  if (locationsData.length <= 1) {
    alert("Cannot delete the last remaining business location.");
    return;
  }

  if (!confirm(`Are you sure you want to archive/delete the business location '${loc.title}'?`)) {
    return;
  }

  try {
    const response = await apiFetch(`/api/v1/admin/locations/${id}`, {
      method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Failed to delete location.");
    }
    await loadLocationsList();
  } catch (error) {
    console.error("Delete location error:", error);
    alert(error.message || "Failed to delete location.");
  }
}

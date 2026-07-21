/**
 * Roadlink Automobiles - Roles & Permissions Management Module
 * Supports relational role CRUD operations, permission checkboxes, and user metrics.
 */

import { $ , apiFetch } from "./utils.js";
import { getCurrentUser } from "./auth.js";

let rolesEventsBound = false;
let permissionsCache = [];

const PERMISSION_DESCRIPTIONS = {
  "users.manage": "Manage Users (CRUD & Password Reset)",
  "roles.manage": "Manage Roles & Permissions",
  "vehicles.manage": "Manage Vehicles Inventory",
  "settings.manage": "Manage System Settings",
  "settings.view": "View System Settings Only",
  "reports.accounting.view": "View Accounting Reports"
};

/**
 * Initializes and fetches roles and permissions lists.
 */
export async function initRolesView() {
  await loadPermissionsList();
  await loadRolesList();
  if (!rolesEventsBound) {
    bindRolesEvents();
    rolesEventsBound = true;
  }
}

/**
 * Loads the exhaustive set of permissions from backend
 */
async function loadPermissionsList() {
  try {
    const response = await apiFetch("/api/v1/admin/permissions");
    if (!response.ok) throw new Error("Failed to load permissions list.");
    const res = await response.json();
    if (res.success && Array.isArray(res.data)) {
      permissionsCache = res.data;
      renderPermissionCheckboxes();
    }
  } catch (error) {
    console.error("Failed to load permissions:", error);
  }
}

/**
 * Populates permission checkboxes inside the role modal
 */
function renderPermissionCheckboxes() {
  const container = $("role-permissions-checkboxes");
  if (!container) return;

  container.innerHTML = "";
  permissionsCache.forEach(perm => {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display: flex; align-items: flex-start; gap: 8px; padding: 6px;";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = perm.key;
    checkbox.id = `perm-chk-${perm.key}`;
    checkbox.name = "permissions";
    checkbox.style.cssText = "width: 16px; height: 16px; margin-top: 3px; accent-color: var(--primary-blue); cursor: pointer;";

    const label = document.createElement("label");
    label.htmlFor = `perm-chk-${perm.key}`;
    label.style.cssText = "font-size: 0.85rem; font-weight: 500; color: var(--text-dark); cursor: pointer; line-height: 1.3;";
    
    const desc = perm.description || perm.key;
    label.innerHTML = `<strong style="font-family: var(--font-mono); font-size: 0.8rem; display: block; color: var(--primary-blue);">${perm.key}</strong><span style="color: var(--text-muted); font-size: 0.75rem;">${desc}</span>`;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  });
}

/**
 * Fetches and displays Roles list table
 */
export async function loadRolesList() {
  const tbody = $("role-table-body");
  const emptyState = $("role-empty-state");
  if (!tbody) return;

  try {
    const response = await apiFetch("/api/v1/admin/roles");
    if (!response.ok) throw new Error("Failed to load roles list.");
    const res = await response.json();
    if (res.success && Array.isArray(res.data)) {
      const roles = res.data;
      
      tbody.innerHTML = "";
      if (roles.length === 0) {
        if (emptyState) emptyState.style.display = "block";
        return;
      }

      if (emptyState) emptyState.style.display = "none";

      roles.forEach(role => {
        const tr = document.createElement("tr");
        
        // Count permissions
        const permCount = role.permissions_count !== undefined ? role.permissions_count : (Array.isArray(role.permissions) ? role.permissions.length : 0);
        const userCount = role.users_count !== undefined ? role.users_count : 0;
        
        const isAdminRole = role.id === 1 || role.name.toLowerCase() === "admin";
        const actionButtons = isAdminRole 
          ? `
              <button class="btn btn-view-site btn-edit-role" data-id="${role.id}" data-view-only="true" style="padding: 6px 12px; margin: 0; font-size: 0.85rem;">
                View
              </button>
            `
          : `
              <button class="btn btn-view-site btn-edit-role" data-id="${role.id}" style="padding: 6px 12px; margin: 0; font-size: 0.85rem;">
                Edit
              </button>
              <button class="btn btn-danger btn-delete-role" data-id="${role.id}" data-name="${role.name}" data-users="${userCount}" style="padding: 6px 12px; margin: 0; font-size: 0.85rem;">
                Delete
              </button>
            `;

        tr.innerHTML = `
          <td style="font-weight: 700; color: var(--primary-blue);">${role.name}</td>
          <td style="color: var(--text-muted); font-size: 0.9rem;">${role.description || "<em>No description</em>"}</td>
          <td style="text-align: center;"><span class="table-badge status-available" style="padding: 2px 8px; font-weight: 600;">${permCount}</span></td>
          <td style="text-align: center;"><span class="table-badge" style="background: var(--bg-light); border: 1px solid var(--border-color); color: var(--text-dark); padding: 2px 8px; font-weight: 600;">${userCount}</span></td>
          <td class="text-right" style="text-align: right; padding-right: 24px;">
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              ${actionButtons}
            </div>
          </td>
        `;
        
        tbody.appendChild(tr);
      });
      
      // Bind inline row events
      bindInlineRolesEvents();
    }
  } catch (error) {
    console.error("Failed to load roles list:", error);
  }
}

/**
 * Binds inline table action triggers
 */
function bindInlineRolesEvents() {
  const tbody = $("role-table-body");
  if (!tbody) return;

  tbody.querySelectorAll(".btn-edit-role").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      const viewOnly = btn.getAttribute("data-view-only") === "true";
      await openRoleModal(id, viewOnly);
    };
  });

  tbody.querySelectorAll(".btn-delete-role").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const name = btn.getAttribute("data-name");
      const userCount = parseInt(btn.getAttribute("data-users") || "0", 10);
      openDeleteConfirmModal(id, name, userCount);
    };
  });
}

/**
 * Loads dynamic role info and shows the configuration Modal
 */
async function openRoleModal(roleId = null, viewOnly = false) {
  const modal = $("role-modal");
  const modalTitle = $("role-modal-title");
  const form = $("role-form");
  const idField = $("role-id-field");
  const nameField = $("r-name");
  const descField = $("r-description");
  const saveBtn = $("btn-save-role");

  if (!modal || !form) return;

  // Clear modal states
  form.reset();
  if (idField) idField.value = "";
  const errAlert = $("r-form-error");
  if (errAlert) errAlert.style.display = "none";
  document.querySelectorAll(".field-error-msg").forEach(el => el.style.display = "none");

  // Ensure checkboxes are unselected by default
  const checkboxes = document.querySelectorAll("#role-permissions-checkboxes input[type='checkbox']");
  checkboxes.forEach(chk => {
    chk.checked = false;
    chk.disabled = viewOnly;
  });

  if (nameField) nameField.disabled = viewOnly;
  if (descField) descField.disabled = viewOnly;
  if (saveBtn) saveBtn.style.display = viewOnly ? "none" : "block";

  if (roleId) {
    if (modalTitle) modalTitle.textContent = viewOnly ? "View Role" : "Edit Role";
    try {
      const response = await apiFetch(`/api/v1/admin/roles/${roleId}`);
      if (!response.ok) throw new Error("Failed to load role details.");
      const res = await response.json();
      if (res.success && res.data) {
        const role = res.data;
        if (idField) idField.value = role.id;
        if (nameField) nameField.value = role.name;
        if (descField) descField.value = role.description || "";
        
        // Select associated checkboxes
        if (Array.isArray(role.permissions)) {
          role.permissions.forEach(perm => {
            const chk = $(`perm-chk-${perm}`);
            if (chk) chk.checked = true;
          });
        }
      }
    } catch (error) {
      console.error(error);
      alert("Failed to retrieve role detail.");
      return;
    }
  } else {
    if (modalTitle) modalTitle.textContent = "Add Role";
  }

  modal.style.display = "flex";
}

/**
 * Handles security prompts for deleting dynamic Roles
 */
function openDeleteConfirmModal(id, name, userCount) {
  const modal = $("role-delete-confirm-modal");
  const label = $("delete-role-name-label");
  const errorAlert = $("role-delete-error-alert");
  const confirmBtn = $("btn-confirm-delete-role");

  if (!modal || !label) return;

  label.textContent = name;
  if (errorAlert) errorAlert.style.display = "none";
  
  if (confirmBtn) {
    confirmBtn.disabled = false;
    
    // Check if role has assigned users
    if (userCount > 0) {
      if (errorAlert) {
        errorAlert.style.display = "block";
        errorAlert.textContent = `CRITICAL: This role cannot be deleted because it is currently assigned to ${userCount} active users. Reassign these users to another role before proceeding.`;
      }
      confirmBtn.disabled = true;
    }
    
    confirmBtn.onclick = async () => {
      try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Deleting...";

        const response = await apiFetch(`/api/v1/admin/roles/${id}`, {
          method: "DELETE"
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to delete role.");
        }

        modal.style.display = "none";
        await loadRolesList();
      } catch (err) {
        console.error(err);
        if (errorAlert) {
          errorAlert.style.display = "block";
          errorAlert.textContent = err.message || "An unexpected error occurred.";
        }
      } finally {
        if (confirmBtn) {
          confirmBtn.textContent = "Yes, Delete Role";
        }
      }
    };
  }

  modal.style.display = "flex";
}

/**
 * Central event binding logic for Modals and Filters
 */
function bindRolesEvents() {
  const form = $("role-form");
  const addBtn = $("btn-add-role");
  const refreshBtn = $("btn-refresh-roles");
  const searchInput = $("role-search");

  // Close triggers
  const btnCloseModal = $("btn-close-role-modal");
  const btnCancelModal = $("btn-cancel-role-modal");
  const btnCancelDelete = $("btn-cancel-delete-role");

  if (addBtn) {
    addBtn.addEventListener("click", () => openRoleModal());
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadRolesList());
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => filterRolesTable(searchInput.value));
  }

  const hideModal = () => {
    const modal = $("role-modal");
    if (modal) modal.style.display = "none";
  };

  const hideDeleteModal = () => {
    const modal = $("role-delete-confirm-modal");
    if (modal) modal.style.display = "none";
  };

  if (btnCloseModal) btnCloseModal.addEventListener("click", hideModal);
  if (btnCancelModal) btnCancelModal.addEventListener("click", hideModal);
  if (btnCancelDelete) btnCancelDelete.addEventListener("click", hideDeleteModal);

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const idField = $("role-id-field");
      const nameField = $("r-name");
      const descField = $("r-description");
      const saveBtn = $("btn-save-role");
      const errAlert = $("r-form-error");

      if (errAlert) errAlert.style.display = "none";
      document.querySelectorAll(".field-error-msg").forEach(el => el.style.display = "none");

      let hasError = false;

      const roleId = idField ? idField.value : "";
      const name = nameField ? nameField.value.trim() : "";
      const description = descField ? descField.value.trim() : "";

      if (!name) {
        showFieldError("r-name-error", "Role Name is required.");
        hasError = true;
      }

      // Collect checked permissions
      const checkedPerms = [];
      const checkboxes = document.querySelectorAll("#role-permissions-checkboxes input[type='checkbox']:checked");
      checkboxes.forEach(chk => {
        checkedPerms.push(chk.value);
      });

      if (checkedPerms.length === 0) {
        showFieldError("r-permissions-error", "At least one permission must be selected.");
        hasError = true;
      }

      if (hasError) {
        if (errAlert) errAlert.style.display = "block";
        return;
      }

      try {
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving...";
        }

        const method = roleId ? "PUT" : "POST";
        const url = roleId ? `/api/v1/admin/roles/${roleId}` : "/api/v1/admin/roles";

        const response = await apiFetch(url, {
          method,
          body: JSON.stringify({
            name,
            description,
            permissions: checkedPerms
          })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to save role.");
        }

        hideModal();
        await loadRolesList();

      } catch (err) {
        console.error(err);
        if (errAlert) {
          errAlert.style.display = "block";
          errAlert.textContent = err.message || "An unexpected error occurred.";
        }
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Role";
        }
      }
    });
  }
}

/**
 * Client-side dynamic filtering of Roles table
 */
function filterRolesTable(query) {
  const tbody = $("role-table-body");
  if (!tbody) return;

  const rows = tbody.querySelectorAll("tr");
  const normalizedQuery = query.toLowerCase().trim();

  let visibleCount = 0;

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    if (text.includes(normalizedQuery)) {
      row.style.display = "";
      visibleCount++;
    } else {
      row.style.display = "none";
    }
  });

  const emptyState = $("role-empty-state");
  if (emptyState) {
    emptyState.style.display = visibleCount === 0 ? "block" : "none";
  }
}

function showFieldError(id, message) {
  const errSpan = $(id);
  if (errSpan) {
    errSpan.textContent = message;
    errSpan.style.display = "block";
  }
}

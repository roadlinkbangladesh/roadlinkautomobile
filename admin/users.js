/**
 * Roadlink Automobiles - User Management Module
 * Comprehensive client-side CRUD user portal handler.
 */

import { $, apiFetch } from "./utils.js";
import { validatePasswordComplexity } from "./password-validator.js";

let usersList = [];
let filteredUsers = [];
let userSearchQuery = "";
let usersEventsBound = false;
let userToDelete = null;

/**
 * Initializes and populates the Users View.
 */
export async function initUsersView() {
  await fetchUsers();
  if (!usersEventsBound) {
    bindUsersEvents();
    usersEventsBound = true;
  }
}

/**
 * Fetches users from the REST API endpoint.
 */
async function fetchUsers() {
  const tableBody = $("user-table-body");
  if (tableBody) tableBody.style.opacity = "0.5";

  try {
    const response = await apiFetch("/api/v1/admin/users");
    const result = await response.json();

    if (response.ok && result.success) {
      usersList = result.data || [];
    } else {
      console.error("Failed to load users:", result.message);
      usersList = [];
    }
  } catch (err) {
    console.error("Network error fetching users:", err);
    usersList = [];
  } finally {
    if (tableBody) tableBody.style.opacity = "1";
    renderUsersTable();
  }
}

/**
 * Renders user rows into the table, applying search filters.
 */
function renderUsersTable() {
  const tableBody = $("user-table-body");
  const emptyState = $("user-empty-state");

  if (!tableBody) return;

  // Retrieve current user details from sessionStorage
  let currentUserId = null;
  try {
    const cachedUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    currentUserId = cachedUser.id;
  } catch (e) {
    console.error("Error reading currentUser:", e);
  }

  // Filter users list client-side
  filteredUsers = usersList.filter(u => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.display_name && u.display_name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  tableBody.innerHTML = "";

  if (filteredUsers.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  filteredUsers.forEach(u => {
    const row = document.createElement("tr");
    row.id = `user-row-${u.id}`;

    const isActive = u.is_active === 1 || u.is_active === true;
    const statusText = isActive ? "Active" : "Deactivated";
    const statusStyle = isActive
      ? "background-color: rgba(37, 211, 102, 0.08); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.2);"
      : "background-color: rgba(227, 27, 35, 0.08); color: #e31b23; border: 1px solid rgba(227, 27, 35, 0.2);";

    const lastLogin = u.last_login_at
      ? new Date(u.last_login_at).toLocaleString("en-BD", { hour12: true })
      : "Never";

    // Disable Actions for self
    const isSelf = u.id === currentUserId;
    const deleteDisabled = isSelf ? "disabled title='You cannot delete your own account'" : "";
    const resetDisabled = isSelf ? "disabled title='You cannot reset your own password here'" : "";

    row.innerHTML = `
      <td style="font-weight: 600; font-family: var(--font-display);">${u.display_name}</td>
      <td style="font-weight: 700; font-family: var(--font-mono); font-size: 0.85rem; color: var(--primary-blue);">${u.username}</td>
      <td style="font-weight: 500; text-transform: capitalize;">${u.role}</td>
      <td>
        <span class="badge" style="padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; display: inline-block; ${statusStyle}">
          ${statusText}
        </span>
      </td>
      <td style="font-size: 0.85rem; color: var(--text-muted); font-family: var(--font-mono);">${lastLogin}</td>
      <td>
        <div class="action-buttons" style="justify-content: flex-end; gap: 6px;">
          <button class="btn-action-edit btn-user-edit" data-id="${u.id}" style="padding: 6px 12px; font-size: 0.8rem; border-radius: var(--radius-sm);">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            Edit
          </button>
          <button class="btn-action-reset btn-user-reset" data-id="${u.id}" ${resetDisabled} style="padding: 6px 12px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(230, 162, 44, 0.3); color: #e6a23c; background: rgba(230, 162, 44, 0.05);">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5"/></svg>
            Reset Pwd
          </button>
          <button class="btn-action-delete btn-user-delete" data-id="${u.id}" ${deleteDisabled} style="padding: 6px 12px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(227, 27, 35, 0.3); color: var(--primary-red); background: rgba(227, 27, 35, 0.05);">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
            Delete
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

/**
 * Binds DOM element events for filtering and managing user modals.
 */
function bindUsersEvents() {
  const searchInput = $("user-search");
  const refreshBtn = $("btn-refresh-users");
  const addUserBtn = $("btn-add-user");
  const tableBody = $("user-table-body");

  // Modal elements
  const userModal = $("user-modal");
  const userForm = $("user-form");
  const btnCloseUserModal = $("btn-close-user-modal");
  const btnCancelUserModal = $("btn-cancel-user-modal");

  const deleteModal = $("user-delete-confirm-modal");
  const btnConfirmDeleteUser = $("btn-confirm-delete-user");
  const btnCancelDeleteUser = $("btn-cancel-delete-user");

  const pwdResetModal = $("password-reset-result-modal");
  const btnCloseResetModal = $("btn-close-reset-modal");

  // Interactive password toggle inside user modal
  const passwordToggleBtns = document.querySelectorAll("#user-modal .cp-password-toggle");
  passwordToggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = $(targetId);
      if (!input) return;

      const iconEye = btn.querySelector(".icon-eye");
      const iconEyeOff = btn.querySelector(".icon-eye-off");

      if (input.type === "password") {
        input.type = "text";
        if (iconEye) iconEye.style.display = "none";
        if (iconEyeOff) iconEyeOff.style.display = "block";
      } else {
        input.type = "password";
        if (iconEye) iconEye.style.display = "block";
        if (iconEyeOff) iconEyeOff.style.display = "none";
      }
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      userSearchQuery = searchInput.value.toLowerCase().trim();
      renderUsersTable();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      const originalContent = refreshBtn.innerHTML;
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Loading...";
      await fetchUsers();
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = originalContent;
    });
  }

  // Open modal for Adding User
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      showUserFormModal();
    });
  }

  // Close form modal
  const hideUserModal = () => {
    if (userModal) userModal.style.display = "none";
    if (userForm) userForm.reset();
  };

  if (btnCloseUserModal) btnCloseUserModal.addEventListener("click", hideUserModal);
  if (btnCancelUserModal) btnCancelUserModal.addEventListener("click", hideUserModal);

  // Form submission handler (Add/Edit)
  if (userForm) {
    userForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const idVal = $("user-id").value;
      const displayNameVal = $("u-display-name").value.trim();
      const usernameVal = $("u-username").value.trim();
      const roleVal = $("u-role").value;
      const statusVal = parseInt($$("u-status").value);

      const formErrorAlert = $("u-form-error");

      // Reset error indicators
      formErrorAlert.style.display = "none";
      const errFields = document.querySelectorAll("#user-modal .field-error-msg");
      errFields.forEach(f => {
        f.style.display = "none";
        f.textContent = "";
      });

      let hasError = false;

      if (!displayNameVal) {
        showFieldError("u-display-name-error", "Full Name is required.");
        hasError = true;
      }

      if (!usernameVal) {
        showFieldError("u-username-error", "Username is required.");
        hasError = true;
      }

      if (hasError) {
        formErrorAlert.style.display = "block";
        formErrorAlert.textContent = "Please resolve the indicated field errors.";
        return;
      }

      // API request
      const saveBtn = $("btn-save-user");
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      const isEdit = !!idVal;

      try {
        const url = isEdit ? `/api/v1/admin/users/${idVal}` : "/api/v1/admin/users";
        const method = isEdit ? "PUT" : "POST";
        const body = {
          display_name: displayNameVal,
          username: usernameVal,
          role: roleVal,
          is_active: statusVal === 1
        };

        const response = await apiFetch(url, {
          method,
          body: JSON.stringify(body)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          hideUserModal();
          await fetchUsers();

          // Show temporary password modal on successful new user creation
          if (!isEdit && result.data?.temporaryPassword) {
            const titleEl = $("pwd-reset-title");
            const descEl = $("pwd-reset-desc");
            if (titleEl) titleEl.textContent = "User Account Created";
            if (descEl) {
              descEl.innerHTML = `The administrative account for user <strong id="reset-user-username-label"></strong> has been created. A temporary password has been generated:`;
            }

            const createdUser = result.data.user || {};
            $("reset-user-username-label").textContent = `${createdUser.display_name || displayNameVal} (@${createdUser.username || usernameVal})`;
            $("reset-temp-password-text").textContent = result.data.temporaryPassword;

            const pwdResetModal = $("password-reset-result-modal");
            if (pwdResetModal) pwdResetModal.style.display = "flex";
          }
        } else {
          formErrorAlert.style.display = "block";
          formErrorAlert.textContent = result.message || "An error occurred while saving the user.";
        }
      } catch (err) {
        console.error("Save user network error:", err);
        formErrorAlert.style.display = "block";
        formErrorAlert.textContent = "Network error. Please try again.";
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    });
  }

  // Edit / Delete / Reset delegation
  if (tableBody) {
    tableBody.addEventListener("click", async (e) => {
      const editBtn = e.target.closest(".btn-user-edit");
      const deleteBtn = e.target.closest(".btn-user-delete");
      const resetBtn = e.target.closest(".btn-user-reset");

      if (editBtn) {
        const id = editBtn.getAttribute("data-id");
        showUserFormModal(id);
      }

      if (deleteBtn) {
        const id = parseInt(deleteBtn.getAttribute("data-id"));
        const user = usersList.find(u => u.id === id);
        if (user) {
          userToDelete = user;
          $("delete-user-username-label").textContent = `${user.display_name} (@${user.username})`;
          $("user-delete-error-alert").style.display = "none";
          if (deleteModal) deleteModal.style.display = "flex";
        }
      }

      if (resetBtn) {
        const id = parseInt(resetBtn.getAttribute("data-id"));
        const user = usersList.find(u => u.id === id);
        if (user) {
          await executePasswordReset(user);
        }
      }
    });
  }

  // Deletion modal event handlers
  const hideDeleteModal = () => {
    if (deleteModal) deleteModal.style.display = "none";
    userToDelete = null;
  };

  if (btnCancelDeleteUser) btnCancelDeleteUser.addEventListener("click", hideDeleteModal);

  if (btnConfirmDeleteUser) {
    btnConfirmDeleteUser.addEventListener("click", async () => {
      if (!userToDelete) return;

      const deleteErrorAlert = $("user-delete-error-alert");
      deleteErrorAlert.style.display = "none";
      btnConfirmDeleteUser.disabled = true;
      btnConfirmDeleteUser.textContent = "Deleting...";

      try {
        const response = await apiFetch(`/api/v1/admin/users/${userToDelete.id}`, {
          method: "DELETE"
        });
        const result = await response.json();

        if (response.ok && result.success) {
          hideDeleteModal();
          await fetchUsers();
        } else {
          deleteErrorAlert.style.display = "block";
          deleteErrorAlert.textContent = result.message || "Failed to delete user.";
        }
      } catch (err) {
        console.error("Delete user network error:", err);
        deleteErrorAlert.style.display = "block";
        deleteErrorAlert.textContent = "Network error. Please try again.";
      } finally {
        btnConfirmDeleteUser.disabled = false;
        btnConfirmDeleteUser.textContent = "Yes, Delete User";
      }
    });
  }

  // Done button on pwd reset result modal
  if (btnCloseResetModal) {
    btnCloseResetModal.addEventListener("click", () => {
      if (pwdResetModal) pwdResetModal.style.display = "none";
    });
  }
}

/**
 * Shorthand for query selectors.
 */
function $$(id) {
  return document.getElementById(id);
}

/**
 * Renders inline text error.
 */
function showFieldError(id, message) {
  const span = $(id);
  if (span) {
    span.textContent = message;
    span.style.display = "block";
  }
}

/**
 * Displays the Add/Edit form modal, pre-populating fields if an ID is provided.
 */
function showUserFormModal(userId = null) {
  const modal = $("user-modal");
  const modalTitle = $("user-modal-title");
  const form = $("user-form");

  const idInput = $("user-id");
  const displayNameInput = $("u-display-name");
  const usernameInput = $("u-username");
  const passwordGroup = $("u-password-group");
  const passwordInput = $("u-password");
  const roleInput = $("u-role");
  const statusInput = $("u-status");

  // Reset errors and form
  if (form) form.reset();
  $("u-form-error").style.display = "none";
  document.querySelectorAll("#user-modal .field-error-msg").forEach(f => {
    f.style.display = "none";
    f.textContent = "";
  });

  // Always hide password fields since passwords are now auto-generated on creation or reset separately
  if (passwordGroup) passwordGroup.style.display = "none";
  if (passwordInput) passwordInput.required = false;

  if (userId) {
    // Edit Mode
    const user = usersList.find(u => u.id === parseInt(userId));
    if (!user) return;

    modalTitle.textContent = "Edit User Settings";
    idInput.value = user.id;
    displayNameInput.value = user.display_name || "";
    usernameInput.value = user.username || "";
    usernameInput.readOnly = true;
    usernameInput.style.backgroundColor = "var(--bg-light)";
    usernameInput.style.cursor = "not-allowed";

    roleInput.value = user.role || "manager";
    statusInput.value = user.is_active === 1 || user.is_active === true ? "1" : "0";
  } else {
    // Add Mode
    modalTitle.textContent = "Create Administrative Account";
    idInput.value = "";
    usernameInput.readOnly = false;
    usernameInput.style.backgroundColor = "";
    usernameInput.style.cursor = "";

    roleInput.value = "manager";
    statusInput.value = "1";
  }

  if (modal) modal.style.display = "flex";
}

/**
 * Initiates the backend administrator password reset workflow.
 */
async function executePasswordReset(user) {
  try {
    const response = await apiFetch(`/api/v1/admin/users/${user.id}/reset-password`, {
      method: "POST"
    });
    const result = await response.json();

    if (response.ok && result.success && result.data?.temporaryPassword) {
      // Dynamic restore of password-reset title and description text
      const titleEl = $("pwd-reset-title");
      const descEl = $("pwd-reset-desc");
      if (titleEl) titleEl.textContent = "Password Reset Successful";
      if (descEl) {
        descEl.innerHTML = `The password for user <strong id="reset-user-username-label"></strong> has been reset. A temporary password has been generated:`;
      }

      // Display generated temporary password
      $("reset-user-username-label").textContent = `${user.display_name} (@${user.username})`;
      $("reset-temp-password-text").textContent = result.data.temporaryPassword;
      
      const pwdResetModal = $("password-reset-result-modal");
      if (pwdResetModal) pwdResetModal.style.display = "flex";
    } else {
      alert(result.message || "Failed to reset password.");
    }
  } catch (err) {
    console.error("Password reset failure:", err);
    alert("Network error occurred during password reset.");
  }
}

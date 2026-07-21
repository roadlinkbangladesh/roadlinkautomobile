/**
 * Roadlink Automobiles - Profile Management Module
 * Handles loading dynamic profile details, updating Display Name, and changing credentials.
 */

import { $ , apiFetch } from "./utils.js";
import { getCurrentUser } from "./auth.js";
import { navigationController } from "./navigation.js";
import { validatePasswordComplexity } from "./password-validator.js";

let profileEventsBound = false;

/**
 * Initializes the Profile and resets both Personal Info and Change Password forms.
 */
export function initProfileView() {
  loadProfileData();
  resetProfileForms();
  if (!profileEventsBound) {
    bindProfileEvents();
    profileEventsBound = true;
  }
}

/**
 * Fetches the currently authenticated profile payload from back-end
 */
async function loadProfileData() {
  try {
    const response = await apiFetch("/api/v1/admin/profile");
    if (!response.ok) throw new Error("Failed to load profile.");
    const res = await response.json();
    if (res.success && res.data) {
      const user = res.data;
      
      // Update local sessionStorage cache
      sessionStorage.setItem("currentUser", JSON.stringify(user));
      
      // Update topbar profile view labels if they exist
      const topbarRoleElements = document.querySelectorAll(".user-role");
      const topbarLabelElements = document.querySelectorAll(".user-label");
      
      topbarRoleElements.forEach(el => {
        el.textContent = user.displayName || user.username;
      });
      topbarLabelElements.forEach(el => {
        el.textContent = user.roleName || "User";
      });

      // Populate profile form inputs
      const profUsername = $("prof-username");
      const profDisplayName = $("prof-display-name");
      const profRoleBadge = $("prof-role-badge");
      const profPermissionsContainer = $("prof-permissions-container");

      if (profUsername) profUsername.value = user.username || "";
      if (profDisplayName) profDisplayName.value = user.displayName || "";
      if (profRoleBadge) {
        profRoleBadge.textContent = user.roleName || "User";
      }

      if (profPermissionsContainer) {
        profPermissionsContainer.innerHTML = "";
        if (Array.isArray(user.permissions) && user.permissions.length > 0) {
          user.permissions.forEach(perm => {
            const span = document.createElement("span");
            span.className = "permission-badge";
            span.textContent = perm;
            span.style.cssText = "background: var(--bg-light); border: 1.5px solid var(--border-color); border-radius: var(--radius-sm); padding: 4px 10px; font-size: 0.75rem; font-family: var(--font-mono); font-weight: 600; color: var(--text-dark);";
            profPermissionsContainer.appendChild(span);
          });
        } else {
          profPermissionsContainer.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">No permissions assigned.</span>`;
        }
      }
    }
  } catch (error) {
    console.error("Failed to load profile data:", error);
  }
}

/**
 * Clear form inputs, errors, and resets view states
 */
function resetProfileForms() {
  const profileForm = $("profile-info-form");
  const passwordForm = $("change-password-form");
  
  if (profileForm) {
    const successAlert = $("prof-info-success-alert");
    const errorAlert = $("prof-info-error-alert");
    if (successAlert) successAlert.style.display = "none";
    if (errorAlert) errorAlert.style.display = "none";
  }

  if (passwordForm) {
    passwordForm.reset();
    const successAlert = $("cp-success-alert");
    const errorAlert = $("cp-error-alert");
    if (successAlert) successAlert.style.display = "none";
    if (errorAlert) errorAlert.style.display = "none";
  }

  // Hide inline error details
  const errFields = document.querySelectorAll(".field-error-msg");
  errFields.forEach(f => {
    f.style.display = "none";
    f.textContent = "";
  });

  // Ensure toggled password visibility is reset to hidden
  const toggleBtns = document.querySelectorAll(".cp-password-toggle");
  toggleBtns.forEach(btn => {
    const targetId = btn.getAttribute("data-target");
    const input = $(targetId);
    if (input) {
      input.type = "password";
    }
    const iconEye = btn.querySelector(".icon-eye");
    const iconEyeOff = btn.querySelector(".icon-eye-off");
    if (iconEye) iconEye.style.display = "block";
    if (iconEyeOff) iconEyeOff.style.display = "none";
    btn.setAttribute("aria-label", "Show password");
  });
}

/**
 * Binds DOM listeners for profile updating and credential submission.
 */
function bindProfileEvents() {
  const profileForm = $("profile-info-form");
  const passwordForm = $("change-password-form");
  const toggleBtns = document.querySelectorAll(".cp-password-toggle");

  // Show/Hide password toggle logic
  toggleBtns.forEach(btn => {
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
        btn.setAttribute("aria-label", "Hide password");
      } else {
        input.type = "password";
        if (iconEye) iconEye.style.display = "block";
        if (iconEyeOff) iconEyeOff.style.display = "none";
        btn.setAttribute("aria-label", "Show password");
      }
    });
  });

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const displayNameInput = $("prof-display-name");
      const successAlert = $("prof-info-success-alert");
      const errorAlert = $("prof-info-error-alert");
      const errorText = $("prof-info-error-text");
      const submitBtn = profileForm.querySelector("button[type='submit']");

      if (successAlert) successAlert.style.display = "none";
      if (errorAlert) errorAlert.style.display = "none";

      const displayName = displayNameInput.value.trim();
      if (!displayName) {
        showFieldError("prof-display-name-error", "Full Name is required.");
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Saving...";
        }

        const response = await apiFetch("/api/v1/admin/profile", {
          method: "PUT",
          body: JSON.stringify({ displayName })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to update profile.");
        }

        if (successAlert) successAlert.style.display = "flex";
        await loadProfileData();

      } catch (err) {
        console.error(err);
        if (errorAlert) {
          errorAlert.style.display = "flex";
          if (errorText) errorText.textContent = err.message || "An unexpected error occurred.";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Profile";
        }
      }
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const currPass = $("cp-curr-pass");
      const newPass = $("cp-new-pass");
      const confPass = $("cp-conf-pass");

      const successAlert = $("cp-success-alert");
      const errorAlert = $("cp-error-alert");
      const errorAlertText = $("cp-error-alert-text");

      if (successAlert) successAlert.style.display = "none";
      if (errorAlert) errorAlert.style.display = "none";

      let hasError = false;

      // Reset inline validation messages
      const errFields = passwordForm.querySelectorAll(".field-error-msg");
      errFields.forEach(f => {
        f.style.display = "none";
        f.textContent = "";
      });

      // Validations
      if (!currPass || !currPass.value) {
        showFieldError("cp-curr-error", "Current password is required.");
        hasError = true;
      }

      if (!newPass || !newPass.value) {
        showFieldError("cp-new-error", "New password is required.");
        hasError = true;
      } else {
        const checkResult = validatePasswordComplexity(newPass.value);
        if (!checkResult.isValid) {
          showFieldError("cp-new-error", checkResult.message);
          hasError = true;
        }
      }

      if (!confPass || !confPass.value) {
        showFieldError("cp-conf-error", "Please confirm your new password.");
        hasError = true;
      } else if (newPass && confPass && newPass.value !== confPass.value) {
        showFieldError("cp-conf-error", "Passwords do not match.");
        hasError = true;
      }

      if (newPass && currPass && newPass.value === currPass.value) {
        showFieldError("cp-new-error", "New password cannot be the same as current password.");
        hasError = true;
      }

      if (hasError) {
        if (errorAlert) {
          errorAlert.style.display = "flex";
          if (errorAlertText) errorAlertText.textContent = "Please correct the specified errors.";
        }
        return;
      }

      const saveBtn = passwordForm.querySelector("button[type='submit']");
      try {
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = "Updating...";
        }

        const response = await apiFetch("/api/v1/admin/users/change-password", {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: currPass.value,
            newPassword: newPass.value
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to update password.");
        }

        if (successAlert) successAlert.style.display = "flex";
        passwordForm.reset();

        // Clear mustChangePassword restriction on success
        sessionStorage.removeItem("mustChangePassword");

        // Stagger navigation so user sees success alert
        setTimeout(() => {
          navigationController.navigateTo("dashboard");
        }, 1500);

      } catch (err) {
        console.error(err);
        if (errorAlert) {
          errorAlert.style.display = "flex";
          if (errorAlertText) errorAlertText.textContent = err.message || "An unexpected error occurred.";
        }
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Password";
        }
      }
    });
  }
}

/**
 * Helper to show inline text error below input field
 */
function showFieldError(id, message) {
  const errSpan = $(id);
  if (errSpan) {
    errSpan.textContent = message;
    errSpan.style.display = "block";
  }
}

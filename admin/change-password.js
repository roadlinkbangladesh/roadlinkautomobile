/**
 * Roadlink Automobiles - Change Password Module
 * Handles administrator credential validation, show/hide toggles,
 * error alerts, and placeholder API integrations.
 */

import { $ } from "./utils.js";
import { switchView } from "./navigation.js";

let passwordEventsBound = false;

/**
 * Initializes and resets the Change Password form panel.
 */
export function initChangePasswordView() {
  resetChangePasswordForm();
  if (!passwordEventsBound) {
    bindChangePasswordEvents();
    passwordEventsBound = true;
  }
}

/**
 * Binds DOM form submission, toggling, and cancellation listeners.
 */
function bindChangePasswordEvents() {
  const form = $("change-password-form");
  const cancelBtn = $("btn-cancel-change-password");

  // Show/Hide Password Toggle buttons inside input-wrappers
  const toggleButtons = document.querySelectorAll("#change-password-form .password-toggle-btn");
  toggleButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = $(targetId);
      if (!input) return;

      const eyeIcon = btn.querySelector(".icon-eye");
      const eyeOffIcon = btn.querySelector(".icon-eye-off");

      if (input.type === "password") {
        input.type = "text";
        if (eyeIcon) eyeIcon.style.display = "none";
        if (eyeOffIcon) eyeOffIcon.style.display = "block";
      } else {
        input.type = "password";
        if (eyeIcon) eyeIcon.style.display = "block";
        if (eyeOffIcon) eyeOffIcon.style.display = "none";
      }
    });
  });

  // Handle Form Submission
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const currPass = $("chg-curr-pass");
      const newPass = $("chg-new-pass");
      const confPass = $("chg-conf-pass");

      const successAlert = $("change-password-success");
      const errorAlert = $("change-password-error");

      // Hide active alerts
      if (successAlert) successAlert.style.display = "none";
      if (errorAlert) errorAlert.style.display = "none";

      // 1. Check empty values
      if (!currPass || !newPass || !confPass || !currPass.value || !newPass.value || !confPass.value) {
        showError("All fields marked with an asterisk (*) are required.");
        return;
      }

      const valCurrent = currPass.value;
      const valNew = newPass.value;
      const valConfirm = confPass.value;

      // 2. Validate new password length (minimum 4 characters)
      if (valNew.length < 4) {
        showError("New password must be at least 4 characters in length.");
        return;
      }

      // 3. Confirm password matching
      if (valNew !== valConfirm) {
        showError("New password and confirm password fields do not match.");
        return;
      }

      // 4. Client-side success - process placeholder API payload
      console.log("[Security] Preparing Change Password credentials payload...");
      console.log("[Security] Placeholder API endpoint mapped: PUT /api/v1/admin/settings (or /api/v1/auth/change-password)");
      
      /* 
       * FUTURE API INTEGRATION PATTERN:
       * 
       * try {
       *   const token = getToken();
       *   const response = await apiFetch("/api/v1/auth/change-password", {
       *     method: "POST",
       *     body: JSON.stringify({
       *       currentPassword: valCurrent,
       *       newPassword: valNew
       *     })
       *   });
       *   const result = await response.json();
       *   if (result.success) { ... }
       * } catch (err) { ... }
       */

      // Render successful state
      if (successAlert) {
        successAlert.style.display = "flex";
      }
      
      // Reset inputs after 1 second delay
      setTimeout(() => {
        resetChangePasswordForm();
      }, 2000);
    });
  }

  // Cancel redirects back to main dashboard
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      resetChangePasswordForm();
      switchView("dashboard");
    });
  }
}

/**
 * Safely displays warning messages.
 * @param {string} msg - Error message text
 */
function showError(msg) {
  const errorAlert = $("change-password-error");
  if (errorAlert) {
    errorAlert.textContent = msg;
    errorAlert.style.display = "block";
  }
}

/**
 * Resets form values and input types back to secure password.
 */
export function resetChangePasswordForm() {
  const form = $("change-password-form");
  if (form) form.reset();

  const successAlert = $("change-password-success");
  const errorAlert = $("change-password-error");

  if (successAlert) successAlert.style.display = "none";
  if (errorAlert) errorAlert.style.display = "none";

  // Force reset visible field modes back to password
  const inputs = document.querySelectorAll("#change-password-form input");
  inputs.forEach(input => {
    input.type = "password";
  });

  // Reset SVG toggle icon visibility states
  const toggleButtons = document.querySelectorAll("#change-password-form .password-toggle-btn");
  toggleButtons.forEach(btn => {
    const eyeIcon = btn.querySelector(".icon-eye");
    const eyeOffIcon = btn.querySelector(".icon-eye-off");
    if (eyeIcon) eyeIcon.style.display = "block";
    if (eyeOffIcon) eyeOffIcon.style.display = "none";
  });
}

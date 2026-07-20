/**
 * Roadlink Automobiles - Change Password Module
 * Manages validation, form states, password toggling, and mock submission hooks.
 */

import { $ } from "./utils.js";
import { navigationController } from "./navigation.js";

let cpEventsBound = false;

/**
 * Initializes and resets the Change Password form and alerts.
 */
export function initChangePasswordView() {
  resetChangePasswordForm();
  if (!cpEventsBound) {
    bindChangePasswordEvents();
    cpEventsBound = true;
  }
}

/**
 * Clear form inputs, errors, and resets view styles.
 */
function resetChangePasswordForm() {
  const form = $("change-password-form");
  if (form) form.reset();

  // Hide response banners
  const successAlert = $("cp-success-alert");
  const errorAlert = $("cp-error-alert");
  if (successAlert) successAlert.style.display = "none";
  if (errorAlert) errorAlert.style.display = "none";

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
 * Binds DOM listeners for visibility switches, cancels, and password submissions.
 */
function bindChangePasswordEvents() {
  const form = $("change-password-form");
  const cancelBtn = $("btn-cancel-change-password");
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

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      navigationController.navigateTo("dashboard");
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
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
      const errFields = document.querySelectorAll(".field-error-msg");
      errFields.forEach(f => {
        f.style.display = "none";
        f.textContent = "";
      });

      // Local Validations
      if (!currPass || !currPass.value) {
        showFieldError("cp-curr-error", "Current password is required.");
        hasError = true;
      }

      if (!newPass || !newPass.value) {
        showFieldError("cp-new-error", "New password is required.");
        hasError = true;
      } else if (newPass.value.length < 6) {
        showFieldError("cp-new-error", "New password must be at least 6 characters long.");
        hasError = true;
      }

      if (!confPass || !confPass.value) {
        showFieldError("cp-conf-error", "Please confirm your new password.");
        hasError = true;
      } else if (newPass && confPass && newPass.value !== confPass.value) {
        showFieldError("cp-conf-error", "Passwords do not match.");
        hasError = true;
      }

      if (hasError) {
        if (errorAlert) {
          errorAlert.style.display = "flex";
          if (errorAlertText) errorAlertText.textContent = "Please correct the specified errors.";
        }
        return;
      }

      // API Simulated submission
      try {
        console.log("Simulating password alteration backend query...");
        // This is a placeholder for actual integration:
        // const response = await apiFetch("/api/v1/admin/change-password", {
        //   method: "PUT",
        //   body: JSON.stringify({ currentPassword: currPass.value, newPassword: newPass.value })
        // });
        // if (!response.ok) throw new Error("Incorrect current password.");

        // Visual simulation of network delay
        const saveBtn = $("btn-save-change-password");
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = "Updating...";
        }

        setTimeout(() => {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Password";
          }
          if (successAlert) successAlert.style.display = "flex";
          form.reset();
        }, 800);

      } catch (err) {
        console.error(err);
        if (errorAlert) {
          errorAlert.style.display = "flex";
          if (errorAlertText) errorAlertText.textContent = err.message || "An unexpected error occurred.";
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

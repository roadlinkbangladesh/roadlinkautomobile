/**
 * Roadlink Automobiles - Profile Management Module
 * Handles loading dynamic profile details, updating Display Name, and changing credentials.
 */

import { $, apiFetch } from "./utils.js";
import { getCurrentUser, clearToken } from "./auth.js";
import { navigationController } from "./navigation.js";
import { validatePasswordComplexity } from "./password-validator.js";
import { showLoginView } from "./ui.js";

let profileEventsBound = false;

let pendingMandatoryLogout = false;

/**
 * Initializes the Profile and resets both Personal Info and Change Password forms.
 */
export function initProfileView() {
  updateMandatorySecurityActionBanners();
  loadProfileData();
  resetProfileForms();
  checkMfaStatus();
  if (!profileEventsBound) {
    bindProfileEvents();
    bindMfaEvents();
    profileEventsBound = true;
  }
}

export function updateMandatorySecurityActionBanners() {
  const mandatoryAction = sessionStorage.getItem("mandatorySecurityAction") || 
    (sessionStorage.getItem("mustChangePassword") === "true" ? "PASSWORD_CHANGE" : 
    (sessionStorage.getItem("mustEnrollMfa") === "true" ? "MFA_ENROLLMENT" : null));

  const pwdPrompt = $("forced-password-prompt");
  const mfaPrompt = $("forced-mfa-prompt");

  if (pwdPrompt) {
    pwdPrompt.style.display = (mandatoryAction === "PASSWORD_CHANGE") ? "block" : "none";
  }

  if (mfaPrompt) {
    mfaPrompt.style.display = (mandatoryAction === "MFA_ENROLLMENT") ? "block" : "none";
  }

  if (mandatoryAction === "MFA_ENROLLMENT") {
    setTimeout(() => {
      const setupPanel = $("mfa-setup-panel");
      if (setupPanel && setupPanel.style.display !== "block") {
        const btnStartSetup = $("btn-mfa-start-setup");
        if (btnStartSetup) btnStartSetup.click();
      }
    }, 150);
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
      if (user.must_change_password) {
        sessionStorage.setItem("mustChangePassword", "true");
        updateForcedPasswordPromptState(true);
      } else {
        updateForcedPasswordPromptState();
      }
      
      // Update topbar profile view labels if they exist
      const topbarRoleElements = document.querySelectorAll(".user-role");
      const topbarLabelElements = document.querySelectorAll(".user-label");
      
      topbarRoleElements.forEach(el => {
        el.textContent = user.display_name || user.username;
      });
      topbarLabelElements.forEach(el => {
        el.textContent = user.role_name || (user.role_id === 1 ? "Super Administrator" : (user.role_id === 2 ? "Manager" : "User"));
      });

      // Populate profile form inputs
      const profUsername = $("prof-username");
      const profDisplayName = $("prof-display-name");
      const profRoleBadge = $("prof-role-badge");
      const profPermissionsContainer = $("prof-permissions-container");

      if (profUsername) profUsername.value = user.username || "";
      if (profDisplayName) profDisplayName.value = user.display_name || "";
      if (profRoleBadge) {
        profRoleBadge.textContent = user.role_name || (user.role_id === 1 ? "Super Administrator" : (user.role_id === 2 ? "Manager" : "User"));
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
          body: JSON.stringify({ display_name: displayName })
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

        const wasForcedChange = sessionStorage.getItem("mustChangePassword") === "true";

        // Clear mandatory security action restriction on success
        sessionStorage.removeItem("mandatorySecurityAction");
        sessionStorage.removeItem("mustChangePassword");
        updateMandatorySecurityActionBanners();

        if (wasForcedChange || result.data?.requires_login || result.requires_login) {
          setTimeout(() => {
            clearToken();
            sessionStorage.clear();
            showLoginView("Password changed successfully! Please sign in with your new password.");
          }, 1200);
        } else {
          if (typeof window.applyUIPermissions === "function") {
            window.applyUIPermissions();
          }
          setTimeout(() => {
            navigationController.navigateTo("dashboard");
          }, 1500);
        }

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

let mfaRecoveryCodes = [];

/**
 * Checks MFA enrollment status from backend
 */
async function checkMfaStatus() {
  const statusBadge = $("mfa-status-badge");
  const policyBadge = $("mfa-policy-badge");
  const disabledBox = $("mfa-disabled-box");
  const enabledBox = $("mfa-enabled-box");
  const setupPanel = $("mfa-setup-panel");
  const enrolledDateEl = $("mfa-enrolled-date");

  try {
    const res = await apiFetch("/api/v1/auth/mfa/status");
    const json = await res.json();

    if (res.ok && json.success && json.data) {
      const { mfa_enabled, mfa_required, mfa_enrolled_at, enrolled_at } = json.data;
      const enrolledDate = mfa_enrolled_at || enrolled_at;

      // Render Policy Badge
      if (policyBadge) {
        if (mfa_required) {
          policyBadge.textContent = "🔒 Required";
          policyBadge.style.cssText = "padding: 3px 8px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; background-color: rgba(230, 162, 44, 0.12); color: #d97706; border: 1px solid rgba(230, 162, 44, 0.3);";
        } else {
          policyBadge.textContent = "Optional";
          policyBadge.style.cssText = "padding: 3px 8px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 600; background-color: var(--bg-neutral); color: var(--text-muted); border: 1px solid var(--border-color);";
        }
      }

      // Render Status Badge
      if (mfa_enabled) {
        if (statusBadge) {
          statusBadge.textContent = "🟢 Enabled";
          statusBadge.style.cssText = "padding: 3px 8px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; background-color: rgba(37, 211, 102, 0.12); color: #15803d; border: 1px solid rgba(37, 211, 102, 0.3);";
        }
        if (enabledBox) enabledBox.style.display = "block";
        if (disabledBox) disabledBox.style.display = "none";
        if (setupPanel) setupPanel.style.display = "none";

        if (enrolledDateEl && enrolledDate) {
          try {
            enrolledDateEl.textContent = new Date(enrolledDate).toLocaleDateString("en-BD", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });
          } catch (e) {
            enrolledDateEl.textContent = enrolledDate;
          }
        }
      } else {
        if (statusBadge) {
          statusBadge.textContent = "⚪ Not Configured";
          statusBadge.style.cssText = "padding: 3px 8px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 600; background-color: var(--bg-neutral); color: var(--text-muted); border: 1px solid var(--border-color);";
        }
        if (disabledBox) disabledBox.style.display = "block";
        if (enabledBox) enabledBox.style.display = "none";
        if (setupPanel) setupPanel.style.display = "none";
      }
    }
  } catch (err) {
    console.error("Failed to check MFA status:", err);
  }
}

/**
 * Binds event handlers for MFA setup, confirmation, and disabling
 */
function bindMfaEvents() {
  const btnStartSetup = $("btn-mfa-start-setup");
  const btnCopySecret = $("btn-mfa-copy-secret");
  const btnConfirmEnable = $("btn-mfa-confirm-enable");
  const btnOpenDisable = $("btn-mfa-open-disable");
  const btnCloseDisableModal = $("btn-close-disable-mfa-modal");
  const btnCancelDisableMfa = $("btn-cancel-disable-mfa");
  const mfaDisableForm = $("mfa-disable-form");

  const btnCloseRecoveryModal = $("btn-close-mfa-recovery-modal");
  const btnCopyRecovery = $("btn-copy-mfa-recovery");
  const btnDownloadRecovery = $("btn-download-mfa-recovery");

  if (btnStartSetup) {
    btnStartSetup.addEventListener("click", async () => {
      const setupPanel = $("mfa-setup-panel");
      const secretDisplay = $("mfa-secret-display");
      const canvas = $("mfa-qr-canvas");
      const errSpan = $("mfa-setup-error");
      if (errSpan) errSpan.style.display = "none";

      btnStartSetup.disabled = true;
      btnStartSetup.textContent = "Initiating...";

      try {
        const res = await apiFetch("/api/v1/auth/mfa/setup", { method: "POST" });
        const json = await res.json();

        if (res.ok && json.success && json.data) {
          const { secret, qr_code_url, setup_token } = json.data;
          if (secretDisplay) secretDisplay.value = secret;
          if (setupPanel && setup_token) setupPanel.dataset.setupToken = setup_token;

          if (canvas) {
            if (window.QRious) {
              new window.QRious({
                element: canvas,
                value: qr_code_url,
                size: 180,
                level: "H"
              });
            } else {
              // Fallback canvas drawing if library delayed
              const ctx = canvas.getContext("2d");
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, 180, 180);
              ctx.fillStyle = "#000000";
              ctx.font = "12px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("QR Code Ready", 90, 90);
            }
          }

          if (setupPanel) setupPanel.style.display = "block";
        } else {
          alert(json.message || "Failed to initiate MFA setup.");
        }
      } catch (err) {
        alert("Error connecting to server for MFA setup.");
      } finally {
        btnStartSetup.disabled = false;
        btnStartSetup.textContent = "Enable MFA";
      }
    });
  }

  if (btnCopySecret) {
    btnCopySecret.addEventListener("click", () => {
      const secretDisplay = $("mfa-secret-display");
      if (secretDisplay && secretDisplay.value) {
        navigator.clipboard.writeText(secretDisplay.value);
        const orig = btnCopySecret.textContent;
        btnCopySecret.textContent = "Copied!";
        setTimeout(() => {
          btnCopySecret.textContent = orig;
        }, 2000);
      }
    });
  }

  if (btnConfirmEnable) {
    btnConfirmEnable.addEventListener("click", async () => {
      const confirmCodeInput = $("mfa-confirm-code");
      const errSpan = $("mfa-setup-error");
      if (errSpan) errSpan.style.display = "none";

      const code = confirmCodeInput ? confirmCodeInput.value.trim() : "";
      if (!code || code.length !== 6) {
        if (errSpan) {
          errSpan.textContent = "Please enter a valid 6-digit verification code.";
          errSpan.style.display = "block";
        }
        return;
      }

      btnConfirmEnable.disabled = true;
      btnConfirmEnable.textContent = "Activating...";

      try {
        const setupPanel = $("mfa-setup-panel");
        const setupToken = setupPanel ? setupPanel.dataset.setupToken : null;

        const res = await apiFetch("/api/v1/auth/mfa/enable", {
          method: "POST",
          body: JSON.stringify({ code, setup_token: setupToken })
        });

        const json = await res.json();

        if (res.ok && json.success && json.data) {
          mfaRecoveryCodes = json.data.recovery_codes || [];
          displayRecoveryCodesModal(mfaRecoveryCodes);
          if (confirmCodeInput) confirmCodeInput.value = "";
          await checkMfaStatus();

          if (json.data.requires_login || sessionStorage.getItem("mandatorySecurityAction") === "MFA_ENROLLMENT" || sessionStorage.getItem("mustEnrollMfa") === "true") {
            pendingMandatoryLogout = true;
          }

          if (!mfaRecoveryCodes || mfaRecoveryCodes.length === 0) {
            if (pendingMandatoryLogout) {
              clearToken();
              sessionStorage.clear();
              showLoginView("MFA enrollment complete! Please sign in with your credentials.");
            }
          }
        } else {
          if (errSpan) {
            errSpan.textContent = json.message || "Invalid verification code.";
            errSpan.style.display = "block";
          }
        }
      } catch (err) {
        if (errSpan) {
          errSpan.textContent = "Network error activating MFA.";
          errSpan.style.display = "block";
        }
      } finally {
        btnConfirmEnable.disabled = false;
        btnConfirmEnable.textContent = "Activate MFA";
      }
    });
  }

  if (btnOpenDisable) {
    btnOpenDisable.addEventListener("click", () => {
      const modal = $("mfa-disable-modal");
      const form = $("mfa-disable-form");
      const errSpan = $("mfa-disable-error");
      if (form) form.reset();
      if (errSpan) errSpan.style.display = "none";
      if (modal) modal.style.display = "flex";
    });
  }

  const closeDisableFunc = () => {
    const modal = $("mfa-disable-modal");
    if (modal) modal.style.display = "none";
  };

  if (btnCloseDisableModal) btnCloseDisableModal.addEventListener("click", closeDisableFunc);
  if (btnCancelDisableMfa) btnCancelDisableMfa.addEventListener("click", closeDisableFunc);

  if (mfaDisableForm) {
    mfaDisableForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const passInput = $("mfa-disable-password");
      const codeInput = $("mfa-disable-code");
      const errSpan = $("mfa-disable-error");
      if (errSpan) errSpan.style.display = "none";

      const password = passInput ? passInput.value : "";
      const code = codeInput ? codeInput.value.trim() : "";

      if (!password || !code) {
        if (errSpan) {
          errSpan.textContent = "Password and verification code are required.";
          errSpan.style.display = "block";
        }
        return;
      }

      const submitBtn = $("btn-confirm-disable-mfa");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Disabling...";
      }

      try {
        const payload = code.includes("-")
          ? { password, recovery_code: code }
          : { password, code };

        const res = await apiFetch("/api/v1/auth/mfa/disable", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        const json = await res.json();

        if (res.ok && json.success) {
          closeDisableFunc();
          await checkMfaStatus();
        } else {
          if (errSpan) {
            errSpan.textContent = json.message || "Failed to disable MFA.";
            errSpan.style.display = "block";
          }
        }
      } catch (err) {
        if (errSpan) {
          errSpan.textContent = "Network error disabling MFA.";
          errSpan.style.display = "block";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Disable MFA";
        }
      }
    });
  }

  if (btnCloseRecoveryModal) {
    btnCloseRecoveryModal.addEventListener("click", () => {
      const modal = $("mfa-recovery-codes-modal");
      if (modal) modal.style.display = "none";
      if (pendingMandatoryLogout) {
        clearToken();
        sessionStorage.clear();
        showLoginView("MFA enrollment complete! Please sign in with your credentials.");
      }
    });
  }

  if (btnCopyRecovery) {
    btnCopyRecovery.addEventListener("click", () => {
      if (mfaRecoveryCodes.length > 0) {
        navigator.clipboard.writeText(mfaRecoveryCodes.join("\n"));
        alert("Recovery codes copied to clipboard!");
      }
    });
  }

  if (btnDownloadRecovery) {
    btnDownloadRecovery.addEventListener("click", () => {
      if (mfaRecoveryCodes.length > 0) {
        const content = "ROADLINK AUTOMOBILES - MFA RECOVERY CODES\n" +
          "Generated: " + new Date().toISOString() + "\n" +
          "Store these codes securely. Each code can be used once.\n\n" +
          mfaRecoveryCodes.join("\n");
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "roadlink-mfa-recovery-codes.txt";
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }
}

/**
 * Displays the modal containing newly generated recovery codes
 */
function displayRecoveryCodesModal(codes) {
  const modal = $("mfa-recovery-codes-modal");
  const grid = $("mfa-recovery-codes-grid");
  if (!modal || !grid) return;

  grid.innerHTML = "";
  codes.forEach(code => {
    const div = document.createElement("div");
    div.style.cssText = "background: white; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); color: var(--primary-blue);";
    div.textContent = code;
    grid.appendChild(div);
  });

  modal.style.display = "flex";
}

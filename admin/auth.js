/**
 * Roadlink Automobiles - Admin Authentication Module
 * Handles login, logout, password visibility, and session state.
 */

import { $, apiFetch } from "./utils.js";
import { showLoginView } from "./ui.js";

/**
 * Returns the token from sessionStorage if available.
 * Otherwise returns the token from localStorage.
 * @returns {string|null} JWT Token or null
 */
export function getToken() {
  return sessionStorage.getItem("token") || localStorage.getItem("token") || null;
}

/**
 * Saves the token according to rememberMe.
 * @param {string} token 
 * @param {boolean} rememberMe 
 */
export function saveToken(token, rememberMe) {
  // Ensure only one storage contains the token
  sessionStorage.removeItem("token");
  localStorage.removeItem("token");

  if (rememberMe) {
    localStorage.setItem("token", token);
  } else {
    sessionStorage.setItem("token", token);
  }
}
/**
 * Removes the token and user data from BOTH sessionStorage and localStorage.
 */
export function clearToken() {
  localStorage.removeItem("token");
  sessionStorage.clear();
  
  if (window.location.hash && window.location.hash !== "#/login") {
    history.replaceState(null, "", "#/login");
  }
}

/**
 * Initiates server-side logout to invalidate active tokens and clears local session.
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
  } catch (err) {
    console.warn("Logout endpoint error:", err);
  } finally {
    clearToken();
  }
}

/**
 * Retrieves the currently logged-in user object from session storage.
 * @returns {Object|null}
 */
export function getCurrentUser() {
  const userStr = sessionStorage.getItem("currentUser");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Checks if the current user possesses a specific permission key.
 * @param {string} permissionKey 
 * @returns {boolean}
 */
export function hasPermission(permissionKey) {
  const user = getCurrentUser();
  if (!user) return false;
  
  if (Array.isArray(user.permissions)) {
    if (user.permissions.includes("vehicles.manage") && permissionKey.startsWith("vehicles.")) {
      return true;
    }
    if (permissionKey === "vehicles.edit" && user.permissions.includes("vehicles.update")) return true;
    if (permissionKey === "vehicles.update" && user.permissions.includes("vehicles.edit")) return true;
    return user.permissions.includes(permissionKey);
  }
  
  return false;
}

/**
 * Checks if the current administrator is authenticated.
 * @returns {boolean} True if authenticated, false otherwise
 */
export function isAuthenticated() {
  return getToken() !== null;
}

/**
 * Performs backend authentication request.
 * @param {string} username 
 * @param {string} password 
 * @param {boolean} rememberMe 
 * @returns {Promise<Object>} API response payload
 */
export async function login(username, password, rememberMe) {
  try {
    const response = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, rememberMe }),
    });

    const contentType = response.headers.get("content-type") || "";
    let result = {};
    if (contentType.includes("application/json")) {
      result = await response.json();
    }
    return {
      status: response.status,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "An unexpected error occurred."
    };
  }
}

/**
 * Binds password toggle and form submission event listeners for the login form.
 * @param {Function} onLoginSuccess - Callback function executed upon successful login
 */
export function bindLoginEvents(onLoginSuccess) {
  const loginForm = $("login-form");
  const usernameInput = $("username");
  const passwordInput = $("password");
  const btnTogglePassword = $("btn-toggle-password");
  const loginErrorPanel = $("login-error");
  const errorMessageText = $("error-message");

  if (!loginForm || !usernameInput || !passwordInput || !btnTogglePassword) return;

  // 1. Password Visibility Toggle
  btnTogglePassword.addEventListener("click", () => {
    const iconEye = btnTogglePassword.querySelector(".icon-eye");
    const iconEyeOff = btnTogglePassword.querySelector(".icon-eye-off");

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      if (iconEye) iconEye.style.display = "none";
      if (iconEyeOff) iconEyeOff.style.display = "block";
      btnTogglePassword.setAttribute("aria-label", "Hide password");
    } else {
      passwordInput.type = "password";
      if (iconEye) iconEye.style.display = "block";
      if (iconEyeOff) iconEyeOff.style.display = "none";
      btnTogglePassword.setAttribute("aria-label", "Show password");
    }
  });

  // 2. Form Submission Handler
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (loginErrorPanel) loginErrorPanel.style.display = "none";

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const rememberMeCheckbox = $("rememberMe");
    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

    if (!username || !password) {
      showError("Please enter both username and password.");
      return;
    }

    // Disable button or show loading state
    const submitBtn = loginForm.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.textContent : "Sign In";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in...";
    }

    try {
      const res = await login(username, password, rememberMe);
      if (res.success && res.data) {
        if (res.data.token) {
          localStorage.setItem("rememberMe", rememberMe);
          saveToken(res.data.token, rememberMe);
          
          const mandatoryAction = res.data.mandatorySecurityAction || (res.data.mustChangePassword ? "PASSWORD_CHANGE" : (res.data.mustEnrollMfa ? "MFA_ENROLLMENT" : null));

          if (mandatoryAction) {
            sessionStorage.setItem("mandatorySecurityAction", mandatoryAction);
          } else {
            sessionStorage.removeItem("mandatorySecurityAction");
          }

          if (res.data.mustChangePassword || mandatoryAction === "PASSWORD_CHANGE") {
            sessionStorage.setItem("mustChangePassword", "true");
          } else {
            sessionStorage.removeItem("mustChangePassword");
          }

          if (res.data.mustEnrollMfa || mandatoryAction === "MFA_ENROLLMENT") {
            sessionStorage.setItem("mustEnrollMfa", "true");
          } else {
            sessionStorage.removeItem("mustEnrollMfa");
          }

          if (res.data.user) {
            sessionStorage.setItem("currentUser", JSON.stringify(res.data.user));
          } else {
            sessionStorage.removeItem("currentUser");
          }

          sessionStorage.setItem("is_fresh_login", "true");
          sessionStorage.removeItem("redirect_route");
          sessionStorage.removeItem("active_admin_module");
          if (onLoginSuccess) onLoginSuccess();
        } else if (res.data.mfa_required && !res.data.mfa_setup_required) {
          // MFA challenge step for users with configured MFA
          loginForm.style.display = "none";
          const mfaChallenge = $("mfa-challenge-form");
          const mfaSetupForm = $("mfa-mandatory-setup-form");
          if (mfaSetupForm) mfaSetupForm.style.display = "none";

          if (mfaChallenge) {
            mfaChallenge.style.display = "block";
            mfaChallenge.dataset.mfaToken = res.data.mfa_token;
            mfaChallenge.dataset.rememberMe = String(rememberMe);
            const mfaInput = $("mfa-code-input");
            if (mfaInput) {
              mfaInput.value = "";
              mfaInput.focus();
            }
          }
        }
      } else {
        showError(res.message || "Invalid username or password");
      }
    } catch (err) {
      showError("Connection failed. Please try again.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  // 3. MFA Two-Factor Verification Challenge Submission Handler
  const mfaChallengeForm = $("mfa-challenge-form");
  const btnMfaBack = $("btn-mfa-back");

  if (btnMfaBack) {
    btnMfaBack.addEventListener("click", () => {
      if (mfaChallengeForm) mfaChallengeForm.style.display = "none";
      if (loginForm) loginForm.style.display = "block";
      const mfaErr = $("mfa-error-alert");
      if (mfaErr) mfaErr.style.display = "none";
    });
  }

  if (mfaChallengeForm) {
    const mfaErrorAlert = $("mfa-error-alert");
    const mfaErrorMessage = $("mfa-error-message");

    function showMfaError(message) {
      if (mfaErrorMessage) mfaErrorMessage.textContent = message;
      if (mfaErrorAlert) mfaErrorAlert.style.display = "flex";
      const codeInput = $("mfa-code-input");
      if (codeInput) {
        codeInput.select();
        codeInput.focus();
      }
    }

    mfaChallengeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (mfaErrorAlert) mfaErrorAlert.style.display = "none";

      const codeInput = $("mfa-code-input");
      const code = codeInput ? codeInput.value.trim() : "";
      const mfaToken = mfaChallengeForm.dataset.mfaToken;
      const rememberMe = mfaChallengeForm.dataset.rememberMe === "true";

      if (!code) {
        showMfaError("Please enter your 6-digit verification code or recovery code.");
        return;
      }

      const submitBtn = mfaChallengeForm.querySelector("button[type='submit']");
      const originalText = submitBtn ? submitBtn.textContent : "Verify & Sign In";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying...";
      }

      try {
        const payload = code.includes("-")
          ? { mfa_token: mfaToken, recovery_code: code }
          : { mfa_token: mfaToken, code: code };

        const response = await apiFetch("/api/v1/auth/mfa/verify", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        const res = await response.json();

        if (response.ok && res.success && res.data && res.data.token) {
          localStorage.setItem("rememberMe", rememberMe);
          saveToken(res.data.token, rememberMe);

          // Clean up MFA dataset & subform state immediately
          if (mfaChallengeForm) {
            delete mfaChallengeForm.dataset.mfaToken;
            delete mfaChallengeForm.dataset.rememberMe;
            mfaChallengeForm.style.display = "none";
          }
          if (loginForm) {
            loginForm.style.display = "block";
          }
          const mfaInput = $("mfa-code-input");
          if (mfaInput) mfaInput.value = "";

          if (res.data.mustChangePassword) {
            sessionStorage.setItem("mustChangePassword", "true");
          } else {
            sessionStorage.removeItem("mustChangePassword");
          }

          if (res.data.user) {
            sessionStorage.setItem("currentUser", JSON.stringify(res.data.user));
          }

          sessionStorage.setItem("is_fresh_login", "true");
          sessionStorage.removeItem("redirect_route");
          sessionStorage.removeItem("active_admin_module");
          if (onLoginSuccess) onLoginSuccess();
        } else {
          const errCode = res.code || (res.data && res.data.code);

          if (errCode === "MFA_CHALLENGE_EXPIRED" || errCode === "SESSION_INVALIDATED" || errCode === "ACCOUNT_DISABLED") {
            clearToken();
            showLoginView(res.message || "Your MFA verification session has expired. Please sign in again.");
          } else if (errCode === "ACCOUNT_LOCKED" || response.status === 403 || response.status === 429) {
            clearToken();
            showLoginView(res.message || "Account is temporarily locked due to too many failed attempts. Please try again later.");
          } else {
            // Normal incorrect OTP: Keep user on MFA page and display error
            let msg = res.message || "Invalid verification code or recovery code. Please try again.";
            if (typeof res.attempts_remaining === "number" && res.attempts_remaining > 0) {
              msg = `Invalid verification code. Please try again (${res.attempts_remaining} attempt${res.attempts_remaining === 1 ? '' : 's'} remaining).`;
            }
            showMfaError(msg);
          }
        }
      } catch (err) {
        showMfaError("MFA verification failed. Please try again.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  // 4. Mandatory MFA Enrollment Form Handler
  const mfaMandatoryForm = $("mfa-mandatory-setup-form");
  const btnMfaMandatoryBack = $("btn-mfa-mandatory-back");
  const btnCopyMandatorySecret = $("btn-mfa-mandatory-copy-secret");

  if (btnCopyMandatorySecret) {
    btnCopyMandatorySecret.addEventListener("click", () => {
      const secretInput = $("mfa-mandatory-secret-display");
      if (secretInput && secretInput.value) {
        navigator.clipboard.writeText(secretInput.value).then(() => {
          const origText = btnCopyMandatorySecret.textContent;
          btnCopyMandatorySecret.textContent = "Copied!";
          setTimeout(() => { btnCopyMandatorySecret.textContent = origText; }, 2000);
        }).catch(() => {
          secretInput.select();
        });
      }
    });
  }

  if (btnMfaMandatoryBack) {
    btnMfaMandatoryBack.addEventListener("click", () => {
      if (mfaMandatoryForm) mfaMandatoryForm.style.display = "none";
      if (loginForm) loginForm.style.display = "block";
      const errAlert = $("mfa-mandatory-error-alert");
      if (errAlert) errAlert.style.display = "none";
    });
  }

  if (mfaMandatoryForm) {
    const errAlert = $("mfa-mandatory-error-alert");
    const errMsg = $("mfa-mandatory-error-message");

    function showMandatoryMfaError(message) {
      if (errMsg) errMsg.textContent = message;
      if (errAlert) errAlert.style.display = "flex";
      const codeInput = $("mfa-mandatory-code-input");
      if (codeInput) {
        codeInput.select();
        codeInput.focus();
      }
    }

    mfaMandatoryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errAlert) errAlert.style.display = "none";

      const codeInput = $("mfa-mandatory-code-input");
      const code = codeInput ? codeInput.value.trim() : "";
      const mfaToken = mfaMandatoryForm.dataset.mfaToken;
      const setupToken = mfaMandatoryForm.dataset.setupToken || mfaToken;

      if (!code) {
        showMandatoryMfaError("Please enter the 6-digit code from your authenticator app.");
        return;
      }

      const submitBtn = mfaMandatoryForm.querySelector("button[type='submit']");
      const originalText = submitBtn ? submitBtn.textContent : "Activate & Continue";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Activating...";
      }

      try {
        const response = await apiFetch("/api/v1/auth/mfa/enable", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${setupToken}`
          },
          body: JSON.stringify({ code, setup_token: setupToken })
        });

        const res = await response.json();

        if (response.ok && res.success) {
          // Immediately terminate temporary authentication session
          clearToken();
          sessionStorage.clear();

          const handleMandatoryComplete = () => {
            if (mfaMandatoryForm) mfaMandatoryForm.style.display = "none";
            const loginFormEl = $("login-form");
            if (loginFormEl) loginFormEl.style.display = "block";

            // Show informative message on login screen
            const loginErrorPanel = $("login-error");
            const errorMessageText = $("error-message");
            if (loginErrorPanel && errorMessageText) {
              errorMessageText.textContent = "MFA enrollment complete! Please sign in with your credentials.";
              loginErrorPanel.style.display = "flex";
              loginErrorPanel.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
              loginErrorPanel.style.borderColor = "#10b981";
              loginErrorPanel.style.color = "#047857";
            }
          };

          if (Array.isArray(res.data?.recovery_codes) && res.data.recovery_codes.length > 0) {
            if (typeof window.displayRecoveryCodesModal === "function") {
              window.displayRecoveryCodesModal(res.data.recovery_codes, () => {
                handleMandatoryComplete();
              });
              return;
            }
          }

          handleMandatoryComplete();
        } else {
          showMandatoryMfaError(res.message || "Invalid verification code. Please check your app and try again.");
        }
      } catch (err) {
        showMandatoryMfaError("Failed to enable MFA. Please try again.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  function showError(message) {
    if (errorMessageText) errorMessageText.textContent = message;
    if (loginErrorPanel) loginErrorPanel.style.display = "flex";
    
    passwordInput.select();
    passwordInput.focus();
  }
}

/**
 * Binds click listeners to logout buttons to terminate session.
 * @param {Function} onLogoutSuccess - Callback function executed upon sign out
 */
export function bindLogoutEvents(onLogoutSuccess) {
  const btnSidebarLogout = $("btn-sidebar-logout");
  const btnTopbarLogout = $("btn-topbar-logout");
  const btnIdleLogout = $("btn-idle-logout");

  const handleLogout = async () => {
    await logout();
    if (onLogoutSuccess) onLogoutSuccess();
  };

  if (btnSidebarLogout) {
    btnSidebarLogout.addEventListener("click", handleLogout);
  }

  if (btnTopbarLogout) {
    btnTopbarLogout.addEventListener("click", handleLogout);
  }

  if (btnIdleLogout) {
    btnIdleLogout.addEventListener("click", handleLogout);
  }
}

/**
 * Verifies that the stored token is still valid.
 * If invalid, clears the session.
 *
 * @returns {Promise<boolean>}
 */
export async function validateSession() {
  if (!isAuthenticated()) {
    return false;
  }

  try {
    const response = await apiFetch("/api/v1/admin/settings");

  if (!response.ok) {
    return false;
  }

  return true;
    return response.ok;
  
  } catch {
    clearToken();
    return false;
  }
}

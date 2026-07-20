/**
 * Roadlink Automobiles - Admin Authentication Module
 * Handles login, logout, password visibility, and session state.
 */

import { $, apiFetch } from "./utils.js";

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
 * Removes the token from BOTH sessionStorage and localStorage.
 */
export function clearToken() {
  sessionStorage.removeItem("token");
  localStorage.removeItem("token");
  sessionStorage.removeItem("mustChangePassword");
  sessionStorage.removeItem("currentUser");
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

    const result = await response.json();
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
      if (res.success && res.data && res.data.token) {
        localStorage.setItem("rememberMe", rememberMe);
        saveToken(res.data.token, rememberMe);
        
        if (res.data.mustChangePassword) {
          sessionStorage.setItem("mustChangePassword", "true");
        } else {
          sessionStorage.removeItem("mustChangePassword");
        }

        if (res.data.user) {
          sessionStorage.setItem("currentUser", JSON.stringify(res.data.user));
        } else {
          sessionStorage.removeItem("currentUser");
        }

        if (onLoginSuccess) onLoginSuccess();
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

  const handleLogout = () => {
    clearToken();
    if (onLogoutSuccess) onLogoutSuccess();
  };

  if (btnSidebarLogout) {
    btnSidebarLogout.addEventListener("click", handleLogout);
  }

  if (btnTopbarLogout) {
    btnTopbarLogout.addEventListener("click", handleLogout);
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

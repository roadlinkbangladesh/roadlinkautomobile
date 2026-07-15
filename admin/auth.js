/**
 * Roadlink Automobiles - Admin Authentication Module
 * Handles login, logout, password visibility, and session state.
 */

import { ADMIN_SESSION_KEY, ADMIN_CREDENTIALS } from "./config.js";
import { $ } from "./utils.js";

/**
 * Checks if the current administrator session is authenticated.
 * @returns {boolean} True if authenticated, false otherwise
 */
export function isAuthenticated() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

/**
 * Validates the administrator credentials.
 * @param {string} username 
 * @param {string} password 
 * @returns {boolean} True if valid, false otherwise
 */
export function validateCredentials(username, password) {
  const currentPassword = localStorage.getItem("roadlink_admin_password") || ADMIN_CREDENTIALS.password;
  return username === ADMIN_CREDENTIALS.username && password === currentPassword;
}

/**
 * Sets the authenticated session.
 */
export function setAuthenticatedSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
}

/**
 * Clears the authenticated session.
 */
export function clearAuthenticatedSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
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
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (loginErrorPanel) loginErrorPanel.style.display = "none";

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError("Please enter both username and password.");
      return;
    }

    if (validateCredentials(username, password)) {
      setAuthenticatedSession();
      if (onLoginSuccess) onLoginSuccess();
    } else {
      showError("Invalid username or password");
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
    clearAuthenticatedSession();
    if (onLogoutSuccess) onLogoutSuccess();
  };

  if (btnSidebarLogout) {
    btnSidebarLogout.addEventListener("click", handleLogout);
  }

  if (btnTopbarLogout) {
    btnTopbarLogout.addEventListener("click", handleLogout);
  }
}

import { $ } from "./utils.js";

export function showLoginView(reasonMessage = null) {
  const loginView = $("login-view");
  const adminLayout = $("admin-layout");
  const usernameInput = $("username");
  const passwordInput = $("password");
  const loginErrorPanel = $("login-error");
  const errorMessageText = $("error-message");

  // Close all open dialogs, modals, drawers, and overlays
  document.querySelectorAll(".modal, .modal-backdrop, .overlay, .drawer, dialog").forEach(el => {
    el.classList.remove("active", "show", "open");
    if (el.style && el.tagName !== "DIALOG") {
      el.style.display = "none";
    }
    if (typeof el.close === "function") {
      try { el.close(); } catch (e) {}
    }
  });

  if (loginView) loginView.style.display = "flex";
  if (adminLayout) adminLayout.style.display = "none";

  // Reset inputs safely
  if (usernameInput) {
    usernameInput.value = "";
    usernameInput.focus();
  }
  if (passwordInput) {
    passwordInput.value = "";
    passwordInput.type = "password";
  }

  if (reasonMessage) {
    if (errorMessageText) errorMessageText.textContent = reasonMessage;
    if (loginErrorPanel) loginErrorPanel.style.display = "flex";
  } else if (loginErrorPanel) {
    loginErrorPanel.style.display = "none";
  }

  //Reset Remember Me Option based on memory
  const rememberMeCheckbox = $("rememberMe");

  if (rememberMeCheckbox) {
    rememberMeCheckbox.checked =
      localStorage.getItem("rememberMe") === "true";
  }

  // Ensure toggled eye icon state resets
  const btnTogglePassword = $("btn-toggle-password");
  if (btnTogglePassword) {
    const iconEye = btnTogglePassword.querySelector(".icon-eye");
    const iconEyeOff = btnTogglePassword.querySelector(".icon-eye-off");
    if (iconEye) iconEye.style.display = "block";
    if (iconEyeOff) iconEyeOff.style.display = "none";
    btnTogglePassword.setAttribute("aria-label", "Show password");
  }
}

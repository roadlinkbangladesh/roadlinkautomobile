import { $ } from "./utils.js";

export function showLoginView(reasonMessage = null) {
  const loginView = $("login-view");
  const adminLayout = $("admin-layout");
  const loginForm = $("login-form");
  const mfaChallengeForm = $("mfa-challenge-form");
  const mfaMandatorySetupForm = $("mfa-mandatory-setup-form");
  
  const usernameInput = $("username");
  const passwordInput = $("password");
  const mfaCodeInput = $("mfa-code-input");
  const mfaMandatoryCodeInput = $("mfa-mandatory-code-input");

  const loginErrorPanel = $("login-error");
  const errorMessageText = $("error-message");
  const mfaErrorAlert = $("mfa-error-alert");
  const mfaMandatoryErrorAlert = $("mfa-mandatory-error-alert");

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

  // Reset login screen sub-forms so we ALWAYS present the primary login form
  if (loginForm) loginForm.style.display = "block";
  if (mfaChallengeForm) {
    mfaChallengeForm.style.display = "none";
    delete mfaChallengeForm.dataset.mfaToken;
    delete mfaChallengeForm.dataset.rememberMe;
  }
  if (mfaMandatorySetupForm) {
    mfaMandatorySetupForm.style.display = "none";
    delete mfaMandatorySetupForm.dataset.mfaToken;
    delete mfaMandatorySetupForm.dataset.setupToken;
  }

  // Clear inputs safely
  if (usernameInput) {
    usernameInput.value = "";
  }
  if (passwordInput) {
    passwordInput.value = "";
    passwordInput.type = "password";
  }
  if (mfaCodeInput) {
    mfaCodeInput.value = "";
  }
  if (mfaMandatoryCodeInput) {
    mfaMandatoryCodeInput.value = "";
  }

  // Clear error panels
  if (loginErrorPanel) loginErrorPanel.style.display = "none";
  if (mfaErrorAlert) mfaErrorAlert.style.display = "none";
  if (mfaMandatoryErrorAlert) mfaMandatoryErrorAlert.style.display = "none";

  if (reasonMessage) {
    if (errorMessageText) errorMessageText.textContent = reasonMessage;
    if (loginErrorPanel) loginErrorPanel.style.display = "flex";
  }

  // Reset Remember Me Option based on memory
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

  // Ensure window hash is set to #/login
  if (window.location.hash !== "#/login") {
    history.replaceState(null, "", "#/login");
  }

  if (usernameInput) {
    usernameInput.focus();
  }
}

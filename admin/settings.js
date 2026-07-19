/**
 * Roadlink Automobiles - Settings View Controller
 * Integrates with the backend REST API for system settings.
 */

import { getToken, clearToken } from "./auth.js";
import { showLoginView } from "./ui.js";
import { $, apiFetch } from "./utils.js";

let settingsEventsBound = false;

/**
 * Initializes and hydrates the Settings View fields from the backend API.
 */
export function initSettingsView() {
  loadSettings();
  if (!settingsEventsBound) {
    bindSettingsEvents();
    settingsEventsBound = true;
  }
}

/**
 * Fetches settings from the backend REST API and pre-fills form fields.
 */
async function loadSettings() {
  const token = getToken();
  if (!token) {
    showLoginView();
    return;
  }

  const form = $("settings-form");
  const loadingContainer = $("settings-loading-container");
  const errorContainer = $("settings-error-container");

  // Show loading state, hide other panels
  if (loadingContainer) loadingContainer.style.display = "block";
  if (errorContainer) errorContainer.style.display = "none";
  if (form) {
    form.style.display = "none";
    disableFormElements(form, true);
  }

  try {
    const response = await apiFetch("/api/v1/admin/settings", {
      method: "GET"
    });

    if (response.status === 401) {
      clearToken();
      showLoginView();
      return;
    }

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload && payload.success && payload.data) {
      // Hide loading, show form, enable form elements, and populate
      if (loadingContainer) loadingContainer.style.display = "none";
      if (form) {
        form.style.display = "block";
        disableFormElements(form, false);
      }
      populateForm(payload.data);
    } else {
      throw new Error(payload.message || "Failed to load settings configuration.");
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
    if (loadingContainer) loadingContainer.style.display = "none";
    if (errorContainer) {
      errorContainer.style.display = "block";
      const errorText = $("settings-error-text");
      if (errorText) {
        errorText.textContent = err.message || "Failed to load system settings.";
      }
    }
  }
}

/**
 * Populates all Settings view input fields with retrieved settings data.
 * @param {Object} data - Settings configuration data from the backend
 */
function populateForm(data) {
  const companyField = $("set-company-name");
  const addressField = $("set-address");
  const phoneField = $("set-phone");
  const whatsappField = $("set-whatsapp");
  const emailField = $("set-email");
  const facebookField = $("set-facebook");
  const youtubeField = $("set-youtube");
  const seoSuffixField = $("set-seo-suffix");
  const seoKeywordsField = $("set-seo-keywords");
  const seoDescField = $("set-seo-desc");

  // Populate fields handling both camelCase and snake_case backend schemas
  if (companyField) companyField.value = data.companyName || data.company_name || "";
  if (addressField) addressField.value = data.address || "";
  if (phoneField) phoneField.value = data.phone || "";
  if (whatsappField) whatsappField.value = data.whatsapp || "";
  if (emailField) emailField.value = data.email || "";
  
  if (facebookField) facebookField.value = data.facebookUrl || data.facebook_url || "";
  if (youtubeField) youtubeField.value = data.youtubeUrl || data.youtube_url || "";
  
  if (seoSuffixField) seoSuffixField.value = data.seoTitleSuffix || data.seo_title_suffix || "";
  if (seoKeywordsField) seoKeywordsField.value = data.seoDefaultKeywords || data.seo_default_keywords || "";
  if (seoDescField) seoDescField.value = data.seoDefaultDescription || data.seo_default_description || "";

  // Reset and clear security inputs safely
  const currPass = $("set-curr-pass");
  const newPass = $("set-new-pass");
  const confPass = $("set-conf-pass");
  if (currPass) currPass.value = "";
  if (newPass) newPass.value = "";
  if (confPass) confPass.value = "";
}

/**
 * Enables or disables all inputs, selects, and buttons inside a form container.
 * @param {HTMLElement} form - The form container element
 * @param {boolean} disabled - Whether to disable elements
 */
function disableFormElements(form, disabled) {
  const elements = form.querySelectorAll("input, select, textarea, button");
  elements.forEach(element => {
    element.disabled = disabled;
  });
}

/**
 * Binds Settings panel interactive triggers and form submissions.
 */
function bindSettingsEvents() {
  const form = $("settings-form");
  const retryBtn = $("btn-retry-settings");
  const btnReset = $("btn-reset-settings");
  const btnSave = $("btn-save-settings");

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      // Do NOT implement Save functionality as per instructions
    };
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      loadSettings();
    });
  }

  // Disable save/reset triggers as save functionality is not implemented in v1
  if (btnReset) {
    btnReset.disabled = true;
    btnReset.addEventListener("click", (e) => {
      e.preventDefault();
    });
  }

  if (btnSave) {
    btnSave.disabled = true;
  }
}

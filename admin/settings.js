/**
 * Roadlink Automobiles - Settings View Controller
 * Binds forms and manages global configuration persistence.
 */

import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../js/settings-loader.js";
import { ADMIN_CREDENTIALS } from "./config.js";
import { $ } from "./utils.js";

/**
 * Initializes and hydarates the Settings View fields.
 */
export function initSettingsView() {
  hydrateFields();
  bindSettingsEvents();
}

/**
 * Reads settings and pre-fills form fields
 */
function hydrateFields() {
  const settings = getSettings();

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

  if (companyField) companyField.value = settings.companyName || "";
  if (addressField) addressField.value = settings.address || "";
  if (phoneField) phoneField.value = settings.phone || "";
  if (whatsappField) whatsappField.value = settings.whatsapp || "";
  if (emailField) emailField.value = settings.email || "";
  
  if (facebookField) facebookField.value = settings.facebookUrl || "";
  if (youtubeField) youtubeField.value = settings.youtubeUrl || "";
  
  if (seoSuffixField) seoSuffixField.value = settings.seoTitleSuffix || "";
  if (seoKeywordsField) seoKeywordsField.value = settings.seoDefaultKeywords || "";
  if (seoDescField) seoDescField.value = settings.seoDefaultDescription || "";

  // Clear password change fields
  const currPass = $("set-curr-pass");
  const newPass = $("set-new-pass");
  const confPass = $("set-conf-pass");
  if (currPass) currPass.value = "";
  if (newPass) newPass.value = "";
  if (confPass) confPass.value = "";
}

/**
 * Binds Settings panel triggers and form submissions.
 */
function bindSettingsEvents() {
  const form = $("settings-form");
  const btnReset = $("btn-reset-settings");

  const successAlert = $("settings-alert-success");
  const errorAlert = $("settings-alert-error");

  if (!form) return;

  // Handle Form Submission
  form.onsubmit = (e) => {
    e.preventDefault();
    if (successAlert) successAlert.style.display = "none";
    if (errorAlert) errorAlert.style.display = "none";

    // Gather settings
    const companyName = $("set-company-name").value.trim();
    const address = $("set-address").value.trim();
    const phone = $("set-phone").value.trim();
    const whatsapp = $("set-whatsapp").value.trim();
    const email = $("set-email").value.trim();
    const facebookUrl = $("set-facebook").value.trim();
    const youtubeUrl = $("set-youtube").value.trim();
    const seoTitleSuffix = $("set-seo-suffix").value.trim();
    const seoDefaultKeywords = $("set-seo-keywords").value.trim();
    const seoDefaultDescription = $("set-seo-desc").value.trim();

    // Basic required validation
    if (!companyName || !address || !phone || !whatsapp || !email) {
      showError("Please fill out all required (*) profile fields.");
      return;
    }

    // Password Changing validation
    const currPassVal = $("set-curr-pass").value;
    const newPassVal = $("set-new-pass").value;
    const confPassVal = $("set-conf-pass").value;

    if (currPassVal || newPassVal || confPassVal) {
      if (!currPassVal || !newPassVal || !confPassVal) {
        showError("To change your administrative password, you must enter current, new, and confirmation fields.");
        return;
      }

      // Check current password
      const activePassword = localStorage.getItem("roadlink_admin_password") || ADMIN_CREDENTIALS.password;
      if (currPassVal !== activePassword) {
        showError("The 'Current Password' you entered is incorrect.");
        return;
      }

      // Check new matches confirm
      if (newPassVal !== confPassVal) {
        showError("The 'New Password' and 'Confirm New Password' fields do not match.");
        return;
      }

      // Change successful, save in localStorage
      localStorage.setItem("roadlink_admin_password", newPassVal);
    }

    // Save Settings
    const updatedSettings = {
      companyName,
      address,
      phone,
      whatsapp,
      email,
      facebookUrl,
      youtubeUrl,
      seoTitleSuffix,
      seoDefaultKeywords,
      seoDefaultDescription
    };

    const saved = saveSettings(updatedSettings);

    if (saved) {
      if (successAlert) {
        successAlert.style.display = "flex";
        successAlert.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      
      // Clear password inputs on successful save
      const currPass = $("set-curr-pass");
      const newPass = $("set-new-pass");
      const confPass = $("set-conf-pass");
      if (currPass) currPass.value = "";
      if (newPass) newPass.value = "";
      if (confPass) confPass.value = "";

      // Hide success alert after 5 seconds
      setTimeout(() => {
        if (successAlert) successAlert.style.display = "none";
      }, 5000);
    } else {
      showError("Failed to save settings. Local storage might be full or blocked.");
    }
  };

  // Reset Button trigger
  if (btnReset) {
    btnReset.onclick = () => {
      if (confirm("Are you sure you want to restore all settings to their original factory defaults? This cannot be undone.")) {
        saveSettings(DEFAULT_SETTINGS);
        hydrateFields();
        if (successAlert) {
          successAlert.querySelector("span").textContent = "All settings have been restored to defaults!";
          successAlert.style.display = "flex";
          setTimeout(() => {
            successAlert.style.display = "none";
            successAlert.querySelector("span").textContent = "Settings updated and persistent globally across Roadlink Automobiles!";
          }, 4000);
        }
      }
    };
  }

  function showError(msg) {
    if (errorAlert) {
      errorAlert.textContent = msg;
      errorAlert.style.display = "block";
      errorAlert.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

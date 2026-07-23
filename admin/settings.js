/**
 * Roadlink Automobiles - Settings View Controller
 * Integrates with the backend REST API for system settings.
 */

import { getToken, clearToken, hasPermission } from "./auth.js";
import { showLoginView } from "./ui.js";
import { $, apiFetch } from "./utils.js";

let settingsEventsBound = false;

const SYSTEM_DEFAULTS = {
  companyName: "Roadlink Automobiles",
  address: "169 (Level 2), Fakirerpool, Dhaka 1000",
  phone: "+880 1311-503840",
  showroomAddress: "169 (Level 2), Fakirerpool, Dhaka 1000",
  showroomPhone: "+880 1311-503840",
  showShowroom: true,
  corporateAddress: "House 42, Road 11, Block D, Banani, Dhaka 1213",
  corporatePhone: "+880 1711-998877",
  showCorporate: false,
  contactName: "Sales Helpline / Managing Officer",
  contactPhone: "+880 1311-503840",
  showPrimaryContact: false,
  whatsapp: "8801311503840",
  showWhatsapp: true,
  email: "roadlinkbangladesh@gmail.com",
  showEmail: true,
  facebookUrl: "https://www.facebook.com/roadlinkautomobiles",
  youtubeUrl: "https://www.youtube.com/@roadlinkautomobiles9168",
  displayTimezone: "Asia/Dhaka",
  displayLocale: "en-BD",
  defaultCurrency: "BDT",
  sessionTimeoutMinutes: 30,
  archiveRetentionDays: 180,
  seoTitleSuffix: "Roadlink Automobiles",
  seoDefaultKeywords: "Japanese cars, reconditioned cars, Dhaka car importer, Toyota Axio, Honda Vezel, Nissan X-Trail, Roadlink Automobiles Bangladesh",
  seoDefaultDescription: "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock."
};

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
  const successAlert = $("settings-alert-success");
  const errorAlert = $("settings-alert-error");

  if (successAlert) successAlert.style.display = "none";
  if (errorAlert) errorAlert.style.display = "none";

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

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload && payload.success && payload.data) {
      // Hide loading, show form, enable form elements, and populate
      if (loadingContainer) loadingContainer.style.display = "none";
      if (form) {
        form.style.display = "block";
      }
      populateForm(payload.data);
      applyPermissions();
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
  
  // Showroom
  const showroomAddressField = $("set-showroom-address");
  const showroomPhoneField = $("set-showroom-phone");
  const showShowroomCheck = $("set-show-showroom");

  // Corporate Office
  const corporateAddressField = $("set-corporate-address");
  const corporatePhoneField = $("set-corporate-phone");
  const showCorporateCheck = $("set-show-corporate");

  // Primary Contact
  const contactNameField = $("set-contact-name");
  const contactPhoneField = $("set-contact-phone");
  const showPrimaryContactCheck = $("set-show-primary-contact");

  // WhatsApp
  const whatsappField = $("set-whatsapp");
  const showWhatsappCheck = $("set-show-whatsapp");

  // Email
  const emailField = $("set-email");
  const showEmailCheck = $("set-show-email");

  // Social & SEO
  const facebookField = $("set-facebook");
  const youtubeField = $("set-youtube");
  const seoSuffixField = $("set-seo-suffix");
  const seoKeywordsField = $("set-seo-keywords");
  const seoDescField = $("set-seo-desc");

  // System settings
  const displayTimezoneField = $("set-display-timezone");
  const displayLocaleField = $("set-display-locale");
  const defaultCurrencyField = $("set-default-currency");

  if (companyField) companyField.value = data.companyName || data.company_name || "";

  // Populate Showroom
  if (showroomAddressField) showroomAddressField.value = data.showroomAddress || data.showroom_address || data.address || "";
  if (showroomPhoneField) showroomPhoneField.value = data.showroomPhone || data.showroom_phone || data.phone || "";
  if (showShowroomCheck) showShowroomCheck.checked = (data.showShowroom ?? data.show_showroom ?? 1) == 1;

  // Populate Corporate
  if (corporateAddressField) corporateAddressField.value = data.corporateAddress || data.corporate_address || "";
  if (corporatePhoneField) corporatePhoneField.value = data.corporatePhone || data.corporate_phone || "";
  if (showCorporateCheck) showCorporateCheck.checked = (data.showCorporate ?? data.show_corporate ?? 0) == 1;

  // Populate Primary Contact
  if (contactNameField) contactNameField.value = data.contactName || data.contact_name || "";
  if (contactPhoneField) contactPhoneField.value = data.contactPhone || data.contact_phone || "";
  if (showPrimaryContactCheck) showPrimaryContactCheck.checked = (data.showPrimaryContact ?? data.show_primary_contact ?? 0) == 1;

  // Populate WhatsApp
  if (whatsappField) whatsappField.value = data.whatsapp || "";
  if (showWhatsappCheck) showWhatsappCheck.checked = (data.showWhatsapp ?? data.show_whatsapp ?? 1) == 1;

  // Populate Email
  if (emailField) emailField.value = data.email || "";
  if (showEmailCheck) showEmailCheck.checked = (data.showEmail ?? data.show_email ?? 1) == 1;

  // Social & SEO
  if (facebookField) facebookField.value = data.facebookUrl || data.facebook_url || data.facebook || "";
  if (youtubeField) youtubeField.value = data.youtubeUrl || data.youtube_url || data.youtube || "";
  
  if (seoSuffixField) seoSuffixField.value = data.seoTitleSuffix || data.seo_title_suffix || "";
  if (seoKeywordsField) seoKeywordsField.value = data.seoDefaultKeywords || data.seo_default_keywords || "";
  if (seoDescField) seoDescField.value = data.seoDefaultDescription || data.seo_default_description || "";

  if (displayTimezoneField) displayTimezoneField.value = data.displayTimezone || data.display_timezone || "Asia/Dhaka";
  if (displayLocaleField) displayLocaleField.value = data.displayLocale || data.display_locale || "en-BD";
  if (defaultCurrencyField) defaultCurrencyField.value = data.defaultCurrency || data.default_currency || "BDT";
}

/**
 * Applies role-based permissions dynamically on the settings form.
 * If user does not have settings.edit permission, make fields read-only and hide submit buttons.
 */
function applyPermissions() {
  const form = $("settings-form");
  const canEdit = hasPermission("settings.edit");
  const btnReset = $("btn-reset-settings");
  const btnSave = $("btn-save-settings");

  if (form) {
    disableFormElements(form, !canEdit);
  }

  if (btnReset) {
    btnReset.style.display = canEdit ? "inline-flex" : "none";
    btnReset.disabled = !canEdit;
  }
  if (btnSave) {
    btnSave.style.display = canEdit ? "inline-flex" : "none";
    btnSave.disabled = !canEdit;
  }
}

/**
 * Enables or disables all inputs, selects, and textareas inside a form container.
 * @param {HTMLElement} form - The form container element
 * @param {boolean} disabled - Whether to disable elements
 */
function disableFormElements(form, disabled) {
  const elements = form.querySelectorAll("input, select, textarea");
  elements.forEach(element => {
    element.disabled = disabled;
  });
}

/**
 * Handles form submit to save settings.
 */
async function handleSettingsSubmit(e) {
  e.preventDefault();

  if (!hasPermission("settings.edit")) {
    alert("Access Denied: You do not have permission to modify system settings.");
    return;
  }

  const successAlert = $("settings-alert-success");
  const errorAlert = $("settings-alert-error");
  const btnSave = $("btn-save-settings");

  if (successAlert) successAlert.style.display = "none";
  if (errorAlert) errorAlert.style.display = "none";

  const companyName = $("set-company-name")?.value || "";
  
  const showroomAddress = $("set-showroom-address")?.value || "";
  const showroomPhone = $("set-showroom-phone")?.value || "";
  const showShowroom = $("set-show-showroom")?.checked ?? true;

  const corporateAddress = $("set-corporate-address")?.value || "";
  const corporatePhone = $("set-corporate-phone")?.value || "";
  const showCorporate = $("set-show-corporate")?.checked ?? false;

  const contactName = $("set-contact-name")?.value || "";
  const contactPhone = $("set-contact-phone")?.value || "";
  const showPrimaryContact = $("set-show-primary-contact")?.checked ?? false;

  const whatsapp = $("set-whatsapp")?.value || "";
  const showWhatsapp = $("set-show-whatsapp")?.checked ?? true;

  const email = $("set-email")?.value || "";
  const showEmail = $("set-show-email")?.checked ?? true;

  const facebookUrl = $("set-facebook")?.value || "";
  const youtubeUrl = $("set-youtube")?.value || "";
  const displayTimezone = $("set-display-timezone")?.value || "";
  const displayLocale = $("set-display-locale")?.value || "";
  const defaultCurrency = $("set-default-currency")?.value || "";
  const seoTitleSuffix = $("set-seo-suffix")?.value || "";
  const seoDefaultKeywords = $("set-seo-keywords")?.value || "";
  const seoDefaultDescription = $("set-seo-desc")?.value || "";

  if (!companyName) {
    if (errorAlert) {
      errorAlert.textContent = "Please fill in all required fields marked with *.";
      errorAlert.style.display = "block";
    }
    return;
  }

  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = "Saving Settings...";
  }

  try {
    const response = await apiFetch("/api/v1/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        companyName,
        showroomAddress, showroomPhone, showShowroom,
        corporateAddress, corporatePhone, showCorporate,
        contactName, contactPhone, showPrimaryContact,
        whatsapp, showWhatsapp,
        email, showEmail,
        facebookUrl, youtubeUrl, displayTimezone, displayLocale,
        defaultCurrency,
        seoTitleSuffix, seoDefaultKeywords, seoDefaultDescription
      })
    });

    const payload = await response.json();
    if (response.ok && payload.success) {
      if (successAlert) {
        successAlert.style.display = "flex";
        setTimeout(() => {
          successAlert.style.display = "none";
        }, 4000);
      }
    } else {
      throw new Error(payload.message || "Failed to update settings.");
    }
  } catch (err) {
    console.error("Save settings failed:", err);
    if (errorAlert) {
      errorAlert.textContent = err.message || "An error occurred while saving settings.";
      errorAlert.style.display = "block";
    }
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = "Save System Settings";
    }
  }
}

/**
 * Handles reset to default parameters.
 */
function handleResetClick(e) {
  e.preventDefault();
  if (confirm("Are you sure you want to revert settings to factory defaults? You will need to click 'Save' to apply changes.")) {
    populateForm(SYSTEM_DEFAULTS);
  }
}

/**
 * Binds Settings panel interactive triggers and form submissions.
 */
function bindSettingsEvents() {
  const form = $("settings-form");
  const retryBtn = $("btn-retry-settings");
  const btnReset = $("btn-reset-settings");

  if (form) {
    form.addEventListener("submit", handleSettingsSubmit);
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      loadSettings();
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", handleResetClick);
  }
}

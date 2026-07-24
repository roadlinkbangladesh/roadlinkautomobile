/**
 * Roadlink Automobiles - Settings View Controller
 * Integrates with the backend REST API for system settings.
 */

import { getToken, clearToken, hasPermission } from "./auth.js";
import { showLoginView } from "./ui.js";
import { $, apiFetch } from "./utils.js";
import { initLocationsView } from "./locations.js";
import { initCarouselView } from "./carousel.js";
import { initTestimonialsView } from "./testimonials.js";
import { uploadFileAsync } from "../js/inventory.js";
import { getPublicFileUrl } from "../js/shared/api.js";

let settingsEventsBound = false;
let activeSubtab = "company";

const SYSTEM_DEFAULTS = {
  companyName: "Roadlink Automobiles",
  whatsapp: "8801311503840",
  showWhatsapp: true,
  email: "roadlinkbangladesh@gmail.com",
  showEmail: true,
  facebookUrl: "https://www.facebook.com/roadlinkautomobiles",
  youtubeUrl: "https://www.youtube.com/@roadlinkautomobiles9168",
  displayTimezone: "Asia/Dhaka",
  displayLocale: "en-BD",
  defaultCurrency: "BDT",
  featuredVehiclesLimit: 6,
  showSoldVehicles: true,
  companyLogoUrl: "",
  faviconUrl: "",
  seoTitleSuffix: "Roadlink Automobiles",
  seoDefaultKeywords: "Japanese cars, reconditioned cars, Dhaka car importer, Toyota Axio, Honda Vezel, Nissan X-Trail, Roadlink Automobiles Bangladesh",
  seoDefaultDescription: "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock."
};

/**
 * Initializes and hydrates the Settings View fields from the backend API.
 */
export function initSettingsView(subtab = "company") {
  if (subtab) {
    switchSubtab(subtab);
  } else {
    switchSubtab(activeSubtab);
  }

  loadSettings();
  if (!settingsEventsBound) {
    bindSettingsEvents();
    settingsEventsBound = true;
  }
}

/**
 * Switches between sub-tabs: company, locations, carousel, testimonials
 */
export function switchSubtab(tabName) {
  activeSubtab = tabName;
  if (window.location.hash && window.location.hash.startsWith("#/settings")) {
    const targetHash = `#/settings?tab=${tabName}`;
    if (window.location.hash !== targetHash) {
      history.replaceState(null, "", targetHash);
    }
  }

  const companyBtn = $("tab-btn-company-profile");
  const locationsBtn = $("tab-btn-locations");
  const carouselBtn = $("tab-btn-carousel");
  const testimonialsBtn = $("tab-btn-testimonials");

  const companyContent = $("settings-company-tab-content");
  const locationsContent = $("settings-locations-tab-content");
  const carouselContent = $("settings-carousel-tab-content");
  const testimonialsContent = $("settings-testimonials-tab-content");

  const buttons = [companyBtn, locationsBtn, carouselBtn, testimonialsBtn];
  const contents = [companyContent, locationsContent, carouselContent, testimonialsContent];

  buttons.forEach(btn => {
    if (btn) {
      btn.classList.remove("active");
      btn.style.borderBottomColor = "transparent";
      btn.style.color = "var(--text-muted)";
    }
  });

  contents.forEach(cnt => {
    if (cnt) cnt.style.display = "none";
  });

  if (tabName === "locations") {
    if (locationsBtn) {
      locationsBtn.classList.add("active");
      locationsBtn.style.borderBottomColor = "var(--primary-blue)";
      locationsBtn.style.color = "var(--primary-blue)";
    }
    if (locationsContent) locationsContent.style.display = "block";
    initLocationsView();
  } else if (tabName === "carousel") {
    if (carouselBtn) {
      carouselBtn.classList.add("active");
      carouselBtn.style.borderBottomColor = "var(--primary-blue)";
      carouselBtn.style.color = "var(--primary-blue)";
    }
    if (carouselContent) carouselContent.style.display = "block";
    initCarouselView();
  } else if (tabName === "testimonials") {
    if (testimonialsBtn) {
      testimonialsBtn.classList.add("active");
      testimonialsBtn.style.borderBottomColor = "var(--primary-blue)";
      testimonialsBtn.style.color = "var(--primary-blue)";
    }
    if (testimonialsContent) testimonialsContent.style.display = "block";
    initTestimonialsView();
  } else {
    if (companyBtn) {
      companyBtn.classList.add("active");
      companyBtn.style.borderBottomColor = "var(--primary-blue)";
      companyBtn.style.color = "var(--primary-blue)";
    }
    if (companyContent) companyContent.style.display = "block";
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
      window.cachedAdminSettings = payload.data;
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

  // Featured & Branding
  const featuredLimitField = $("set-featured-vehicles-limit");
  const showSoldCheck = $("set-show-sold-vehicles");
  const logoUrlField = $("set-logo-url");
  const faviconUrlField = $("set-favicon-url");

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

  // Featured & Branding
  if (featuredLimitField) featuredLimitField.value = data.featuredVehiclesLimit ?? data.featured_vehicles_limit ?? 6;
  if (showSoldCheck) showSoldCheck.checked = (data.showSoldVehicles ?? data.show_sold_vehicles ?? 1) == 1;

  if (logoUrlField) {
    logoUrlField.value = data.companyLogoUrl || data.company_logo_url || "";
    updateBrandingPreview("logo", logoUrlField.value);
  }
  if (faviconUrlField) {
    faviconUrlField.value = data.faviconUrl || data.favicon_url || "";
    updateBrandingPreview("favicon", faviconUrlField.value);
  }
  const stockBannerUrlField = $("set-stock-banner-url");
  if (stockBannerUrlField) {
    stockBannerUrlField.value = data.stockBannerUrl || data.stock_banner_url || "";
    updateBrandingPreview("stock-banner", stockBannerUrlField.value);
  }

  if (displayTimezoneField) displayTimezoneField.value = data.displayTimezone || data.display_timezone || "Asia/Dhaka";
  if (displayLocaleField) displayLocaleField.value = data.displayLocale || data.display_locale || "en-BD";
  if (defaultCurrencyField) defaultCurrencyField.value = data.defaultCurrency || data.default_currency || "BDT";
}

function updateBrandingPreview(type, key) {
  let containerId = "logo-preview-container";
  let imgId = "logo-preview-img";
  if (type === "favicon") {
    containerId = "favicon-preview-container";
    imgId = "favicon-preview-img";
  } else if (type === "stock-banner") {
    containerId = "stock-banner-preview-container";
    imgId = "stock-banner-preview-img";
  }
  const container = $(containerId);
  const img = $(imgId);
  if (container && img) {
    if (key) {
      img.src = getPublicFileUrl(key);
      container.style.display = "block";
    } else {
      container.style.display = "none";
    }
  }
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

  const featuredVehiclesLimit = parseInt($("set-featured-vehicles-limit")?.value || "6", 10);
  const showSoldVehicles = $("set-show-sold-vehicles")?.checked ?? true;
  const companyLogoUrl = $("set-logo-url")?.value || "";
  const faviconUrl = $("set-favicon-url")?.value || "";
  const stockBannerUrl = $("set-stock-banner-url")?.value || "";

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
        seoTitleSuffix, seoDefaultKeywords, seoDefaultDescription,
        featuredVehiclesLimit, showSoldVehicles,
        companyLogoUrl, faviconUrl, stockBannerUrl
      })
    });

    const payload = await response.json();
    if (response.ok && payload.success) {
      if (payload.data) {
        window.cachedAdminSettings = payload.data;
      } else {
        window.cachedAdminSettings = {
          ...window.cachedAdminSettings,
          companyName,
          showroomAddress, showroomPhone, showShowroom,
          corporateAddress, corporatePhone, showCorporate,
          contactName, contactPhone, showPrimaryContact,
          whatsapp, showWhatsapp,
          email, showEmail,
          facebookUrl, youtubeUrl, displayTimezone, displayLocale,
          defaultCurrency,
          seoTitleSuffix, seoDefaultKeywords, seoDefaultDescription,
          featuredVehiclesLimit, showSoldVehicles,
          companyLogoUrl, faviconUrl
        };
      }
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

async function handleBrandingFileUpload(type, fileInput) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  if (type === "logo") {
    const ext = (file.name || "").split(".").pop().toLowerCase();
    if (ext !== "png" && file.type !== "image/png") {
      alert("Logo file must be in PNG format (.png) only.");
      fileInput.value = "";
      return;
    }
  }

  let btnId = "btn-upload-logo";
  let urlInputId = "set-logo-url";
  let uploadLabel = "Logo";
  if (type === "favicon") {
    btnId = "btn-upload-favicon";
    urlInputId = "set-favicon-url";
    uploadLabel = "Favicon";
  } else if (type === "stock-banner") {
    btnId = "btn-upload-stock-banner";
    urlInputId = "set-stock-banner-url";
    uploadLabel = "Stock Banner";
  }

  const btnUpload = $(btnId);
  if (btnUpload) {
    btnUpload.disabled = true;
    btnUpload.textContent = "Uploading...";
  }

  try {
    const uploaded = await uploadFileAsync(file, type === "logo" ? "logo" : "branding");
    const key = (typeof uploaded === "string") ? uploaded : (uploaded?.key || uploaded?.url || "");
    const urlInput = $(urlInputId);
    if (urlInput) {
      urlInput.value = key;
    }
    updateBrandingPreview(type, key);
  } catch (err) {
    alert(`Upload failed for ${uploadLabel}: ` + err.message);
  } finally {
    if (btnUpload) {
      btnUpload.disabled = false;
      btnUpload.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-upload"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg><span>Upload ${uploadLabel}</span>`;
    }
    fileInput.value = "";
  }
}

/**
 * Binds Settings panel interactive triggers and form submissions.
 */
function bindSettingsEvents() {
  const form = $("settings-form");
  const retryBtn = $("btn-retry-settings");
  const btnReset = $("btn-reset-settings");

  const companyTabBtn = $("tab-btn-company-profile");
  const locationsTabBtn = $("tab-btn-locations");
  const carouselTabBtn = $("tab-btn-carousel");
  const testimonialsTabBtn = $("tab-btn-testimonials");

  if (companyTabBtn) companyTabBtn.addEventListener("click", () => switchSubtab("company"));
  if (locationsTabBtn) locationsTabBtn.addEventListener("click", () => switchSubtab("locations"));
  if (carouselTabBtn) carouselTabBtn.addEventListener("click", () => switchSubtab("carousel"));
  if (testimonialsTabBtn) testimonialsTabBtn.addEventListener("click", () => switchSubtab("testimonials"));

  // Branding asset uploads
  const btnUploadLogo = $("btn-upload-logo");
  const logoFileInput = $("set-logo-file-input");
  if (btnUploadLogo && logoFileInput) {
    btnUploadLogo.onclick = () => logoFileInput.click();
    logoFileInput.onchange = () => handleBrandingFileUpload("logo", logoFileInput);
  }

  const btnUploadFavicon = $("btn-upload-favicon");
  const faviconFileInput = $("set-favicon-file-input");
  if (btnUploadFavicon && faviconFileInput) {
    btnUploadFavicon.onclick = () => faviconFileInput.click();
    faviconFileInput.onchange = () => handleBrandingFileUpload("favicon", faviconFileInput);
  }

  const btnUploadStockBanner = $("btn-upload-stock-banner");
  const stockBannerFileInput = $("set-stock-banner-file-input");
  if (btnUploadStockBanner && stockBannerFileInput) {
    btnUploadStockBanner.onclick = () => stockBannerFileInput.click();
    stockBannerFileInput.onchange = () => handleBrandingFileUpload("stock-banner", stockBannerFileInput);
  }

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

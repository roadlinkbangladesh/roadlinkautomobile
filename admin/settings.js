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
import { uploadFileAsync } from "./js/inventory.js";
import { getPublicFileUrl } from "./js/shared/api.js";
import { fetchPublicSettings } from "./js/settings-loader.js";

let settingsEventsBound = false;
let activeSubtab = "general";

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
  stockBannerUrl: "",
  seoTitleSuffix: "Roadlink Automobiles",
  seoDefaultKeywords: "Japanese cars, reconditioned cars, Dhaka car importer, Toyota Axio, Honda Vezel, Nissan X-Trail, Roadlink Automobiles Bangladesh",
  seoDefaultDescription: "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock.",
  websiteTitle: "Roadlink Automobiles",
  websiteDescription: "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock.",
  ogTitle: "Roadlink Automobiles | Premium Japanese Reconditioned Vehicles Importer",
  ogDescription: "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock.",
  ogImageUrl: "assets/logo.png",
  twitterTitle: "Roadlink Automobiles | Premium Japanese Reconditioned Vehicles Importer",
  twitterDescription: "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock.",
  twitterImageUrl: "assets/logo.png",
  publicWebsiteUrl: "../",
  whyChooseUs: [
    { title: "Genuine Japanese Imports", description: "Every vehicle in our stock is sourced directly from premier Japanese auction houses with authentic, un-doctored auction sheets." },
    { title: "Rigorous Quality Inspection", description: "All cars undergo a comprehensive multi-point mechanical, electrical, and structural diagnostics test in Japan and upon port arrival in Bangladesh." },
    { title: "Competitive Pricing", description: "We offer direct-to-buyer pricing with zero middleman markups. We assist with custom bank loan configurations and streamlined paperwork processing." },
    { title: "Trusted Importer", description: "Years of dedicated, transparent service has made us a landmark for quality reconditioned automobiles in the Fakirerpool and Dhaka circles." }
  ]
};

/**
 * Initializes and hydrates the Settings View fields from the backend API.
 */
export function initSettingsView(subtab = "general") {
  if (subtab === "company" || subtab === "profile") subtab = "general";
  if (subtab === "carousel") subtab = "homepage";

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
 * Switches between sub-tabs: general, branding, contact, locations, homepage, inventory, seo, testimonials
 */
export function switchSubtab(tabName) {
  // Map historical alias names
  if (tabName === "company" || tabName === "profile") tabName = "general";
  if (tabName === "carousel") tabName = "homepage";

  activeSubtab = tabName;
  if (window.location.hash && window.location.hash.startsWith("#/settings")) {
    const targetHash = `#/settings?tab=${tabName}`;
    if (window.location.hash !== targetHash) {
      history.replaceState(null, "", targetHash);
    }
  }

  const generalBtn = $("tab-btn-general");
  const brandingBtn = $("tab-btn-branding");
  const contactBtn = $("tab-btn-contact");
  const locationsBtn = $("tab-btn-locations");
  const homepageBtn = $("tab-btn-homepage");
  const inventoryBtn = $("tab-btn-inventory");
  const seoBtn = $("tab-btn-seo");
  const testimonialsBtn = $("tab-btn-testimonials");

  const generalContent = $("settings-general-tab-content");
  const brandingContent = $("settings-branding-tab-content");
  const contactContent = $("settings-contact-tab-content");
  const locationsContent = $("settings-locations-tab-content");
  const homepageFormContent = $("settings-homepage-form-content");
  const carouselContent = $("settings-carousel-tab-content");
  const inventoryContent = $("settings-inventory-tab-content");
  const seoContent = $("settings-seo-tab-content");
  const testimonialsContent = $("settings-testimonials-tab-content");
  const actionsRow = $("settings-form-actions-row");

  const buttons = [generalBtn, brandingBtn, contactBtn, locationsBtn, homepageBtn, inventoryBtn, seoBtn, testimonialsBtn];
  const contents = [generalContent, brandingContent, contactContent, locationsContent, homepageFormContent, carouselContent, inventoryContent, seoContent, testimonialsContent];

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

  const tabBtnMap = {
    general: generalBtn,
    branding: brandingBtn,
    contact: contactBtn,
    locations: locationsBtn,
    homepage: homepageBtn,
    inventory: inventoryBtn,
    seo: seoBtn,
    testimonials: testimonialsBtn
  };

  const activeBtn = tabBtnMap[tabName] || generalBtn;

  if (activeBtn) {
    activeBtn.classList.add("active");
    activeBtn.style.borderBottomColor = "var(--primary-blue)";
    activeBtn.style.color = "var(--primary-blue)";
  }

  // Show corresponding tab content
  if (tabName === "general" && generalContent) generalContent.style.display = "block";
  else if (tabName === "branding" && brandingContent) brandingContent.style.display = "block";
  else if (tabName === "contact" && contactContent) contactContent.style.display = "block";
  else if (tabName === "locations" && locationsContent) locationsContent.style.display = "block";
  else if (tabName === "homepage") {
    if (homepageFormContent) homepageFormContent.style.display = "block";
    if (carouselContent) carouselContent.style.display = "block";
  }
  else if (tabName === "inventory" && inventoryContent) inventoryContent.style.display = "block";
  else if (tabName === "seo" && seoContent) seoContent.style.display = "block";
  else if (tabName === "testimonials" && testimonialsContent) testimonialsContent.style.display = "block";

  // Show form submit footer row for form-based tabs
  const isFormTab = ["general", "branding", "contact", "homepage", "inventory", "seo"].includes(tabName);
  if (actionsRow) {
    actionsRow.style.display = isFormTab ? "flex" : "none";
  }

  if (tabName === "locations") {
    initLocationsView();
  } else if (tabName === "homepage") {
    initCarouselView();
  } else if (tabName === "testimonials") {
    initTestimonialsView();
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

  // Public Website URL
  const publicWebsiteUrlField = $("set-public-website-url");
  const targetPublicUrl = data.publicWebsiteUrl || data.public_website_url || "../";
  if (publicWebsiteUrlField) publicWebsiteUrlField.value = targetPublicUrl;
  const publicSiteLink = $("link-view-public-site");
  if (publicSiteLink) publicSiteLink.href = targetPublicUrl;

  // Website Metadata
  const websiteTitleField = $("set-website-title");
  const websiteDescField = $("set-website-description");
  const ogTitleField = $("set-og-title");
  const ogDescField = $("set-og-description");
  const ogImageUrlField = $("set-og-image-url");
  const twitterTitleField = $("set-twitter-title");
  const twitterDescField = $("set-twitter-description");
  const twitterUsernameField = $("set-twitter-username");
  const twitterImageUrlField = $("set-twitter-image-url");

  if (websiteTitleField) websiteTitleField.value = data.websiteTitle || data.website_title || "";
  if (websiteDescField) websiteDescField.value = data.websiteDescription || data.website_description || "";
  if (ogTitleField) ogTitleField.value = data.ogTitle || data.og_title || "";
  if (ogDescField) ogDescField.value = data.ogDescription || data.og_description || "";
  if (ogImageUrlField) {
    ogImageUrlField.value = data.ogImageUrl || data.og_image_url || "";
    updateBrandingPreview("og-image", ogImageUrlField.value);
  }
  if (twitterTitleField) twitterTitleField.value = data.twitterTitle || data.twitter_title || "";
  if (twitterDescField) twitterDescField.value = data.twitterDescription || data.twitter_description || "";
  if (twitterUsernameField) twitterUsernameField.value = data.twitterUsername || data.twitter_username || "";
  if (twitterImageUrlField) {
    twitterImageUrlField.value = data.twitterImageUrl || data.twitter_image_url || "";
    updateBrandingPreview("twitter-image", twitterImageUrlField.value);
  }

  // Why Choose Us Section Cards
  let whyCards = data.whyChooseUs || data.why_choose_us || SYSTEM_DEFAULTS.whyChooseUs;
  if (typeof whyCards === "string") {
    try { whyCards = JSON.parse(whyCards); } catch (e) { whyCards = SYSTEM_DEFAULTS.whyChooseUs; }
  }
  if (!Array.isArray(whyCards) || whyCards.length < 4) {
    whyCards = SYSTEM_DEFAULTS.whyChooseUs;
  }
  for (let i = 1; i <= 4; i++) {
    const card = whyCards[i - 1] || SYSTEM_DEFAULTS.whyChooseUs[i - 1];
    const tInput = $(`set-why-${i}-title`);
    const dInput = $(`set-why-${i}-desc`);
    if (tInput) tInput.value = card.title || "";
    if (dInput) dInput.value = card.description || "";
  }
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
  } else if (type === "og-image") {
    containerId = "og-image-preview-container";
    imgId = "og-image-preview-img";
  } else if (type === "twitter-image") {
    containerId = "twitter-image-preview-container";
    imgId = "twitter-image-preview-img";
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

  const publicWebsiteUrl = $("set-public-website-url")?.value || "../";
  const websiteTitle = $("set-website-title")?.value || "";
  const websiteDescription = $("set-website-description")?.value || "";
  const ogTitle = $("set-og-title")?.value || "";
  const ogDescription = $("set-og-description")?.value || "";
  const ogImageUrl = $("set-og-image-url")?.value || "";
  const twitterTitle = $("set-twitter-title")?.value || "";
  const twitterDescription = $("set-twitter-description")?.value || "";
  const twitterUsername = $("set-twitter-username")?.value || "";
  const twitterImageUrl = $("set-twitter-image-url")?.value || "";

  const whyChooseUs = [
    { title: $("set-why-1-title")?.value || "", description: $("set-why-1-desc")?.value || "" },
    { title: $("set-why-2-title")?.value || "", description: $("set-why-2-desc")?.value || "" },
    { title: $("set-why-3-title")?.value || "", description: $("set-why-3-desc")?.value || "" },
    { title: $("set-why-4-title")?.value || "", description: $("set-why-4-desc")?.value || "" }
  ];

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
        companyLogoUrl, faviconUrl, stockBannerUrl,
        publicWebsiteUrl, websiteTitle, websiteDescription,
        ogTitle, ogDescription, ogImageUrl,
        twitterTitle, twitterDescription, twitterUsername, twitterImageUrl,
        whyChooseUs
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
          companyLogoUrl, faviconUrl, stockBannerUrl,
          publicWebsiteUrl, websiteTitle, websiteDescription,
          ogTitle, ogDescription, ogImageUrl,
          twitterTitle, twitterDescription, twitterImageUrl,
          whyChooseUs
        };
      }

      const publicSiteLink = $("link-view-public-site");
      if (publicSiteLink && publicWebsiteUrl) {
        publicSiteLink.href = publicWebsiteUrl;
      }

      // Re-hydrate page branding and favicon
      fetchPublicSettings().catch(err => console.error("Failed to re-hydrate public settings:", err));

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

  if (file.size > 5 * 1024 * 1024) {
    alert("Image file size must not exceed 5MB.");
    fileInput.value = "";
    return;
  }

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
  } else if (type === "og-image") {
    btnId = "btn-upload-og-image";
    urlInputId = "set-og-image-url";
    uploadLabel = "OG Image";
  } else if (type === "twitter-image") {
    btnId = "btn-upload-twitter-image";
    urlInputId = "set-twitter-image-url";
    uploadLabel = "Twitter Image";
  }

  const btnUpload = $(btnId);
  if (btnUpload) {
    btnUpload.disabled = true;
    btnUpload.textContent = "Uploading...";
  }

  try {
    const uploaded = await uploadFileAsync(file, (type === "logo") ? "logo" : "branding");
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

  const generalTabBtn = $("tab-btn-general");
  const brandingTabBtn = $("tab-btn-branding");
  const contactTabBtn = $("tab-btn-contact");
  const locationsTabBtn = $("tab-btn-locations");
  const homepageTabBtn = $("tab-btn-homepage");
  const inventoryTabBtn = $("tab-btn-inventory");
  const seoTabBtn = $("tab-btn-seo");
  const testimonialsTabBtn = $("tab-btn-testimonials");

  if (generalTabBtn) generalTabBtn.addEventListener("click", () => switchSubtab("general"));
  if (brandingTabBtn) brandingTabBtn.addEventListener("click", () => switchSubtab("branding"));
  if (contactTabBtn) contactTabBtn.addEventListener("click", () => switchSubtab("contact"));
  if (locationsTabBtn) locationsTabBtn.addEventListener("click", () => switchSubtab("locations"));
  if (homepageTabBtn) homepageTabBtn.addEventListener("click", () => switchSubtab("homepage"));
  if (inventoryTabBtn) inventoryTabBtn.addEventListener("click", () => switchSubtab("inventory"));
  if (seoTabBtn) seoTabBtn.addEventListener("click", () => switchSubtab("seo"));
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

  const btnUploadOgImage = $("btn-upload-og-image");
  const ogImageFileInput = $("set-og-image-file-input");
  if (btnUploadOgImage && ogImageFileInput) {
    btnUploadOgImage.onclick = () => ogImageFileInput.click();
    ogImageFileInput.onchange = () => handleBrandingFileUpload("og-image", ogImageFileInput);
  }

  const btnUploadTwitterImage = $("btn-upload-twitter-image");
  const twitterImageFileInput = $("set-twitter-image-file-input");
  if (btnUploadTwitterImage && twitterImageFileInput) {
    btnUploadTwitterImage.onclick = () => twitterImageFileInput.click();
    twitterImageFileInput.onchange = () => handleBrandingFileUpload("twitter-image", twitterImageFileInput);
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

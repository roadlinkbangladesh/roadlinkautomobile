/**
 * Roadlink Automobiles - Global Settings & Locations Management
 * Single source of truth for public website settings and business location rendering.
 */

import { apiRequest, getPublicFileUrl, sanitizePhoneNumber, formatPhoneNumber } from "./shared/api.js";

export const DEFAULT_SETTINGS = {
  companyName: "",
  address: "",
  phone: "",
  contactName: "",
  contactPhone: "",
  showPrimaryContact: false,
  whatsapp: "",
  showWhatsapp: true,
  email: "",
  showEmail: true,
  facebookUrl: "",
  youtubeUrl: "",
  seoTitleSuffix: "",
  seoDefaultKeywords: "",
  seoDefaultDescription: "",
  showSoldVehicles: true
};

let cachedSettings = { ...DEFAULT_SETTINGS };
let cachedLocations = [];

export function getPublicSettings() {
  return cachedSettings;
}

/**
 * Fetches settings from backend public API.
 */
export async function fetchPublicSettings() {
  try {
    const res = await apiRequest("/api/v1/public/settings");
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const payload = await res.json();
      if (payload && payload.success && payload.data) {
        const data = payload.data;
        cachedSettings = {
          companyName: data.company_name || data.companyName || DEFAULT_SETTINGS.companyName,
          address: data.address || DEFAULT_SETTINGS.address,
          phone: data.phone || DEFAULT_SETTINGS.phone,
          contactName: data.contact_name || data.contactName || DEFAULT_SETTINGS.contactName,
          contactPhone: data.contact_phone || data.contactPhone || DEFAULT_SETTINGS.contactPhone,
          showPrimaryContact: (data.show_primary_contact ?? data.showPrimaryContact ?? 0) == 1,
          whatsapp: data.whatsapp || DEFAULT_SETTINGS.whatsapp,
          showWhatsapp: (data.show_whatsapp ?? data.showWhatsapp ?? 1) == 1,
          email: data.email || DEFAULT_SETTINGS.email,
          showEmail: (data.show_email ?? data.showEmail ?? 1) == 1,
          facebookUrl: data.facebook || data.facebookUrl || DEFAULT_SETTINGS.facebookUrl,
          youtubeUrl: data.youtube || data.youtubeUrl || DEFAULT_SETTINGS.youtubeUrl,
          seoTitleSuffix: data.seo_title_suffix || data.seoTitleSuffix || DEFAULT_SETTINGS.seoTitleSuffix,
          seoDefaultKeywords: data.seo_default_keywords || data.seoDefaultKeywords || DEFAULT_SETTINGS.seoDefaultKeywords,
          seoDefaultDescription: data.seo_default_description || data.seoDefaultDescription || DEFAULT_SETTINGS.seoDefaultDescription,
          stockBannerUrl: data.stock_banner_url || data.stockBannerUrl || null,
          companyLogoUrl: data.company_logo_url || data.companyLogoUrl || null,
          faviconUrl: data.favicon_url || data.faviconUrl || null,
          showSoldVehicles: (data.show_sold_vehicles ?? data.showSoldVehicles ?? 1) == 1,
          show_sold_vehicles: (data.show_sold_vehicles ?? data.showSoldVehicles ?? 1) == 1,
          publicWebsiteUrl: data.public_website_url || data.publicWebsiteUrl || "../",
          websiteTitle: data.website_title || data.websiteTitle || null,
          websiteDescription: data.website_description || data.websiteDescription || null,
          ogTitle: data.og_title || data.ogTitle || null,
          ogDescription: data.og_description || data.ogDescription || null,
          ogImageUrl: data.og_image_url || data.ogImageUrl || null,
          twitterTitle: data.twitter_title || data.twitterTitle || null,
          twitterDescription: data.twitter_description || data.twitterDescription || null,
          twitterImageUrl: data.twitter_image_url || data.twitterImageUrl || null,
          whyChooseUs: data.why_choose_us || data.whyChooseUs || null
        };
        hydratePageContacts();
        await fetchPublicLocations();
      }
    }
  } catch (err) {
    console.error("Failed to fetch public settings:", err);
    await fetchPublicLocations();
  }
  return cachedSettings;
}

/**
 * Fetches public business locations from backend API and hydrates location sections & footers
 */
export async function fetchPublicLocations() {
  try {
    const res = await apiRequest("/api/v1/public/locations");
    if (!res.ok) return;

    const payload = await res.json();
    if (!payload || !payload.success || !Array.isArray(payload.data)) return;

    cachedLocations = payload.data;
    if (cachedLocations.length === 0) return;

    hydrateLocationsUI(cachedLocations);
  } catch (err) {
    console.error("Failed to fetch public locations:", err);
  }
}

// Helper to format WhatsApp number for visual display
function formatWaDisplay(raw) {
  if (!raw) return '';
  return formatPhoneNumber(raw);
}

/**
 * Hydrates homepage location section and footer contact list from database locations
 */
function resolveNavigationUrl(mapUrl, embedUrl, title = '', address = '') {
  if (mapUrl && typeof mapUrl === 'string') {
    const trimmed = mapUrl.trim();
    if (trimmed && !trimmed.toLowerCase().includes('/embed') && !trimmed.toLowerCase().includes('output=embed')) {
      return trimmed;
    }
  }

  const source = (embedUrl || mapUrl || '').trim();
  if (source) {
    const latMatch = source.match(/!3d([-+]?\d+(?:\.\d+)?)/i);
    const lngMatch = source.match(/!2d([-+]?\d+(?:\.\d+)?)/i);
    if (latMatch && lngMatch) {
      return `https://www.google.com/maps/dir/?api=1&destination=${latMatch[1]},${lngMatch[1]}`;
    }
    const placeMatch = source.match(/!2s([^!&#]+)/i);
    if (placeMatch && placeMatch[1]) {
      try {
        const decoded = decodeURIComponent(placeMatch[1]);
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(decoded)}`;
      } catch (e) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(placeMatch[1])}`;
      }
    }
    const coordMatch = source.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/i) || source.match(/[?&]q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/i);
    if (coordMatch) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coordMatch[1]},${coordMatch[2]}`;
    }
  }

  const query = [title, address].map(s => (s || '').trim()).filter(Boolean).join(' ');
  if (query) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }

  return '#';
}

function hydrateLocationsUI(locations) {
  const settings = getSettings();
  const defaultLoc = locations.find(l => l.isDefault) || locations[0];
  const mapIframe = document.getElementById("contact-map-iframe") || document.querySelector(".map-container iframe");
  const contactList = document.getElementById("dyn-contact-list");
  const actionsBar = document.getElementById("contact-actions-bar");

  // 1. Homepage Location Cards (#dyn-contact-list)
  if (contactList && locations.length > 0) {
    contactList.innerHTML = locations.map((loc) => {
      const isDefault = loc.isDefault;
      const phonesHtml = (loc.phones || []).map(p => `
        <a href="tel:${sanitizePhoneNumber(p)}" onclick="event.stopPropagation();" class="loc-phone-link">${p}</a>
      `).join(' &bull; ') || 'Contact sales team';

      const navUrl = resolveNavigationUrl(loc.mapUrl, loc.mapEmbedUrl, loc.title, loc.address);

      return `
        <li class="location-card-item ${isDefault ? 'active-location' : ''}" 
            data-loc-id="${loc.id}" 
            data-map-embed="${loc.mapEmbedUrl || ''}" 
            data-nav-url="${navUrl}"
            data-loc-title="${loc.title}">
          <div class="loc-card-header">
            <div class="loc-title-group">
              <span class="loc-card-title-text">${loc.title}</span>
            </div>
            ${isDefault ? `<span class="branch-badge main-badge">Primary</span>` : (loc.branchType ? `<span class="branch-badge">${loc.branchType}</span>` : '')}
          </div>

          <div class="loc-card-details">
            <div class="loc-detail-row">
              <div class="loc-detail-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div class="loc-detail-text">
                <span class="loc-detail-label">Address</span>
                <span class="loc-detail-value">${loc.address}</span>
              </div>
            </div>

            <div class="loc-detail-row">
              <div class="loc-detail-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div class="loc-detail-text">
                <span class="loc-detail-label">Phone</span>
                <span class="loc-detail-value">${phonesHtml}</span>
              </div>
            </div>

            ${(loc.businessHours || loc.openingHours) ? `
              <div class="loc-detail-row">
                <div class="loc-detail-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div class="loc-detail-text">
                  <span class="loc-detail-label">Hours</span>
                  <span class="loc-detail-value">${loc.businessHours || loc.openingHours}</span>
                </div>
              </div>
            ` : ''}

            ${loc.services ? `
              <div class="loc-detail-row">
                <div class="loc-detail-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                </div>
                <div class="loc-detail-text">
                  <span class="loc-detail-label">Services</span>
                  <span class="loc-detail-value">${loc.services}</span>
                </div>
              </div>
            ` : ''}
          </div>
        </li>
      `;
    }).join('');
  }

  // Helper to select a location card
  const selectLocationCard = (cardEl, loc) => {
    if (!cardEl) return;
    const embedUrl = cardEl.dataset.mapEmbed || loc?.mapEmbedUrl || '';
    const rawNavUrl = cardEl.dataset.navUrl || loc?.mapUrl || '';
    const title = cardEl.dataset.locTitle || loc?.title || 'Location';
    const navUrl = resolveNavigationUrl(rawNavUrl, embedUrl, title, loc?.address);

    // Highlight selected card
    if (contactList) {
      contactList.querySelectorAll(".location-card-item").forEach(card => {
        card.classList.remove("active-location");
      });
      cardEl.classList.add("active-location");
    }

    // Update Map Iframe
    if (mapIframe && embedUrl) {
      mapIframe.src = embedUrl;
    }

    // Dynamic WhatsApp update if location has specific WhatsApp
    const waLink = document.getElementById("contact-action-wa");
    const locWa = loc?.whatsapp || settings.whatsapp;
    if (waLink && locWa) {
      const waSanitized = sanitizePhoneNumber(locWa);
      const waDisp = formatWaDisplay(locWa);
      waLink.href = `https://wa.me/${waSanitized}`;
      waLink.title = `Chat on WhatsApp (${waDisp})`;
      const waValEl = document.getElementById("wa-display-val");
      if (waValEl) waValEl.textContent = waDisp;
    }

    // Dynamic Email update if location has specific Email
    const emailLink = document.getElementById("contact-action-email");
    const locEmail = loc?.email || settings.email;
    if (emailLink && locEmail) {
      emailLink.href = `mailto:${locEmail}`;
      emailLink.title = `Send email inquiry to ${locEmail}`;
      const emailValEl = document.getElementById("email-display-val");
      if (emailValEl) emailValEl.textContent = locEmail;
    }
  };

  // Bind click handlers to location cards
  if (contactList) {
    contactList.querySelectorAll(".location-card-item").forEach(card => {
      card.addEventListener("click", () => {
        const locId = card.dataset.locId;
        const locObj = locations.find(l => String(l.id) === String(locId));
        selectLocationCard(card, locObj);
      });
    });
  }

  // 2. Render Contact Actions Bar (#contact-actions-bar)
  if (actionsBar) {
    const rawWa = settings.whatsapp || '';
    const waSanitized = rawWa ? sanitizePhoneNumber(rawWa) : '';
    const waDisplay = rawWa ? formatWaDisplay(rawWa) : '';
    const email = settings.email || '';

    actionsBar.innerHTML = `
      ${settings.showWhatsapp && waSanitized ? `
        <a href="https://wa.me/${waSanitized}" target="_blank" id="contact-action-wa" class="contact-info-card wa-info-card" title="Chat on WhatsApp (${waDisplay})">
          <div class="contact-info-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="contact-info-text">
            <span class="contact-item-label">WhatsApp</span>
            <span class="contact-item-value" id="wa-display-val">${waDisplay}</span>
          </div>
        </a>
      ` : ''}

      ${settings.showEmail && email ? `
        <a href="mailto:${email}" id="contact-action-email" class="contact-info-card email-info-card" title="Send email inquiry to ${email}">
          <div class="contact-info-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <div class="contact-info-text">
            <span class="contact-item-label">Email</span>
            <span class="contact-item-value" id="email-display-val">${email}</span>
          </div>
        </a>
      ` : ''}
    `;
  }

  // Set initial default map and directions state
  if (defaultLoc) {
    const defaultCard = contactList?.querySelector(`[data-loc-id="${defaultLoc.id}"]`) || contactList?.firstElementChild;
    if (defaultCard) {
      selectLocationCard(defaultCard, defaultLoc);
    }
  }

  // 3. Footer Contact List (.footer-contact-list) - Display ONLY Default Location
  if (defaultLoc) {
    document.querySelectorAll(".footer-contact-list").forEach(list => {
      const footerItems = [];

      // Address
      if (defaultLoc.address) {
        footerItems.push(`
          <li class="footer-contact-item">
            <div class="footer-contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="footer-contact-text">
              <span class="footer-contact-label">${defaultLoc.title || 'Corporate Office'}</span>
              <span class="footer-contact-value">${defaultLoc.address}</span>
            </div>
          </li>
        `);
      }

      // Phone numbers
      if (Array.isArray(defaultLoc.phones) && defaultLoc.phones.length > 0) {
        const phoneLinks = defaultLoc.phones.map(p => `
          <a href="tel:${sanitizePhoneNumber(p)}" style="color: inherit; text-decoration: none;">${p}</a>
        `).join(' &bull; ');

        footerItems.push(`
          <li class="footer-contact-item">
            <div class="footer-contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <div class="footer-contact-text">
              <span class="footer-contact-label">Phone</span>
              <span class="footer-contact-value">${phoneLinks}</span>
            </div>
          </li>
        `);
      }

      // WhatsApp
      if (settings.showWhatsapp && settings.whatsapp) {
        const waNumber = sanitizePhoneNumber(settings.whatsapp);
        const waDisp = formatWaDisplay(settings.whatsapp);
        footerItems.push(`
          <li class="footer-contact-item">
            <div class="footer-contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="footer-contact-text">
              <span class="footer-contact-label">WhatsApp</span>
              <span class="footer-contact-value"><a href="https://wa.me/${waNumber}" target="_blank" style="color: inherit; text-decoration: none;">${waDisp}</a></span>
            </div>
          </li>
        `);
      }

      // Email
      if (settings.showEmail && settings.email) {
        footerItems.push(`
          <li class="footer-contact-item">
            <div class="footer-contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            <div class="footer-contact-text">
              <span class="footer-contact-label">Email</span>
              <span class="footer-contact-value"><a href="mailto:${settings.email}" style="color: inherit; text-decoration: none;">${settings.email}</a></span>
            </div>
          </li>
        `);
      }

      if (footerItems.length > 0) {
        list.innerHTML = footerItems.join('');
      }
    });
  }
}

/**
 * Synchronous getter returning current cached settings.
 */
export function getSettings() {
  return cachedSettings;
}

/**
 * Synchronous getter returning current cached business locations.
 */
export function getLocations() {
  return cachedLocations;
}

/**
 * Dynamically updates contact details, company brand names, titles, and meta tags on the current HTML page based on stored settings.
 */
export function hydratePageContacts() {
  const settings = getSettings();
  
  // 1. Web Title Hydration
  if (document.getElementById("admin-app") || window.location.pathname.includes("/admin")) {
    document.title = `Admin Portal - ${settings.companyName || "Roadlink Automobiles"}`;
  } else if (settings.websiteTitle) {
    const brandSuffix = settings.seoTitleSuffix || settings.companyName || "Roadlink Automobiles";
    document.title = `${settings.websiteTitle} | ${brandSuffix}`;
  } else if (document.title && settings.companyName && settings.companyName !== DEFAULT_SETTINGS.companyName) {
    document.title = document.title.replace(/Roadlink Automobiles/g, settings.companyName);
  }

  // 2. Author & Site Name
  document.querySelectorAll("meta[name='author'], meta[property='og:site_name']").forEach(meta => {
    meta.setAttribute("content", settings.companyName);
  });
  
  // Meta Description
  const mainDesc = settings.websiteDescription || settings.seoDefaultDescription;
  if (mainDesc) {
    document.querySelectorAll("meta[name='description']").forEach(meta => {
      meta.setAttribute("content", mainDesc);
    });
  }

  // Meta Keywords
  if (settings.seoDefaultKeywords) {
    document.querySelectorAll("meta[name='keywords']").forEach(meta => {
      meta.setAttribute("content", settings.seoDefaultKeywords);
    });
  }

  // Open Graph Social Tags
  const ogTitle = settings.ogTitle || settings.websiteTitle || settings.companyName;
  if (ogTitle) {
    document.querySelectorAll("meta[property='og:title']").forEach(meta => {
      meta.setAttribute("content", ogTitle);
    });
  }

  const ogDesc = settings.ogDescription || mainDesc;
  if (ogDesc) {
    document.querySelectorAll("meta[property='og:description']").forEach(meta => {
      meta.setAttribute("content", ogDesc);
    });
  }

  if (settings.ogImageUrl) {
    const ogImgUrl = settings.ogImageUrl.startsWith("http") ? settings.ogImageUrl : getPublicFileUrl(settings.ogImageUrl);
    document.querySelectorAll("meta[property='og:image']").forEach(meta => {
      meta.setAttribute("content", ogImgUrl);
    });
  }

  // Twitter Social Tags
  const twTitle = settings.twitterTitle || ogTitle;
  if (twTitle) {
    document.querySelectorAll("meta[name='twitter:title']").forEach(meta => {
      meta.setAttribute("content", twTitle);
    });
  }

  const twDesc = settings.twitterDescription || ogDesc;
  if (twDesc) {
    document.querySelectorAll("meta[name='twitter:description']").forEach(meta => {
      meta.setAttribute("content", twDesc);
    });
  }

  const twImg = settings.twitterImageUrl || settings.ogImageUrl;
  if (twImg) {
    const twImgUrl = twImg.startsWith("http") ? twImg : getPublicFileUrl(twImg);
    document.querySelectorAll("meta[name='twitter:image']").forEach(meta => {
      meta.setAttribute("content", twImgUrl);
    });
  }

  // Favicon Hydration
  const favKey = settings.faviconUrl || settings.companyLogoUrl;
  if (favKey) {
    const resolvedFavUrl = getPublicFileUrl(favKey);
    let faviconLink = document.querySelector("link[rel*='icon']");
    if (!faviconLink) {
      faviconLink = document.createElement("link");
      faviconLink.rel = "shortcut icon";
      document.head.appendChild(faviconLink);
    }
    faviconLink.href = resolvedFavUrl;

    let appleIconLink = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleIconLink) {
      appleIconLink = document.createElement("link");
      appleIconLink.rel = "apple-touch-icon";
      appleIconLink.setAttribute("sizes", "180x180");
      document.head.appendChild(appleIconLink);
    }
    appleIconLink.href = resolvedFavUrl;
  }

  // Logo Hydration
  if (settings.companyLogoUrl) {
    const logoUrl = getPublicFileUrl(settings.companyLogoUrl);
    document.querySelectorAll(".brand-logo-img, .logo img, #header-logo-img, .logo-img, .logo-wrapper img, .admin-login-logo img, .admin-sidebar-logo img").forEach(img => {
      img.src = logoUrl;
      if (settings.companyName) {
        img.alt = `${settings.companyName} Logo`;
      }
    });
  }

  // Why Choose Us Cards Hydration
  const whyGrid = document.querySelector("#why-choose-us-section .why-grid");
  if (whyGrid && settings.whyChooseUs) {
    let cards = settings.whyChooseUs;
    if (typeof cards === "string") {
      try { cards = JSON.parse(cards); } catch (e) { cards = null; }
    }
    if (Array.isArray(cards) && cards.length >= 4) {
      const cardEls = whyGrid.querySelectorAll(".why-card");
      cardEls.forEach((cardEl, idx) => {
        if (cards[idx]) {
          const titleEl = cardEl.querySelector(".why-title");
          const descEl = cardEl.querySelector(".why-desc");
          if (titleEl && cards[idx].title) titleEl.textContent = cards[idx].title;
          if (descEl && cards[idx].description) descEl.textContent = cards[idx].description;
        }
      });
    }
  }

  // 3. Update Copyright Notices
  document.querySelectorAll(".copyright-text").forEach(el => {
    const year = new Date().getFullYear();
    el.innerHTML = `&copy; ${year} ${settings.companyName}. All Rights Reserved.`;
  });

  // 4. Hydrate Stock Page Hero Banner Image if configured
  const stockBannerImg = document.getElementById("stock-banner-img");
  if (stockBannerImg && settings.stockBannerUrl) {
    stockBannerImg.src = getPublicFileUrl(settings.stockBannerUrl);
  }

  // 5. Hydrate Anchor Tags (tel, mailto, wa.me, facebook, youtube)
  document.querySelectorAll("a").forEach(link => {
    const href = link.getAttribute("href") || "";
    
    if (href.startsWith("tel:") || link.classList.contains("btn-call-action")) {
      const targetPhone = settings.phone;
      if (targetPhone) {
        const cleanPhone = sanitizePhoneNumber(targetPhone);
        link.href = `tel:${cleanPhone}`;
        if (link.classList.contains("btn-call-action")) {
          const svg = link.querySelector("svg");
          if (svg) {
            link.innerHTML = svg.outerHTML + ` Call ${targetPhone}`;
          } else {
            link.textContent = `Call ${targetPhone}`;
          }
        } else if (link.hasAttribute("data-setting") || link.classList.contains("tel-link") || link.textContent.trim().startsWith("+") || link.textContent.trim().startsWith("Call")) {
          link.textContent = targetPhone;
        }
      }
    } else if (href.includes("mailto:")) {
      if (settings.email) {
        link.href = `mailto:${settings.email}`;
        if (link.hasAttribute("data-setting") || link.classList.contains("email-link") || link.textContent.trim().includes("@")) {
          link.textContent = settings.email;
        }
      }
    } else if (href.includes("wa.me/") || link.classList.contains("nav-cta") || link.classList.contains("btn-whatsapp")) {
      if (settings.whatsapp) {
        const waNumber = sanitizePhoneNumber(settings.whatsapp);
        const waMatch = href.match(/wa\.me\/([0-9]+)/);
        if (waMatch) {
          link.href = href.replace(waMatch[1], waNumber);
        } else {
          link.href = `https://wa.me/${waNumber}`;
        }
      }
    } else if (href.includes("facebook.com/") || link.classList.contains("facebook-link")) {
      if (settings.facebookUrl) link.href = settings.facebookUrl;
    } else if (href.includes("youtube.com/") || link.classList.contains("youtube-link")) {
      if (settings.youtubeUrl) link.href = settings.youtubeUrl;
    }
  });

  // 6. Hydrate JSON-LD Structured Data
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const json = JSON.parse(script.textContent);
      if (json['@type'] === 'AutoDealer' || json['@type'] === 'Organization') {
        if (settings.companyName) json.name = settings.companyName;
        if (settings.phone) json.telephone = settings.phone;
        if (settings.email) json.email = settings.email;
        if (json.address && settings.address) {
          json.address.streetAddress = settings.address;
        }
        script.textContent = JSON.stringify(json, null, 2);
      }
    } catch (e) {
      // Ignore JSON parse errors for non-matching scripts
    }
  });
}

// Automatically run on page load
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      fetchPublicSettings();
    });
  } else {
    fetchPublicSettings();
  }
}

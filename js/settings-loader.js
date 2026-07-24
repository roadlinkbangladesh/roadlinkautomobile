/**
 * Roadlink Automobiles - Global Settings & Locations Management
 * Single source of truth for public website settings and business location rendering.
 */

import { apiRequest, getPublicFileUrl, sanitizePhoneNumber } from "./shared/api.js";

export const DEFAULT_SETTINGS = {
  companyName: "Roadlink Automobiles",
  address: "169 (Level 2), Fakirerpool, Dhaka 1000",
  phone: "+880 1311-503840",
  contactName: "Sales Helpline / Managing Officer",
  contactPhone: "+880 1311-503840",
  showPrimaryContact: false,
  whatsapp: "8801311503840",
  showWhatsapp: true,
  email: "roadlinkbangladesh@gmail.com",
  showEmail: true,
  facebookUrl: "https://www.facebook.com/roadlinkautomobiles",
  youtubeUrl: "https://www.youtube.com/@roadlinkautomobiles9168",
  seoTitleSuffix: "Roadlink Automobiles",
  seoDefaultKeywords: "Japanese cars, reconditioned cars, Dhaka car importer, Toyota Axio, Honda Vezel, Nissan X-Trail, Roadlink Automobiles Bangladesh",
  seoDefaultDescription: "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock."
};

let cachedSettings = { ...DEFAULT_SETTINGS };
let cachedLocations = [];

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
          faviconUrl: data.favicon_url || data.faviconUrl || null
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

/**
 * Hydrates homepage location section and footer contact list from database locations
 */
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
        <a href="tel:${sanitizePhoneNumber(p)}" onclick="event.stopPropagation();" style="color: inherit; text-decoration: none; font-weight: 600;">${p}</a>
      `).join(' &bull; ') || 'Contact sales team';

      const hoursHtml = (loc.businessHours || loc.openingHours) ? `<p class="loc-extra-info"><strong>Hours:</strong> ${loc.businessHours || loc.openingHours}</p>` : '';
      const servicesHtml = loc.services ? `<p class="loc-extra-info"><strong>Services:</strong> ${loc.services}</p>` : '';

      const navUrl = loc.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.title + ' ' + loc.address)}`;

      return `
        <li class="location-card-item ${isDefault ? 'active-location' : ''}" 
            data-loc-id="${loc.id}" 
            data-map-embed="${loc.mapEmbedUrl || ''}" 
            data-nav-url="${navUrl}"
            data-loc-title="${loc.title}">
          <div class="loc-card-header">
            <div class="loc-title-group">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin loc-pin-icon"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${loc.title}</span>
            </div>
            ${isDefault ? `<span class="branch-badge main-badge">Main Branch</span>` : (loc.branchType ? `<span class="branch-badge">${loc.branchType}</span>` : '')}
          </div>

          <p class="loc-card-address">${loc.address}</p>
          <p class="loc-card-phone"><strong>Phone:</strong> ${phonesHtml}</p>
          ${hoursHtml}
          ${servicesHtml}
        </li>
      `;
    }).join('');
  }

  // Helper to select a location card
  const selectLocationCard = (cardEl, loc) => {
    if (!cardEl) return;
    const embedUrl = cardEl.dataset.mapEmbed || loc?.mapEmbedUrl || '';
    const navUrl = cardEl.dataset.navUrl || loc?.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((loc?.title || '') + ' ' + (loc?.address || ''))}`;
    const title = cardEl.dataset.locTitle || loc?.title || 'Location';

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

    // Update Get Directions button
    const directionsBtn = document.getElementById("btn-get-directions");
    if (directionsBtn) {
      directionsBtn.href = navUrl;
      directionsBtn.title = `Get directions to ${title}`;
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
    const waNumber = settings.whatsapp ? sanitizePhoneNumber(settings.whatsapp) : '';
    const email = settings.email || '';
    const initialNavUrl = defaultLoc ? (defaultLoc.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(defaultLoc.title + ' ' + defaultLoc.address)}`) : '#';

    actionsBar.innerHTML = `
      ${settings.showWhatsapp && waNumber ? `
        <a href="https://wa.me/${waNumber}" target="_blank" class="contact-action-btn wa-action-btn" title="Chat with us on WhatsApp">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>WhatsApp Support</span>
        </a>
      ` : ''}

      ${settings.showEmail && email ? `
        <a href="mailto:${email}" class="contact-action-btn email-action-btn" title="Send us an email inquiry">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          <span>Email Inquiry</span>
        </a>
      ` : ''}

      <a href="${initialNavUrl}" target="_blank" id="btn-get-directions" class="contact-action-btn directions-action-btn" title="Get Google Maps navigation directions">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-navigation"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        <span class="btn-text">Get Directions</span>
      </a>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span><strong>${defaultLoc.title}:</strong> ${defaultLoc.address}</span>
          </li>
        `);
      }

      // Phone numbers
      if (Array.isArray(defaultLoc.phones) && defaultLoc.phones.length > 0) {
        const phoneLinks = defaultLoc.phones.map(p => `
          <a href="tel:${sanitizePhoneNumber(p)}" style="color: inherit; text-decoration: none;">${p}</a>
        `).join(', ');

        footerItems.push(`
          <li class="footer-contact-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>${phoneLinks}</span>
          </li>
        `);
      }

      // WhatsApp
      if (settings.showWhatsapp && settings.whatsapp) {
        const waNumber = sanitizePhoneNumber(settings.whatsapp);
        footerItems.push(`
          <li class="footer-contact-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span><strong>WhatsApp:</strong> <a href="https://wa.me/${waNumber}" target="_blank" style="color: inherit; text-decoration: none;">+${waNumber}</a></span>
          </li>
        `);
      }

      // Email
      if (settings.showEmail && settings.email) {
        footerItems.push(`
          <li class="footer-contact-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <span><a href="mailto:${settings.email}" style="color: inherit; text-decoration: none;">${settings.email}</a></span>
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
  
  // 1. Update Document Title
  if (document.title && settings.companyName && settings.companyName !== DEFAULT_SETTINGS.companyName) {
    document.title = document.title.replace(/Roadlink Automobiles/g, settings.companyName);
  }

  // 2. Update Meta Tags
  document.querySelectorAll("meta[name='author'], meta[property='og:site_name']").forEach(meta => {
    meta.setAttribute("content", settings.companyName);
  });
  
  document.querySelectorAll("meta[name='description'], meta[property='og:description'], meta[name='twitter:description']").forEach(meta => {
    let content = meta.getAttribute("content") || "";
    if (content.includes("Roadlink Automobiles")) {
      meta.setAttribute("content", content.replace(/Roadlink Automobiles/g, settings.companyName));
    }
  });

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
        } else if (link.textContent.trim().includes("+880") || link.textContent.trim().includes("1311")) {
          link.textContent = targetPhone;
        }
      }
    } else if (href.includes("mailto:")) {
      if (settings.email) {
        link.href = `mailto:${settings.email}`;
        if (link.textContent.trim().includes("roadlink") || link.textContent.trim().includes("@")) {
          link.textContent = settings.email;
        }
      }
    } else if (href.includes("wa.me/")) {
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

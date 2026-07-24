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

  // 1. Initial Map Iframe setup directly using canonical mapEmbedUrl
  if (mapIframe && defaultLoc && defaultLoc.mapEmbedUrl) {
    mapIframe.src = defaultLoc.mapEmbedUrl;
  }

  // 2. Homepage Location Cards & Contact Items (#dyn-contact-list)
  const contactList = document.getElementById("dyn-contact-list");
  if (contactList) {
    const items = [];

    // Render Location Cards from Business Locations
    locations.forEach((loc) => {
      const isDefault = loc.isDefault;
      const phonesHtml = (loc.phones || []).map(p => `
        <a href="tel:${sanitizePhoneNumber(p)}" style="color: inherit; text-decoration: none; font-weight: 600;">${p}</a>
      `).join(' &bull; ') || 'Contact sales team';

      items.push(`
        <li class="location-card-item ${isDefault ? 'active-location' : ''}" data-loc-id="${loc.id}" style="
          padding: 18px; 
          border: 1.5px solid ${isDefault ? 'var(--primary-blue)' : 'var(--border-color)'}; 
          border-radius: var(--radius-md); 
          background: ${isDefault ? 'rgba(37, 99, 235, 0.03)' : 'var(--bg-white)'}; 
          margin-bottom: 14px; 
          transition: all 0.2s ease;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-dark); display: flex; align-items: center; gap: 8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin" style="color: var(--primary-red); flex-shrink: 0;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${loc.title}</span>
            </div>
            ${isDefault ? `<span style="font-size: 0.7rem; font-weight: 700; padding: 2px 8px; background: rgba(37, 99, 235, 0.1); color: var(--primary-blue); border-radius: 12px; border: 1px solid rgba(37, 99, 235, 0.2);">Main Branch</span>` : ''}
          </div>

          <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 8px; padding-left: 26px;">
            ${loc.address}
          </p>

          <p style="font-size: 0.85rem; color: var(--text-dark); margin-bottom: 12px; padding-left: 26px;">
            <strong>Phone:</strong> ${phonesHtml}
          </p>

          ${loc.mapEmbedUrl ? `
            <div style="padding-left: 26px;">
              <button type="button" class="btn-select-map-loc" data-map-url="${loc.mapEmbedUrl}" style="
                background: var(--bg-neutral); 
                border: 1px solid var(--border-color); 
                padding: 6px 14px; 
                border-radius: var(--radius-sm); 
                font-size: 0.8rem; 
                font-weight: 600; 
                color: var(--primary-blue); 
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
              ">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
                Show Map Location
              </button>
            </div>
          ` : ''}
        </li>
      `);
    });

    // Render WhatsApp Item
    if (settings.showWhatsapp && settings.whatsapp) {
      const waNumber = sanitizePhoneNumber(settings.whatsapp);
      items.push(`
        <li style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-neutral); margin-bottom: 12px; display: flex; align-items: flex-start; gap: 12px;">
          <div style="background: rgba(37, 211, 102, 0.12); color: #16a34a; padding: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-dark); margin-bottom: 2px;">WhatsApp Support</div>
            <p style="margin: 0; font-size: 0.88rem; color: var(--text-muted);">
              <a href="https://wa.me/${waNumber}" target="_blank" style="color: #16a34a; font-weight: 700; text-decoration: none;">+${waNumber}</a>
            </p>
          </div>
        </li>
      `);
    }

    // Render Email Item
    if (settings.showEmail && settings.email) {
      items.push(`
        <li style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-neutral); margin-bottom: 12px; display: flex; align-items: flex-start; gap: 12px;">
          <div style="background: rgba(37, 99, 235, 0.1); color: var(--primary-blue); padding: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-dark); margin-bottom: 2px;">Email Inquiry</div>
            <p style="margin: 0; font-size: 0.88rem; color: var(--text-muted);">
              <a href="mailto:${settings.email}" style="color: var(--primary-blue); font-weight: 600; text-decoration: none;">${settings.email}</a>
            </p>
          </div>
        </li>
      `);
    }

    // Option to render Primary Contact Person if configured
    if (settings.showPrimaryContact && (settings.contactPhone || settings.contactName)) {
      items.push(`
        <li style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-neutral); margin-bottom: 12px; display: flex; align-items: flex-start; gap: 12px;">
          <div style="background: rgba(37, 99, 235, 0.1); color: var(--primary-blue); padding: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-dark); margin-bottom: 2px;">${settings.contactName || 'Primary Officer'}</div>
            <p style="margin: 0; font-size: 0.88rem; color: var(--text-muted);">
              <a href="tel:${sanitizePhoneNumber(settings.contactPhone)}" style="color: var(--primary-blue); font-weight: 700; text-decoration: none;">${settings.contactPhone}</a>
            </p>
          </div>
        </li>
      `);
    }

    contactList.innerHTML = items.join('');

    // Add event listeners to "Show Map Location" buttons
    contactList.querySelectorAll(".btn-select-map-loc").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.dataset.mapUrl;
        if (mapIframe && url) {
          mapIframe.src = url;
        }

        const parentCard = btn.closest(".location-card-item");
        contactList.querySelectorAll(".location-card-item").forEach(card => {
          card.style.borderColor = "var(--border-color)";
          card.style.background = "var(--bg-white)";
        });
        if (parentCard) {
          parentCard.style.borderColor = "var(--primary-blue)";
          parentCard.style.background = "rgba(37, 99, 235, 0.03)";
        }
      });
    });
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

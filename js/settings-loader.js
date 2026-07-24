/**
 * Roadlink Automobiles - Global Settings Management
 * Integrates with Cloudflare Worker Backend API for public website settings.
 */

import { apiRequest } from "./shared/api.js";

export const DEFAULT_SETTINGS = {
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
          address: data.showroom_address || data.address || DEFAULT_SETTINGS.address,
          phone: data.showroom_phone || data.phone || DEFAULT_SETTINGS.phone,
          showroomAddress: data.showroom_address || data.showroomAddress || data.address || DEFAULT_SETTINGS.showroomAddress,
          showroomPhone: data.showroom_phone || data.showroomPhone || data.phone || DEFAULT_SETTINGS.showroomPhone,
          showShowroom: (data.show_showroom ?? data.showShowroom ?? 1) == 1,
          corporateAddress: data.corporate_address || data.corporateAddress || DEFAULT_SETTINGS.corporateAddress,
          corporatePhone: data.corporate_phone || data.corporatePhone || DEFAULT_SETTINGS.corporatePhone,
          showCorporate: (data.show_corporate ?? data.showCorporate ?? 0) == 1,
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
          seoDefaultDescription: data.seo_default_description || data.seoDefaultDescription || DEFAULT_SETTINGS.seoDefaultDescription
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
 * Hydrates homepage contact section and footer contact list from database locations
 */
function hydrateLocationsUI(locations) {
  const settings = getSettings();
  const defaultLoc = locations.find(l => l.isDefault) || locations[0];
  const mapIframe = document.getElementById("contact-map-iframe") || document.querySelector(".map-container iframe");

  // 1. Initial Map Iframe setup
  if (mapIframe && defaultLoc && defaultLoc.mapUrl) {
    mapIframe.src = defaultLoc.mapUrl;
  }

  // 2. Homepage Location Cards (#dyn-contact-list)
  const contactList = document.getElementById("dyn-contact-list");
  if (contactList) {
    const cardsHtml = locations.map((loc, idx) => {
      const isDefault = loc.isDefault;
      const phonesHtml = (loc.phones || []).map(p => `
        <a href="tel:${p.replace(/[^0-9+]/g, '')}" style="color: inherit; text-decoration: none; font-weight: 600;">${p}</a>
      `).join(' &bull; ') || 'Contact sales team';

      return `
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

          <div style="font-size: 0.85rem; color: var(--text-dark); display: flex; align-items: center; gap: 8px; padding-left: 26px; margin-bottom: 12px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone" style="color: var(--primary-blue); flex-shrink: 0;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <div>${phonesHtml}</div>
          </div>

          ${loc.mapUrl ? `
            <div style="padding-left: 26px; display: flex; gap: 10px; align-items: center;">
              <button type="button" class="btn-select-map-loc" data-map-url="${loc.mapUrl}" style="
                background: var(--primary-blue); 
                color: #fff; 
                border: none; 
                padding: 6px 14px; 
                border-radius: var(--radius-sm); 
                font-size: 0.8rem; 
                font-weight: 600; 
                cursor: pointer; 
                display: inline-flex; 
                align-items: center; 
                gap: 5px;
              ">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
                Show on Map
              </button>
              <a href="${loc.mapUrl}" target="_blank" rel="noopener" style="font-size: 0.8rem; color: var(--primary-blue); font-weight: 600; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">
                Open Directions &rarr;
              </a>
            </div>
          ` : ''}
        </li>
      `;
    }).join('');

    contactList.innerHTML = cardsHtml;

    // Add event listeners to "Show on Map" buttons
    contactList.querySelectorAll(".btn-select-map-loc").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.dataset.mapUrl;
        if (mapIframe && url) {
          mapIframe.src = url;
        }

        // Highlight active card
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
          <a href="tel:${p.replace(/[^0-9+]/g, '')}" style="color: inherit; text-decoration: none;">${p}</a>
        `).join(', ');

        footerItems.push(`
          <li class="footer-contact-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>${phoneLinks}</span>
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
 * Dynamically updates contact details, company brand names, titles, and meta tags on the current HTML page based on stored settings.
 */
export function hydratePageContacts() {
  const settings = getSettings();
  
  // 1. Update Document Title if it mentions default company name or suffix
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

  // 4. Update Homepage Location/Contact Section (#dyn-contact-list)
  const contactList = document.getElementById("dyn-contact-list");
  if (contactList) {
    const itemsHtml = [];

    // 1. Showroom Contact
    if (settings.showShowroom && (settings.showroomAddress || settings.showroomPhone)) {
      itemsHtml.push(`
        <li class="location-item">
          <div class="location-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-store"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M18 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M14 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M10 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M6 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/></svg>
          </div>
          <div class="location-text">
            <h4>Showroom Location</h4>
            ${settings.showroomAddress ? `<p>${settings.showroomAddress}</p>` : ''}
            ${settings.showroomPhone ? `<p style="margin-top: 4px;"><a href="tel:${settings.showroomPhone.replace(/[^0-9+]/g, '')}">${settings.showroomPhone}</a></p>` : ''}
          </div>
        </li>
      `);
    }

    // 2. Corporate Office Contact
    if (settings.showCorporate && (settings.corporateAddress || settings.corporatePhone)) {
      itemsHtml.push(`
        <li class="location-item">
          <div class="location-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-building-2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
          </div>
          <div class="location-text">
            <h4>Corporate Office</h4>
            ${settings.corporateAddress ? `<p>${settings.corporateAddress}</p>` : ''}
            ${settings.corporatePhone ? `<p style="margin-top: 4px;"><a href="tel:${settings.corporatePhone.replace(/[^0-9+]/g, '')}">${settings.corporatePhone}</a></p>` : ''}
          </div>
        </li>
      `);
    }

    // 3. Primary Contact Person
    if (settings.showPrimaryContact && (settings.contactPhone || settings.contactName)) {
      itemsHtml.push(`
        <li class="location-item">
          <div class="location-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-check"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
          </div>
          <div class="location-text">
            <h4>${settings.contactName || 'Primary Contact'}</h4>
            ${settings.contactPhone ? `<p><a href="tel:${settings.contactPhone.replace(/[^0-9+]/g, '')}">${settings.contactPhone}</a></p>` : ''}
          </div>
        </li>
      `);
    }

    // 4. WhatsApp
    if (settings.showWhatsapp && settings.whatsapp) {
      const waClean = settings.whatsapp.replace(/[^0-9]/g, '');
      itemsHtml.push(`
        <li class="location-item">
          <div class="location-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="location-text">
            <h4>WhatsApp Hotline</h4>
            <p><a href="https://wa.me/${waClean}" target="_blank" rel="noopener">+${waClean}</a></p>
          </div>
        </li>
      `);
    }

    // 5. Email
    if (settings.showEmail && settings.email) {
      itemsHtml.push(`
        <li class="location-item">
          <div class="location-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <div class="location-text">
            <h4>Email Inquiry</h4>
            <p><a href="mailto:${settings.email}">${settings.email}</a></p>
          </div>
        </li>
      `);
    }

    if (itemsHtml.length > 0) {
      contactList.innerHTML = itemsHtml.join('');
    }
  }

  // 6. Update Footer Contacts List (.footer-contact-list)
  document.querySelectorAll(".footer-contact-list").forEach(list => {
    const footerItems = [];

    // Location
    let primaryAddress = '';
    if (settings.showShowroom && settings.showroomAddress) primaryAddress = settings.showroomAddress;
    else if (settings.showCorporate && settings.corporateAddress) primaryAddress = settings.corporateAddress;
    else if (settings.showroomAddress || settings.address) primaryAddress = settings.showroomAddress || settings.address;

    if (primaryAddress) {
      footerItems.push(`
        <li class="footer-contact-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${primaryAddress}</span>
        </li>
      `);
    }

    // Phone
    let primaryPhone = '';
    if (settings.showShowroom && settings.showroomPhone) primaryPhone = settings.showroomPhone;
    else if (settings.showPrimaryContact && settings.contactPhone) primaryPhone = settings.contactPhone;
    else if (settings.showCorporate && settings.corporatePhone) primaryPhone = settings.corporatePhone;
    else if (settings.showroomPhone || settings.phone) primaryPhone = settings.showroomPhone || settings.phone;

    if (primaryPhone) {
      footerItems.push(`
        <li class="footer-contact-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span><a href="tel:${primaryPhone.replace(/[^0-9+]/g, '')}" style="color: inherit; text-decoration: none;">${primaryPhone}</a></span>
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

  // 7. Hydrate Anchor Tags (tel, mailto, wa.me, facebook, youtube)
  document.querySelectorAll("a").forEach(link => {
    const href = link.getAttribute("href") || "";
    
    if (href.startsWith("tel:") || link.classList.contains("btn-call-action")) {
      const targetPhone = settings.showroomPhone || settings.phone;
      if (targetPhone) {
        const cleanPhone = targetPhone.replace(/[^0-9+]/g, "");
        link.href = `tel:${cleanPhone}`;
        if (link.classList.contains("btn-call-action")) {
          // Keep inner SVG, update text
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
        const waNumber = settings.whatsapp.replace(/[^0-9]/g, "");
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

  // 8. Hydrate JSON-LD Structured Data
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const json = JSON.parse(script.textContent);
      if (json['@type'] === 'AutoDealer' || json['@type'] === 'Organization') {
        if (settings.companyName) json.name = settings.companyName;
        if (settings.showroomPhone || settings.phone) json.telephone = settings.showroomPhone || settings.phone;
        if (settings.email) json.email = settings.email;
        if (json.address && (settings.showroomAddress || settings.address)) {
          json.address.streetAddress = settings.showroomAddress || settings.address;
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

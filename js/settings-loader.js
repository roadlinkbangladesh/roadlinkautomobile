/**
 * Roadlink Automobiles - Global Settings Management
 * Integrates with Cloudflare Worker Backend API for public website settings.
 */

import { apiRequest } from "./shared/api.js";

export const DEFAULT_SETTINGS = {
  companyName: "Roadlink Automobiles",
  address: "169 (Level 2), Fakirerpool, Dhaka 1000",
  phone: "+880 1311-503840",
  whatsapp: "8801311503840",
  email: "roadlinkbangladesh@gmail.com",
  facebookUrl: "https://www.facebook.com/roadlinkautomobiles",
  youtubeUrl: "https://www.youtube.com/@roadlinkautomobiles9168",
  seoTitleSuffix: "Roadlink Automobiles",
  seoDefaultKeywords: "Japanese cars, reconditioned cars, Dhaka car importer, Toyota Axio, Honda Vezel, Nissan X-Trail, Roadlink Automobiles Bangladesh",
  seoDefaultDescription: "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock."
};

let cachedSettings = { ...DEFAULT_SETTINGS };

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
          whatsapp: data.whatsapp || DEFAULT_SETTINGS.whatsapp,
          email: data.email || DEFAULT_SETTINGS.email,
          facebookUrl: data.facebook || data.facebookUrl || DEFAULT_SETTINGS.facebookUrl,
          youtubeUrl: data.youtube || data.youtubeUrl || DEFAULT_SETTINGS.youtubeUrl,
          seoTitleSuffix: data.seo_title_suffix || data.seoTitleSuffix || DEFAULT_SETTINGS.seoTitleSuffix,
          seoDefaultKeywords: data.seo_default_keywords || data.seoDefaultKeywords || DEFAULT_SETTINGS.seoDefaultKeywords,
          seoDefaultDescription: data.seo_default_description || data.seoDefaultDescription || DEFAULT_SETTINGS.seoDefaultDescription
        };
        hydratePageContacts();
      }
    }
  } catch (err) {
    console.error("Failed to fetch public settings:", err);
  }
  return cachedSettings;
}

/**
 * Synchronous getter returning current cached settings.
 */
export function getSettings() {
  return cachedSettings;
}

/**
 * Dynamically updates contact details on the current HTML page based on stored settings.
 */
export function hydratePageContacts() {
  const settings = getSettings();
  
  // Hydrate Text Contents
  document.querySelectorAll(".company-address, p:has(a[href*='mailto:'])").forEach(el => {
    if (el.classList.contains("company-address") || el.innerHTML.includes("Fakirerpool")) {
      if (el.tagName === "P" && el.innerHTML.includes("<br>")) {
        el.innerHTML = settings.address.replace(", Fakirerpool,", ", Fakirerpool,<br>");
      } else {
        el.textContent = settings.address;
      }
    }
  });

  // Update specific address block in lists
  document.querySelectorAll(".location-text p").forEach(el => {
    if (el.textContent.includes("Fakirerpool") || el.textContent.includes("169")) {
      el.textContent = settings.address;
    }
  });

  document.querySelectorAll(".footer-contact-item span").forEach(el => {
    if (el.textContent.includes("Fakirerpool") || el.textContent.includes("169")) {
      el.innerHTML = settings.address.replace("Fakirerpool, ", "Fakirerpool,<br>");
    }
  });

  // Hydrate Anchor Tags (tel, mailto, wa.me, facebook, youtube)
  document.querySelectorAll("a").forEach(link => {
    const href = link.getAttribute("href") || "";
    
    if (href.startsWith("tel:")) {
      const cleanPhone = settings.phone.replace(/[^0-9+]/g, "");
      link.href = `tel:${cleanPhone}`;
      if (link.textContent.trim().includes("+880") || link.textContent.trim().includes("1311")) {
        link.textContent = settings.phone;
      }
    } else if (href.includes("mailto:")) {
      link.href = `mailto:${settings.email}`;
      if (link.textContent.trim().includes("roadlink") || link.textContent.trim().includes("@")) {
        link.textContent = settings.email;
      }
    } else if (href.includes("wa.me/")) {
      const waNumber = settings.whatsapp.replace(/[^0-9]/g, "");
      const waMatch = href.match(/wa\.me\/([0-9]+)/);
      if (waMatch) {
        link.href = href.replace(waMatch[1], waNumber);
      } else {
        link.href = `https://wa.me/${waNumber}`;
      }
    } else if (href.includes("facebook.com/roadlinkautomobiles") || link.classList.contains("facebook-link")) {
      link.href = settings.facebookUrl;
    } else if (href.includes("youtube.com/") || link.classList.contains("youtube-link")) {
      link.href = settings.youtubeUrl;
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

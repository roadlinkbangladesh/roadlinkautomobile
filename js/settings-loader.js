/**
 * Roadlink Automobiles - Global Settings Management
 * Handles persistent storing of showroom contact details, SEO configurations, and admin password.
 */

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

/**
 * Retrieves settings from localStorage, falling back to defaults.
 * @returns {Object} Settings object
 */
export function getSettings() {
  try {
    const saved = localStorage.getItem("roadlink_settings");
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error("Failed to read settings from localStorage:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Saves settings to localStorage.
 * @param {Object} settings - New settings object
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem("roadlink_settings", JSON.stringify(settings));
    
    // Fire custom event so other components know settings updated
    window.dispatchEvent(new CustomEvent("roadlink_settings_updated", { detail: settings }));
    return true;
  } catch (err) {
    console.error("Failed to save settings to localStorage:", err);
    return false;
  }
}

/**
 * Dynamically updates contact details on the current HTML page based on stored settings.
 */
export function hydratePageContacts() {
  const settings = getSettings();
  
  // Hydrate Text Contents
  document.querySelectorAll(".company-address, p:has(a[href*='mailto:'])").forEach(el => {
    if (el.classList.contains("company-address") || el.innerHTML.includes("Fakirerpool")) {
      // Respect multi-line layouts if any, or keep it clean
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
      // Update text if it's showing the phone number
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
        // Fallback fallback URL building
        link.href = `https://wa.me/${waNumber}`;
      }
    } else if (href.includes("facebook.com/roadlinkautomobiles") || link.classList.contains("facebook-link")) {
      link.href = settings.facebookUrl;
    } else if (href.includes("youtube.com/") || link.classList.contains("youtube-link")) {
      link.href = settings.youtubeUrl;
    }
  });
}

// Automatically run on page load if imported directly
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydratePageContacts);
  } else {
    hydratePageContacts();
  }
}

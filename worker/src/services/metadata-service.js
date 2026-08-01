import { SettingsRepository } from "../repositories/settings-repository.js";
import { VehicleService } from "./vehicle-service.js";
import { resolveFileUrl } from "../utils/storage.js";

/**
 * Helper to safely escape HTML special characters for attribute and element text.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts a relative or absolute URL/path into a fully qualified absolute HTTP/HTTPS URL.
 * Uses apiBaseUrl for media/API file routes and publicBaseUrl for static web pages/assets.
 */
function toAbsoluteUrl(urlOrPath, publicBaseUrl, apiBaseUrl) {
  if (!urlOrPath) return "";
  const trimmed = String(urlOrPath).trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  let resolvedPath = trimmed;
  let targetBase = publicBaseUrl || "";

  // If path is a media storage key or relative API file route
  if (resolvedPath.startsWith("uploads/") || resolvedPath.includes("/api/v1/public/files/")) {
    resolvedPath = resolveFileUrl(resolvedPath);
    targetBase = apiBaseUrl || publicBaseUrl || "";
  }

  const cleanBase = (targetBase || "").replace(/\/+$/, "");
  const cleanPath = resolvedPath.startsWith("/") ? resolvedPath : "/" + resolvedPath.replace(/^\.\//, "");
  return `${cleanBase}${cleanPath}`;
}

/**
 * Truncates text cleanly at word boundaries.
 */
function truncateText(text, maxLength = 250) {
  if (!text) return "";
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 100) {
    return truncated.substring(0, lastSpace) + "...";
  }
  return truncated + "...";
}

export class MetadataService {
  /**
   * Compiles complete page metadata object sourced from Settings & Vehicle DB records.
   */
  static async buildPageMetadata(env, options = {}) {
    const { requestUrl = "", baseUrl = "", workerOrigin = "", apiBaseUrl = "", pageType = "home", vehicleIdentifier = null } = options;

    const publicBaseUrl = baseUrl || (requestUrl ? new URL(requestUrl).origin : "");
    const effectiveApiBaseUrl = env?.WORKER_API_URL || apiBaseUrl || workerOrigin || publicBaseUrl;

    let settings = null;
    try {
      if (env && env.DB) {
        settings = await SettingsRepository.getPublicSettings(env.DB);
      }
    } catch (err) {
      console.error("Failed to load settings for metadata:", err);
    }

    const companyName = settings?.company_name || settings?.companyName || "Roadlink Automobiles";
    const defaultSeoTitle = settings?.website_title || `${companyName} | Premium Japanese Reconditioned Vehicles Importer`;
    const defaultSeoDesc = settings?.website_description || settings?.seo_default_description || "Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock.";
    const defaultSeoKeywords = settings?.seo_default_keywords || "Japanese cars, reconditioned cars, Dhaka car importer, Toyota Axio, Honda Vezel, Nissan X-Trail, Roadlink Automobiles Bangladesh";

    let vehicle = null;
    if (pageType === "vehicle" && vehicleIdentifier && env && env.DB) {
      try {
        vehicle = await VehicleService.getPublicVehicle(env.DB, vehicleIdentifier);
      } catch (err) {
        console.warn(`Vehicle metadata lookup failed for "${vehicleIdentifier}":`, err.message);
      }
    }

    let title = "";
    let description = "";
    let keywords = defaultSeoKeywords;
    let canonicalUrl = requestUrl || publicBaseUrl;
    let ogImageRaw = settings?.og_image_url || settings?.company_logo_url || "";

    if (pageType === "vehicle" && vehicle) {
      // Dynamic Vehicle Title
      const gradePart = vehicle.grade ? ` Grade ${vehicle.grade}` : "";
      const vehicleTitleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${gradePart}`;
      title = `${vehicleTitleStr} | ${companyName}`;

      // Dynamic Vehicle Description
      const specs = [];
      specs.push(`Reconditioned ${vehicle.year} ${vehicle.make} ${vehicle.model}${gradePart}`);
      if (vehicle.engineCC) specs.push(`Engine: ${vehicle.engineCC}cc`);
      if (vehicle.transmission) specs.push(`Trans: ${vehicle.transmission}`);
      if (vehicle.mileage) specs.push(`Mileage: ${Number(vehicle.mileage).toLocaleString()} km`);
      if (vehicle.fuel) specs.push(`Fuel: ${vehicle.fuel}`);

      const shortDesc = vehicle.shortDescription || vehicle.description || "";
      const rawDesc = `${specs.join(". ")}. ${shortDesc}`.trim();
      description = truncateText(rawDesc, 220);

      // Dynamic Vehicle Keywords
      keywords = `${vehicle.year} ${vehicle.make} ${vehicle.model}, ${vehicle.make} ${vehicle.model} Bangladesh, ${vehicle.bodyType || 'Japanese'} car, ${companyName}`;

      // Dynamic Vehicle Cover Image
      const vehicleCover = vehicle.coverImage || vehicle.posterImage || (Array.isArray(vehicle.images) ? vehicle.images[0] : "");
      if (vehicleCover) {
        ogImageRaw = vehicleCover;
      }

      // Canonical URL for Vehicle Page
      canonicalUrl = `${publicBaseUrl}/vehicle.html?stock=${encodeURIComponent(vehicle.stockNumber || vehicle.id)}`;
    } else if (pageType === "stock") {
      title = `Stock Inventory | ${settings?.website_title || companyName}`;
      description = `Explore our complete inventory of verified Japanese reconditioned vehicles at ${companyName}. ${defaultSeoDesc}`;
      canonicalUrl = `${publicBaseUrl}/stock.html`;
    } else {
      // Homepage / Generic
      title = defaultSeoTitle;
      description = defaultSeoDesc;
      canonicalUrl = requestUrl || publicBaseUrl || `${publicBaseUrl}/`;
    }

    const ogTitle = (pageType === "vehicle" && vehicle) ? title : (settings?.og_title || settings?.website_title || title);
    const ogDescription = (pageType === "vehicle" && vehicle) ? description : (settings?.og_description || settings?.website_description || description);

    const ogImage = toAbsoluteUrl(ogImageRaw || "/assets/og-image.jpg", publicBaseUrl, effectiveApiBaseUrl);
    const ogImageAlt = (pageType === "vehicle" && vehicle)
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model} - ${companyName}`
      : `${companyName} - Premium Japanese Reconditioned Vehicles Importer`;

    const twitterTitle = (pageType === "vehicle" && vehicle) ? title : (settings?.twitter_title || ogTitle);
    const twitterDescription = (pageType === "vehicle" && vehicle) ? description : (settings?.twitter_description || ogDescription);
    const twitterImageRaw = (pageType === "vehicle" && vehicle) ? ogImageRaw : (settings?.twitter_image_url || ogImageRaw);
    const twitterImage = toAbsoluteUrl(twitterImageRaw || ogImage, publicBaseUrl, effectiveApiBaseUrl);

    const faviconUrl = settings?.favicon_url ? toAbsoluteUrl(settings.favicon_url, publicBaseUrl, effectiveApiBaseUrl) : "";

    return {
      title,
      description,
      keywords,
      canonicalUrl,
      companyName,
      ogTitle,
      ogDescription,
      ogImage,
      ogImageAlt,
      twitterTitle,
      twitterDescription,
      twitterImage,
      faviconUrl,
      pageType,
      vehicle,
      settings
    };
  }

  /**
   * Injects metadata into an HTML document template string.
   */
  static renderHtml(htmlTemplate, metadata) {
    if (!htmlTemplate || typeof htmlTemplate !== "string") {
      return htmlTemplate;
    }

    let html = htmlTemplate;

    const {
      title,
      description,
      keywords,
      canonicalUrl,
      companyName,
      ogTitle,
      ogDescription,
      ogImage,
      ogImageAlt,
      twitterTitle,
      twitterDescription,
      twitterImage,
      faviconUrl,
      vehicle,
      settings
    } = metadata;

    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeKeywords = escapeHtml(keywords);
    const safeCanonical = escapeHtml(canonicalUrl);
    const safeCompanyName = escapeHtml(companyName);
    const safeOgTitle = escapeHtml(ogTitle);
    const safeOgDesc = escapeHtml(ogDescription);
    const safeOgImage = escapeHtml(ogImage);
    const safeOgAlt = escapeHtml(ogImageAlt);
    const safeTwTitle = escapeHtml(twitterTitle);
    const safeTwDesc = escapeHtml(twitterDescription);
    const safeTwImage = escapeHtml(twitterImage);

    // 1. Title Tag Replacement
    if (/<title>[\s\S]*?<\/title>/i.test(html)) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${safeTitle}</title>`);
    } else {
      html = html.replace(/<\/head>/i, () => `  <title>${safeTitle}</title>\n</head>`);
    }

    // Helper for replacing or inserting <meta> tags
    const setMetaName = (name, content) => {
      const pattern = new RegExp(`<meta\\s+name=["']${name}["'][\\s\\S]*?>`, "i");
      const tag = `<meta name="${name}" content="${content}">`;
      if (pattern.test(html)) {
        html = html.replace(pattern, () => tag);
      } else {
        html = html.replace(/<\/head>/i, () => `  ${tag}\n</head>`);
      }
    };

    const setMetaProperty = (property, content) => {
      const pattern = new RegExp(`<meta\\s+property=["']${property}["'][\\s\\S]*?>`, "i");
      const tag = `<meta property="${property}" content="${content}">`;
      if (pattern.test(html)) {
        html = html.replace(pattern, () => tag);
      } else {
        html = html.replace(/<\/head>/i, () => `  ${tag}\n</head>`);
      }
    };

    // 2. Standard Meta Tags
    setMetaName("description", safeDesc);
    setMetaName("keywords", safeKeywords);
    setMetaName("author", safeCompanyName);

    // 3. Canonical Link Tag
    const canonicalTag = `<link rel="canonical" href="${safeCanonical}">`;
    if (/<link\s+rel=["']canonical["'][\s\S]*?>/i.test(html)) {
      html = html.replace(/<link\s+rel=["']canonical["'][\s\S]*?>/i, () => canonicalTag);
    } else {
      html = html.replace(/<\/head>/i, () => `  ${canonicalTag}\n</head>`);
    }

    // 4. Open Graph Meta Tags
    setMetaProperty("og:site_name", safeCompanyName);
    setMetaProperty("og:type", vehicle ? "product" : "website");
    setMetaProperty("og:title", safeOgTitle);
    setMetaProperty("og:description", safeOgDesc);
    setMetaProperty("og:url", safeCanonical);
    if (safeOgImage) {
      setMetaProperty("og:image", safeOgImage);
      setMetaProperty("og:image:alt", safeOgAlt);
    }

    // 5. Twitter Card Meta Tags
    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", safeTwTitle);
    setMetaName("twitter:description", safeTwDesc);
    if (safeTwImage) {
      setMetaName("twitter:image", safeTwImage);
    }

    // 6. Favicon Link Tag (if custom favicon is set)
    if (faviconUrl) {
      const safeFavicon = escapeHtml(faviconUrl);
      const faviconTag = `<link rel="icon" href="${safeFavicon}">`;
      if (/<link\s+rel=["'](?:shortcut\s+)?icon["'][\s\S]*?>/i.test(html)) {
        html = html.replace(/<link\s+rel=["'](?:shortcut\s+)?icon["'][\s\S]*?>/i, () => faviconTag);
      } else {
        html = html.replace(/<\/head>/i, () => `  ${faviconTag}\n</head>`);
      }
    }

    // 7. Inject Structured Data (JSON-LD) for Vehicles
    if (vehicle) {
      const jsonLdData = {
        "@context": "https://schema.org",
        "@type": "Car",
        "name": `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        "image": vehicle.images && vehicle.images.length > 0 ? vehicle.images : [safeOgImage],
        "description": vehicle.description || description,
        "brand": {
          "@type": "Brand",
          "name": vehicle.make
        },
        "model": vehicle.model,
        "productionDate": String(vehicle.year),
        "vehicleModelDate": Number(vehicle.year),
        "mileageFromOdometer": {
          "@type": "QuantitativeValue",
          "value": vehicle.mileage || 0,
          "unitCode": "KMT"
        },
        "vehicleTransmission": vehicle.transmission || "Automatic",
        "fuelType": vehicle.fuel || "Hybrid",
        "color": vehicle.exteriorColor || "",
        "bodyType": vehicle.bodyType || "Sedan",
        "offers": {
          "@type": "Offer",
          "priceCurrency": vehicle.currency || "BDT",
          "price": vehicle.price || 0,
          "itemCondition": "https://schema.org/UsedCondition",
          "availability": vehicle.status === "available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
        }
      };

      const jsonLdScript = `<script type="application/ld+json" id="vehicle-json-ld">\n${JSON.stringify(jsonLdData, null, 2)}\n</script>`;

      if (/<script\s+type=["']application\/ld\+json["']\s+id=["']vehicle-json-ld["']>[\s\S]*?<\/script>/i.test(html)) {
        html = html.replace(/<script\s+type=["']application\/ld\+json["']\s+id=["']vehicle-json-ld["']>[\s\S]*?<\/script>/i, () => jsonLdScript);
      } else {
        html = html.replace(/<\/head>/i, () => `  ${jsonLdScript}\n</head>`);
      }
    } else if (settings) {
      // Inject / update Organization / AutoDealer schema for non-vehicle pages
      const orgLdData = {
        "@context": "https://schema.org",
        "@type": "AutoDealer",
        "name": companyName,
        "url": safeCanonical,
        "telephone": settings.phone || settings.contact_phone || "",
        "email": settings.email || "",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": settings.address || "",
          "addressLocality": "Dhaka",
          "addressCountry": "BD"
        }
      };

      const orgLdScript = `<script type="application/ld+json" id="org-json-ld">\n${JSON.stringify(orgLdData, null, 2)}\n</script>`;

      if (/<script\s+type=["']application\/ld\+json["']\s+id=["']org-json-ld["']>[\s\S]*?<\/script>/i.test(html)) {
        html = html.replace(/<script\s+type=["']application\/ld\+json["']\s+id=["']org-json-ld["']>[\s\S]*?<\/script>/i, () => orgLdScript);
      } else {
        html = html.replace(/<\/head>/i, () => `  ${orgLdScript}\n</head>`);
      }
    }

    return html;
  }
}

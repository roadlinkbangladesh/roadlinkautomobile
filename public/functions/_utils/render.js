/**
 * Safely escapes HTML special characters for attributes and element text.
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
 * Renders HTML with injected SEO and Open Graph metadata.
 * Performs deterministic replacements on HTML head tags.
 */
export function renderHtmlMetadata(htmlTemplate, metadata) {
  if (!htmlTemplate || typeof htmlTemplate !== "string" || !metadata) {
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
    ogLocale,
    twitterTitle,
    twitterDescription,
    twitterImage,
    twitterSite,
    faviconUrl,
    companyLogoUrl,
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
  const safeOgLocale = escapeHtml(ogLocale || "en_US");
  const safeTwTitle = escapeHtml(twitterTitle);
  const safeTwDesc = escapeHtml(twitterDescription);
  const safeTwImage = escapeHtml(twitterImage);
  const safeTwSite = escapeHtml(twitterSite);
  const safeFavicon = escapeHtml(faviconUrl);
  const safeCompanyLogo = escapeHtml(companyLogoUrl);

  // 1. Title Tag Replacement
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${safeTitle}</title>`);
  } else {
    html = html.replace(/<\/head>/i, () => `  <title>${safeTitle}</title>\n</head>`);
  }

  // Helpers for setting meta tags
  const setMetaName = (name, content) => {
    if (!content) return;
    const pattern = new RegExp(`<meta\\s+name=["']${name}["'][\\s\\S]*?>`, "i");
    const tag = `<meta name="${name}" content="${content}">`;
    if (pattern.test(html)) {
      html = html.replace(pattern, () => tag);
    } else {
      html = html.replace(/<\/head>/i, () => `  ${tag}\n</head>`);
    }
  };

  const setMetaProperty = (property, content) => {
    if (!content) return;
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
  setMetaName("robots", "index, follow, max-image-preview:large");

  // 3. Canonical Link Tag
  if (safeCanonical) {
    const canonicalTag = `<link rel="canonical" href="${safeCanonical}">`;
    if (/<link\s+rel=["']canonical["'][\s\S]*?>/i.test(html)) {
      html = html.replace(/<link\s+rel=["']canonical["'][\s\S]*?>/i, () => canonicalTag);
    } else {
      html = html.replace(/<\/head>/i, () => `  ${canonicalTag}\n</head>`);
    }
  }

  // 4. Open Graph Meta Tags
  setMetaProperty("og:site_name", safeCompanyName);
  setMetaProperty("og:type", vehicle ? "product" : "website");
  setMetaProperty("og:title", safeOgTitle);
  setMetaProperty("og:description", safeOgDesc);
  if (safeCanonical) setMetaProperty("og:url", safeCanonical);
  setMetaProperty("og:locale", safeOgLocale);
  if (safeOgImage) {
    setMetaProperty("og:image", safeOgImage);
    setMetaProperty("og:image:width", "1200");
    setMetaProperty("og:image:height", "630");
    setMetaProperty("og:image:alt", safeOgAlt);
  }

  // 5. Twitter Card Meta Tags
  setMetaName("twitter:card", "summary_large_image");
  setMetaName("twitter:title", safeTwTitle);
  setMetaName("twitter:description", safeTwDesc);
  if (safeTwImage) {
    setMetaName("twitter:image", safeTwImage);
  }
  if (safeTwSite) {
    setMetaName("twitter:site", safeTwSite);
  }

  // 6. Favicon, Apple Touch Icon, and WebManifest Link Tags
  if (safeFavicon) {
    const faviconTag = `<link rel="icon" href="${safeFavicon}">`;
    if (/<link\s+rel=["'](?:shortcut\s+)?icon["'][\s\S]*?>/i.test(html)) {
      html = html.replace(/<link\s+rel=["'](?:shortcut\s+)?icon["'][\s\S]*?>/i, () => faviconTag);
    } else {
      html = html.replace(/<\/head>/i, () => `  ${faviconTag}\n</head>`);
    }
  }

  if (safeFavicon || safeCompanyLogo) {
    const appleIcon = safeCompanyLogo || safeFavicon;
    const appleTag = `<link rel="apple-touch-icon" sizes="180x180" href="${appleIcon}">`;
    if (/<link\s+rel=["']apple-touch-icon["'][\s\S]*?>/i.test(html)) {
      html = html.replace(/<link\s+rel=["']apple-touch-icon["'][\s\S]*?>/i, () => appleTag);
    } else {
      html = html.replace(/<\/head>/i, () => `  ${appleTag}\n</head>`);
    }
  }

  const manifestTag = `<link rel="manifest" href="/site.webmanifest">`;
  if (/<link\s+rel=["']manifest["'][\s\S]*?>/i.test(html)) {
    html = html.replace(/<link\s+rel=["']manifest["'][\s\S]*?>/i, () => manifestTag);
  } else {
    html = html.replace(/<\/head>/i, () => `  ${manifestTag}\n</head>`);
  }

  // 7. Inject Structured Data (JSON-LD)
  if (vehicle) {
    const vehicleImages = vehicle.images && vehicle.images.length > 0 ? vehicle.images : [safeOgImage];
    const jsonLdData = {
      "@context": "https://schema.org",
      "@type": ["Car", "Product"],
      "name": `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.grade ? ' Grade ' + vehicle.grade : ''}`,
      "image": vehicleImages,
      "description": vehicle.description || description,
      "sku": vehicle.stockNumber || `STOCK-${vehicle.id}`,
      "mpn": vehicle.chassisNumber || vehicle.stockNumber || String(vehicle.id),
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
        "price": (vehicle.showPrice !== false && vehicle.show_price !== false) ? (vehicle.price || 0) : undefined,
        "priceValidUntil": "2027-12-31",
        "itemCondition": "https://schema.org/UsedCondition",
        "availability": vehicle.status === "available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "seller": {
          "@type": "AutoDealer",
          "name": safeCompanyName
        },
        "url": safeCanonical
      }
    };

    const jsonLdScript = `<script type="application/ld+json" id="vehicle-json-ld">\n${JSON.stringify(jsonLdData, null, 2)}\n</script>`;

    if (/<script\s+type=["']application\/ld\+json["']\s+id=["']vehicle-json-ld["']>[\s\S]*?<\/script>/i.test(html)) {
      html = html.replace(/<script\s+type=["']application\/ld\+json["']\s+id=["']vehicle-json-ld["']>[\s\S]*?<\/script>/i, () => jsonLdScript);
    } else {
      html = html.replace(/<\/head>/i, () => `  ${jsonLdScript}\n</head>`);
    }
  } else if (settings) {
    const sameAsList = [];
    if (settings.facebook) sameAsList.push(settings.facebook);
    if (settings.youtube) sameAsList.push(settings.youtube);

    const orgLdData = {
      "@context": "https://schema.org",
      "@type": "AutoDealer",
      "name": safeCompanyName,
      "url": safeCanonical,
      "logo": safeCompanyLogo || safeOgImage,
      "image": safeOgImage,
      "telephone": settings.phone || settings.contact_phone || settings.showroom_phone || "",
      "email": settings.email || "",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": settings.address || settings.showroom_address || "",
        "addressLocality": "Dhaka",
        "addressRegion": "Dhaka",
        "postalCode": "1000",
        "addressCountry": "BD"
      },
      "sameAs": sameAsList,
      "priceRange": "$$$"
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

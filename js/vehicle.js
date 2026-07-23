/**
 * Roadlink Automobiles - Vehicle Details Page Controller
 * Highly optimized, responsive, accessible, and written in vanilla ES Modules.
 */

import { getAllVehicles, loadVehiclesAsync } from './inventory.js';
import './settings-loader.js';

// App State for the current page
let currentVehicle = null;
let currentGalleryImages = [];
let currentGalleryIndex = 0;

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const initVehicleDetail = async () => {
    // Mobile Header navigation toggle
    initMobileMenu();

    // Load and render vehicle based on URL param ?stock=RL-xxxx
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const stockNo = urlParams.get('stock');

      if (!stockNo) {
        showErrorState("No Reference Number", "Please provide a valid vehicle stock reference number in the URL parameter (e.g. ?stock=RL-8821) to view specifications.");
        return;
      }

      // Load vehicle data
      currentVehicle = await fetchVehicleByStock(stockNo);

      if (!currentVehicle) {
        showErrorState("Vehicle Not Found", `We couldn't locate any vehicle matching stock number "${stockNo}" in our current verified inventory.`);
        return;
      }

      // Hydrate Page Sections
      hydrateSEO(currentVehicle);
      hydrateBreadcrumbs(currentVehicle);
      hydrateStickyContactPanel(currentVehicle);
      hydrateMainMedia(currentVehicle);
      hydrateSpecifications(currentVehicle);
      hydrateFeatures(currentVehicle);
      hydrateDescription(currentVehicle);
      hydrateAuctionSheet(currentVehicle);
      hydratePromotionalPoster(currentVehicle);
      hydrateYoutubeEmbed(currentVehicle);
      
      // Hydrate Related Vehicles section
      hydrateRelatedVehicles(currentVehicle);

      // Initialize interactive handlers
      initLightbox();
      initShareHandler(currentVehicle);

      // Transition views
      document.getElementById('loading-state-overlay').style.display = 'none';
      document.getElementById('vehicle-details-wrapper').style.display = 'block';

    } catch (err) {
      console.error("Critical error displaying vehicle details:", err);
      showErrorState("System Error", "An unexpected error occurred while compiling vehicle specifications. Please reload or contact Roadlink support.");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', initVehicleDetail);
  } else {
    initVehicleDetail();
  }
}

/**
 * Fetch vehicle by stock reference number
 * Fully ready to be swapped with a real fetch API call in future
 */
async function fetchVehicleByStock(stockNumber) {
  const vehicles = await loadVehiclesAsync();
  const match = vehicles.find(
    car => car.stockNumber && car.stockNumber.toLowerCase() === stockNumber.toLowerCase() && car.published !== false
  );
  return match || null;
}

/**
 * Displays user friendly error screen
 */
function showErrorState(title, description) {
  document.getElementById('loading-state-overlay').style.display = 'none';
  document.getElementById('vehicle-details-wrapper').style.display = 'none';
  
  const errorOverlay = document.getElementById('error-state-overlay');
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-desc').textContent = description;
  errorOverlay.style.display = 'block';
}

/**
 * Mobile Navigation Drawer management
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu-links');
  
  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.classList.contains('active');
      toggleBtn.classList.toggle('active');
      navMenu.classList.toggle('active');
      toggleBtn.setAttribute('aria-expanded', !isExpanded);
    });

    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        toggleBtn.classList.remove('active');
        navMenu.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

/**
 * Hydrates SEO dynamic elements in header and injects JSON-LD Schema
 */
function hydrateSEO(car) {
  const pageTitle = `${car.year} ${car.make} ${car.model} | Stock No: ${car.stockNumber} | Roadlink Automobiles`;
  const pageDesc = car.shortDescription || `Check out the reconditioned Japanese ${car.year} ${car.make} ${car.model} available at Roadlink Automobiles Dhaka. Verifiable Grade ${car.grade}, genuine ${formatMileage(car.mileage)} mileage.`;
  const currentUrl = window.location.href;
  const coverImg = car.coverImage || car.posterImage || car.images[0] || '';

  // Update DOM Title and description
  document.title = pageTitle;
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute('content', pageDesc);

  // Update Canonical
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', currentUrl);

  // Update Open Graph (OG) Tags
  const ogMappings = {
    'og:title': pageTitle,
    'og:description': pageDesc,
    'og:url': currentUrl,
    'og:image': coverImg,
    'og:image:alt': `${car.year} ${car.make} ${car.model} - Roadlink Automobiles`
  };

  for (const [property, val] of Object.entries(ogMappings)) {
    let metaNode = document.querySelector(`meta[property="${property}"]`);
    if (!metaNode) {
      metaNode = document.createElement('meta');
      metaNode.setAttribute('property', property);
      document.head.appendChild(metaNode);
    }
    metaNode.setAttribute('content', val);
  }

  // Update Twitter Tags
  const twitterMappings = {
    'twitter:title': pageTitle,
    'twitter:description': pageDesc,
    'twitter:image': coverImg
  };

  for (const [name, val] of Object.entries(twitterMappings)) {
    let metaNode = document.querySelector(`meta[name="${name}"]`);
    if (!metaNode) {
      metaNode = document.createElement('meta');
      metaNode.setAttribute('name', name);
      document.head.appendChild(metaNode);
    }
    metaNode.setAttribute('content', val);
  }

  // Inject Rich JSON-LD Vehicle Schema
  const schemaScript = document.getElementById('vehicle-json-ld');
  if (schemaScript) {
    const jsonLdData = {
      "@context": "https://schema.org",
      "@type": "Car",
      "name": `${car.year} ${car.make} ${car.model}`,
      "image": car.images || [coverImg],
      "description": car.description,
      "brand": {
        "@type": "Brand",
        "name": car.make
      },
      "model": car.model,
      "productionDate": car.year.toString(),
      "vehicleModelDate": car.year,
      "mileageFromOdometer": {
        "@type": "QuantitativeValue",
        "value": car.mileage,
        "unitCode": "KMT"
      },
      "vehicleTransmission": car.transmission,
      "vehicleEngine": {
        "@type": "EngineSpecification",
        "engineDisplacement": {
          "@type": "QuantitativeValue",
          "value": car.engineCC,
          "unitCode": "CMQ"
        }
      },
      "fuelType": car.fuel,
      "color": car.exteriorColor,
      "bodyType": car.bodyType,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "BDT",
        "price": car.price,
        "itemCondition": "https://schema.org/UsedCondition",
        "availability": car.status === 'available' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "seller": {
          "@type": "AutoDealer",
          "name": "Roadlink Automobiles",
          "telephone": "+8801311503840",
          "url": "https://your-domain.com"
        }
      }
    };
    schemaScript.textContent = JSON.stringify(jsonLdData, null, 2);
  }
}

/**
 * Hydrates the breadcrumb trail with the current car details
 */
function hydrateBreadcrumbs(car) {
  const activeNode = document.getElementById('breadcrumb-active');
  if (activeNode) {
    activeNode.textContent = `${car.year} ${car.make} ${car.model}`;
  }
}

/**
 * Populates the sticky right column summary panel
 */
function hydrateStickyContactPanel(car) {
  // Reference Stock No
  document.getElementById('ref-stock-number').textContent = car.stockNumber;

  // Status Badge
  const badgeContainer = document.getElementById('status-badge-container');
  badgeContainer.innerHTML = '';
  const badge = document.createElement('span');
  badge.className = `vehicle-badge badge-${car.status}`;
  badge.textContent = car.status.toUpperCase();
  badgeContainer.appendChild(badge);

  // Title elements
  document.getElementById('panel-vehicle-year').textContent = car.year;
  document.getElementById('panel-vehicle-title').textContent = `${car.make} ${car.model}`;
  document.getElementById('panel-vehicle-grade').textContent = car.grade ? `Verifiable Grade: ${car.grade}` : 'Auction Grade Available';

  // Pricing
  document.getElementById('panel-vehicle-price').textContent = formatPrice(car.price, false);
  const negotiableBadge = document.getElementById('panel-negotiable');
  if (car.negotiable) {
    negotiableBadge.style.display = 'inline-block';
  } else {
    negotiableBadge.style.display = 'none';
  }

  // Expected Arrival (only for incoming cars)
  const arrivalSection = document.getElementById('panel-arrival-section');
  if (car.status === 'incoming' && car.arrivalDate) {
    document.getElementById('panel-arrival-date').textContent = car.arrivalDate;
    arrivalSection.style.display = 'flex';
  } else {
    arrivalSection.style.display = 'none';
  }

  // Quick specifications in Sidebar
  document.getElementById('panel-spec-mileage').textContent = formatMileage(car.mileage);
  document.getElementById('panel-spec-trans').textContent = car.transmission || '-';
  document.getElementById('panel-spec-engine').textContent = car.engineCC ? `${car.engineCC.toLocaleString()} cc` : '-';
  document.getElementById('panel-spec-color').textContent = car.exteriorColor || '-';

  // Assembly WhatsApp Message Deep Link
  const whatsappBtn = document.getElementById('panel-btn-whatsapp');
  const whatsAppText = `Assalamu Alaikum.
I am interested in the following vehicle.

Reference No: ${car.stockNumber}
${car.year} ${car.make} ${car.model}

Could you please share the auction sheet and current availability?

Thank you.`;

  const waUrl = `https://wa.me/8801311503840?text=${encodeURIComponent(whatsAppText)}`;
  whatsappBtn.setAttribute('href', waUrl);

  // Last Updated Date
  const lastUpdated = car.updatedAt ? new Date(car.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Today';
  document.getElementById('panel-updated-date').textContent = lastUpdated;
}

/**
 * Hydrates Cover Image and Galleries
 */
function hydrateMainMedia(car) {
  const mainHeroImg = document.getElementById('main-hero-image');
  const coverImageSrc = car.coverImage || car.images[0] || '';
  
  mainHeroImg.src = coverImageSrc;
  mainHeroImg.alt = `${car.year} ${car.make} ${car.model} Cover Photo`;

  // Collect All Images for lightbox indexing
  const extImages = car.exteriorImages || car.images || [];
  const intImages = car.interiorImages || [];

  // Exterior Gallery rendering
  const extSection = document.getElementById('exterior-gallery-section');
  const extGrid = document.getElementById('exterior-gallery-grid');
  extGrid.innerHTML = '';

  if (extImages.length > 0) {
    extImages.forEach((imgUrl, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'gallery-thumb';
      thumb.setAttribute('tabindex', '0');
      thumb.setAttribute('role', 'button');
      thumb.setAttribute('aria-label', `View exterior photo ${idx + 1}`);
      thumb.innerHTML = `<img src="${imgUrl}" alt="Exterior view ${idx + 1} of ${car.make} ${car.model}" loading="lazy">`;
      
      thumb.addEventListener('click', () => {
        openLightbox(extImages, idx);
      });
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(extImages, idx);
        }
      });
      extGrid.appendChild(thumb);
    });
    extSection.style.display = 'block';

    // Bind exterior slider arrows
    const btnExtPrev = document.getElementById('btn-ext-prev');
    const btnExtNext = document.getElementById('btn-ext-next');
    if (btnExtPrev && btnExtNext) {
      btnExtPrev.onclick = (e) => {
        e.stopPropagation();
        extGrid.scrollBy({ left: -extGrid.clientWidth * 0.75, behavior: 'smooth' });
      };
      btnExtNext.onclick = (e) => {
        e.stopPropagation();
        extGrid.scrollBy({ left: extGrid.clientWidth * 0.75, behavior: 'smooth' });
      };
      // Toggle arrow visibility based on image count
      if (extImages.length <= 4) {
        btnExtPrev.style.display = 'none';
        btnExtNext.style.display = 'none';
      } else {
        btnExtPrev.style.display = 'flex';
        btnExtNext.style.display = 'flex';
      }
    }
  } else {
    extSection.style.display = 'none';
  }

  // Interior Gallery rendering
  const intSection = document.getElementById('interior-gallery-section');
  const intGrid = document.getElementById('interior-gallery-grid');
  intGrid.innerHTML = '';

  if (intImages.length > 0) {
    intImages.forEach((imgUrl, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'gallery-thumb';
      thumb.setAttribute('tabindex', '0');
      thumb.setAttribute('role', 'button');
      thumb.setAttribute('aria-label', `View interior photo ${idx + 1}`);
      thumb.innerHTML = `<img src="${imgUrl}" alt="Interior view ${idx + 1} of ${car.make} ${car.model}" loading="lazy">`;
      
      thumb.addEventListener('click', () => {
        openLightbox(intImages, idx);
      });
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(intImages, idx);
        }
      });
      intGrid.appendChild(thumb);
    });
    intSection.style.display = 'block';

    // Bind interior slider arrows
    const btnIntPrev = document.getElementById('btn-int-prev');
    const btnIntNext = document.getElementById('btn-int-next');
    if (btnIntPrev && btnIntNext) {
      btnIntPrev.onclick = (e) => {
        e.stopPropagation();
        intGrid.scrollBy({ left: -intGrid.clientWidth * 0.75, behavior: 'smooth' });
      };
      btnIntNext.onclick = (e) => {
        e.stopPropagation();
        intGrid.scrollBy({ left: intGrid.clientWidth * 0.75, behavior: 'smooth' });
      };
      // Toggle arrow visibility based on image count
      if (intImages.length <= 4) {
        btnIntPrev.style.display = 'none';
        btnIntNext.style.display = 'none';
      } else {
        btnIntPrev.style.display = 'flex';
        btnIntNext.style.display = 'flex';
      }
    }
  } else {
    intSection.style.display = 'none';
  }

  // Setup main cover click to trigger first exterior photo fullscreen
  const mainCoverViewport = document.getElementById('hero-cover-viewport');
  mainCoverViewport.addEventListener('click', () => {
    const fullList = extImages.concat(intImages);
    if (fullList.length > 0) {
      openLightbox(fullList, 0);
    }
  });
}

/**
 * Hydrates Specifications key-values dynamically
 */
function hydrateSpecifications(car) {
  const container = document.getElementById('specs-table-grid');
  container.innerHTML = '';

  const specMapping = [
    { label: 'Reference Number', value: car.stockNumber },
    { label: 'Manufacture Year', value: car.year },
    { label: 'Brand Make', value: car.make },
    { label: 'Model Series', value: car.model },
    { label: 'Auction Grade', value: car.grade },
    { label: 'Genuine Mileage', value: formatMileage(car.mileage) },
    { label: 'Engine Capacity', value: car.engineCC ? `${car.engineCC.toLocaleString()} cc` : null },
    { label: 'Fuel Source', value: car.fuel },
    { label: 'Transmission System', value: car.transmission },
    { label: 'Drive Wheel Config', value: car.drive },
    { label: 'Exterior Color', value: car.exteriorColor },
    { label: 'Interior Upholstery', value: car.interiorColor },
    { label: 'Seating Capacity', value: car.seats ? `${car.seats} Seats` : null },
    { label: 'Cab Cabin Doors', value: car.doors ? `${car.doors} Doors` : null },
    { label: 'Body Style', value: car.bodyType },
    { label: 'Accident History', value: car.accidentHistory },
    { label: 'Chassis Number', value: car.chassisNumber },
    { label: 'Registration', value: car.registration },
    { label: 'Steering Config', value: car.steering === "RHD" ? "Right Hand Drive (RHD)" : car.steering === "LHD" ? "Left Hand Drive (LHD)" : car.steering }
  ];

  specMapping.forEach(spec => {
    // Only render if a valid value exists
    if (spec.value !== undefined && spec.value !== null && spec.value !== '') {
      const row = document.createElement('div');
      row.className = 'spec-details-row';
      row.innerHTML = `
        <span class="spec-lbl-name">${spec.label}</span>
        <span class="spec-val-content">${spec.value}</span>
      `;
      container.appendChild(row);
    }
  });
}

/**
 * Hydrates Features Chip group
 */
function hydrateFeatures(car) {
  const container = document.getElementById('features-tag-cloud');
  const section = document.getElementById('features-section');
  container.innerHTML = '';

  if (car.features && car.features.length > 0) {
    car.features.forEach(feat => {
      const chip = document.createElement('span');
      chip.className = 'feature-tag-chip';
      chip.textContent = feat;
      container.appendChild(chip);
    });
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
}

/**
 * Hydrates full narrative description
 */
function hydrateDescription(car) {
  const descContainer = document.getElementById('description-text-content');
  const section = document.getElementById('description-section');
  
  if (car.description) {
    descContainer.textContent = car.description;
    section.style.display = 'block';
  } else if (car.shortDescription) {
    descContainer.textContent = car.shortDescription;
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
}

/**
 * Hydrates Auction Sheet downloads and visual links
 */
function hydrateAuctionSheet(car) {
  const section = document.getElementById('auction-sheet-section');
  if (car.auctionSheetUrl && car.auctionSheetAvailable) {
    document.getElementById('btn-view-auction').setAttribute('href', car.auctionSheetUrl);
    document.getElementById('btn-download-auction').setAttribute('href', car.auctionSheetUrl);
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
}

/**
 * Hydrates Promotional Poster Section
 */
function hydratePromotionalPoster(car) {
  const section = document.getElementById('poster-section');
  const imgElement = document.getElementById('poster-image-element');
  
  if (car.posterImage) {
    imgElement.src = car.posterImage;
    imgElement.alt = `Official Roadlink Promotional Poster for ${car.year} ${car.make} ${car.model}`;
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
}

/**
 * Hydrates YouTube video player embed iframe
 */
function hydrateYoutubeEmbed(car) {
  const section = document.getElementById('youtube-section');
  const iframeContainer = document.getElementById('youtube-iframe-container');
  iframeContainer.innerHTML = '';

  if (car.youtubeUrl) {
    // Parse video ID from standard or share link
    const videoId = extractYoutubeId(car.youtubeUrl);
    if (videoId) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.title = `YouTube walkaround video of ${car.year} ${car.make} ${car.model}`;
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      
      iframeContainer.appendChild(iframe);
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  } else {
    section.style.display = 'none';
  }
}

/**
 * Hydrates Related Vehicles section with same brand (priority 1) or body type (priority 2)
 */
function hydrateRelatedVehicles(car) {
  const section = document.getElementById('related-vehicles-container');
  const grid = document.getElementById('related-vehicles-grid');
  grid.innerHTML = '';

  // Filter out current vehicle and unpublished vehicles
  const otherVehicles = getAllVehicles().filter(v => v.stockNumber !== car.stockNumber && v.published !== false);

  // Group other vehicles
  const sameMake = otherVehicles.filter(v => v.make.toLowerCase() === car.make.toLowerCase());
  const sameBodyType = otherVehicles.filter(v => v.bodyType.toLowerCase() === car.bodyType.toLowerCase());

  // Merge categories while maintaining unique records
  let matches = [...sameMake];
  
  sameBodyType.forEach(item => {
    if (!matches.some(m => m.stockNumber === item.stockNumber)) {
      matches.push(item);
    }
  });

  // Limit up to 4 items
  matches = matches.slice(0, 4);

  if (matches.length > 0) {
    matches.forEach(carMatch => {
      const card = document.createElement('div');
      card.className = 'vehicle-card';

      // Status Badge
      let statusBadge = '';
      if (carMatch.status === 'sold') {
        statusBadge = `<span class="vehicle-badge badge-sold">SOLD</span>`;
      } else if (carMatch.status === 'reserved') {
        statusBadge = `<span class="vehicle-badge badge-reserved">RESERVED</span>`;
      } else if (carMatch.status === 'incoming') {
        statusBadge = `<span class="vehicle-badge badge-incoming">INCOMING</span>`;
      } else {
        statusBadge = `<span class="vehicle-badge badge-available">AVAILABLE</span>`;
      }

      const gradeBadge = carMatch.grade ? `<span class="vehicle-badge auction-grade">Grade ${carMatch.grade}</span>` : '';

      card.innerHTML = `
        <div class="vehicle-img-wrapper">
          <span class="vehicle-badge badge-category">${carMatch.bodyType.toUpperCase()}</span>
          ${statusBadge}
          ${gradeBadge}
          <img src="${carMatch.posterImage || carMatch.images[0]}" alt="${carMatch.year} ${carMatch.make} ${carMatch.model}" class="vehicle-img" loading="lazy">
        </div>
        <div class="vehicle-content">
          <div class="vehicle-meta-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span class="vehicle-year-make" style="font-size: 0.85rem; color: var(--primary-red); font-weight: 700; text-transform: uppercase;">${carMatch.year} • ${carMatch.make}</span>
            <span class="vehicle-stock-no font-mono" style="font-size: 0.75rem; color: var(--text-muted);">Stock: ${carMatch.stockNumber}</span>
          </div>
          <h3 class="vehicle-title" style="font-size: 1.25rem; margin-bottom: 16px;">${carMatch.model}</h3>
          
          <div class="vehicle-specs-grid">
            <div class="spec-item" title="Genuine Mileage">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; color:var(--accent-blue);">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4M6 20h12" />
              </svg>
              <span>${formatMileage(carMatch.mileage)}</span>
            </div>
            <div class="spec-item" title="Transmission">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; color:var(--accent-blue);">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4V9" />
              </svg>
              <span>${carMatch.transmission}</span>
            </div>
          </div>
          
          <div class="vehicle-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
            <div class="vehicle-price-container">
              <span class="price-label">Price (BDT)</span>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="vehicle-price">${formatPrice(carMatch.price, false)}</span>
                ${carMatch.negotiable ? `<span class="panel-negotiable-badge" style="font-size: 0.6rem; padding: 2px 5px; margin-top: 1px;">Negotiable</span>` : ''}
              </div>
            </div>
            <a href="vehicle.html?stock=${carMatch.stockNumber}" class="btn-view-details" aria-label="View specifications for ${carMatch.make} ${carMatch.model}">View Details</a>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
}

/**
 * Configures the lightbox sliders with swiping capabilities and keyboard binds
 */
function initLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  const activeImg = document.getElementById('lightbox-active-image');
  const counterNode = document.getElementById('lightbox-counter');

  if (!overlay || !closeBtn || !prevBtn || !nextBtn || !activeImg) return;

  // Global triggers inside modules
  window.openLightbox = (imagesList, startIndex) => {
    currentGalleryImages = imagesList;
    currentGalleryIndex = startIndex;
    
    activeImg.src = currentGalleryImages[currentGalleryIndex];
    activeImg.alt = `Fullscreen slide image of ${currentVehicle.make} ${currentVehicle.model}`;
    counterNode.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Freeze scrolling

    closeBtn.focus();
  };

  function closeLightbox() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Release scroll block
  }

  function handleNext() {
    if (currentGalleryImages.length === 0) return;
    currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryImages.length;
    activeImg.src = currentGalleryImages[currentGalleryIndex];
    counterNode.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
  }

  function handlePrev() {
    if (currentGalleryImages.length === 0) return;
    currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
    activeImg.src = currentGalleryImages[currentGalleryIndex];
    counterNode.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
  }

  closeBtn.addEventListener('click', closeLightbox);
  nextBtn.addEventListener('click', handleNext);
  prevBtn.addEventListener('click', handlePrev);

  // Close lightbox clicking outside the active image
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === document.getElementById('lightbox-slide-container')) {
      closeLightbox();
    }
  });

  // Keyboard navigation binds
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    }
  });

  // Mobile swipe support (touch drag start & end bounds)
  let touchStartX = 0;
  let touchEndX = 0;

  overlay.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  overlay.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleGestureSwipe();
  }, { passive: true });

  function handleGestureSwipe() {
    const swipeThreshold = 50; // pixels drag limit
    if (touchEndX < touchStartX - swipeThreshold) {
      handleNext(); // Swiped Left
    } else if (touchEndX > touchStartX + swipeThreshold) {
      handlePrev(); // Swiped Right
    }
  }
}

/**
 * Initializes and configures modern client social sharing with copy-fallback
 */
function initShareHandler(car) {
  const shareBtn = document.getElementById('panel-btn-share');
  if (!shareBtn) return;

  shareBtn.addEventListener('click', async () => {
    const shareData = {
      title: `${car.year} ${car.make} ${car.model} | Roadlink Automobiles`,
      text: `Take a look at this reconditioned Japanese ${car.year} ${car.make} ${car.model} (Stock: ${car.stockNumber}) showing genuine mileage of ${formatMileage(car.mileage)}.`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Native share failure:", err);
          fallbackCopyLink();
        }
      }
    } else {
      fallbackCopyLink();
    }
  });

  function fallbackCopyLink() {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        // Simple elegant feedback overlay inside button
        const origText = shareBtn.innerHTML;
        shareBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check" style="color:var(--whatsapp-green);"><path d="M20 6 9 17l-5-5"/></svg>
          Link Copied!
        `;
        shareBtn.style.borderColor = 'var(--whatsapp-green)';

        setTimeout(() => {
          shareBtn.innerHTML = origText;
          shareBtn.style.borderColor = '';
        }, 2000);
      })
      .catch(err => {
        console.error("Clipboard copy failed:", err);
      });
  }
}

/**
 * UTILITY HELPERS
 */

function formatPrice(amount, negotiable) {
  if (!amount) return '৳ Contact Us';
  const priceFormatted = `৳ ${amount.toLocaleString()}`;
  return negotiable ? `${priceFormatted} (Negotiable)` : priceFormatted;
}

function formatMileage(mileage) {
  if (mileage === undefined || mileage === null) return '-';
  return `${mileage.toLocaleString()} km`;
}

function extractYoutubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

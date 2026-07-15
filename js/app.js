/**
 * Roadlink Automobiles - Main Application JavaScript
 * Highly optimized, vanilla JS only, adhering to W3C and modern standards.
 */

import "./settings-loader.js";
import { getAllVehicles } from "./inventory.js";

/**
 * Maps a standard vehicle object to the presentation format expected by the home page.
 */
function mapVehicleToHomeFormat(v) {
  return {
    id: v.id,
    displayOrder: v.displayOrder,
    stockNumber: v.stockNumber,
    make: v.make,
    model: v.model,
    year: v.year,
    category: v.bodyType && v.bodyType.toLowerCase() === "sedan" ? "sedan" : "suv",
    transmission: v.transmission,
    mileage: typeof v.mileage === 'number' ? `${v.mileage.toLocaleString()} km` : (v.mileage || 'N/A'),
    engine: v.engine || (v.engineCC ? `${(v.engineCC / 1000).toFixed(1)}L ${v.fuel || ''}`.trim() : 'N/A'),
    color: v.exteriorColor || v.color || 'N/A',
    grade: v.grade || 'N/A',
    price: typeof v.price === 'number'
      ? new Intl.NumberFormat("en-BD", {
          style: "currency",
          currency: v.currency || "BDT",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(v.price).replace("BDT", "৳").replace("USD", "$").replace("JPY", "¥")
      : v.price,
    image: v.coverImage || v.images[0] || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800",
    description: v.description || v.shortDescription || ""
  };
}

/**
 * Gets mapped home page featured vehicles from the shared inventory.
 */
function getHomeVehicles() {
  return getAllVehicles()
    .filter(v => v.published !== false && v.featured === true && v.status !== 'draft')
    .map(mapVehicleToHomeFormat);
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Header states
  initStickyHeader();

  // Initialize Navigation Drawer for Mobile devices
  initMobileMenu();

  // Load and render vehicles grid
  renderVehicles('all');

  // Initialize Filter Categorization controls
  initFilters();

  // Initialize Modal close events
  initModalEvents();

  // Active link highlighters on scroll
  initScrollSpy();
});

/**
 * Scroll behavior for Sticky Navigation Header
 */
function initStickyHeader() {
  const header = document.getElementById('main-header');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/**
 * Mobile Navigation Menu drawer transitions
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu-links');
  const navLinks = document.querySelectorAll('.nav-link');

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.classList.contains('active');
    toggleBtn.classList.toggle('active');
    navMenu.classList.toggle('active');
    toggleBtn.setAttribute('aria-expanded', !isExpanded);
  });

  // Automatically collapse when a navigation link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      toggleBtn.classList.remove('active');
      navMenu.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Dynamic generation of vehicle cards based on selection category
 */
function renderVehicles(category = 'all') {
  const grid = document.getElementById('vehicles-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const homeVehicles = getHomeVehicles();
  const filteredVehicles = category === 'all'
    ? [...homeVehicles]
    : homeVehicles.filter(car => car.category === category);

  // Sort by displayOrder ascending for consistent ordering throughout the website
  filteredVehicles.sort((a, b) => {
    const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 999999;
    const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 999999;
    return orderA - orderB;
  });

  if (filteredVehicles.length === 0) {
    grid.innerHTML = `
      <div class="no-results" id="no-results-msg" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <p>No vehicles found matching the selected category. Check back soon!</p>
      </div>
    `;
    return;
  }

  filteredVehicles.forEach(car => {
    const card = document.createElement('div');
    card.className = 'vehicle-card';
    
    // Capitalize category tag
    const categoryLabel = car.category.toUpperCase();
 
    card.innerHTML = `
      <a href="vehicle.html?stock=${car.stockNumber}" class="vehicle-img-link" aria-label="View specifications for ${car.make} ${car.model}" style="display: block; text-decoration: none; color: inherit;">
        <div class="vehicle-img-wrapper">
          <span class="vehicle-badge">${categoryLabel}</span>
          <span class="vehicle-badge auction-grade">Grade ${car.grade}</span>
          <img src="${car.image}" alt="${car.make} ${car.model}" class="vehicle-img" loading="lazy">
        </div>
      </a>
      <div class="vehicle-content">
        <div class="vehicle-year-make">${car.year} • ${car.make}</div>
        <h3 class="vehicle-title">${car.model}</h3>
        
        <div class="vehicle-specs-grid">
          <div class="spec-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 14l4-4" />
              <path d="M3.34 19a10 10 0 1 1 17.32 0" />
            </svg>
            <span>${car.mileage}</span>
          </div>
          <div class="spec-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18M15 3v18" />
            </svg>
            <span>${car.transmission}</span>
          </div>
          <div class="spec-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>${car.engine}</span>
          </div>
          <div class="spec-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="m4.93 4.93 14.14 14.14" />
            </svg>
            <span>${car.color}</span>
          </div>
        </div>
        
        <div class="vehicle-footer">
          <div class="vehicle-price-container">
            <span class="price-label">Price (BDT)</span>
            <span class="vehicle-price">${car.price}</span>
          </div>
          <a href="vehicle.html?stock=${car.stockNumber}" class="btn-view-details" aria-label="View specifications for ${car.make} ${car.model}">View Details</a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * Filter control button click binders
 */
function initFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      const filterValue = e.currentTarget.getAttribute('data-filter');
      renderVehicles(filterValue);
    });
  });
}

/**
 * Detailed Modal presentation management
 */
function openModal(carId) {
  const car = getHomeVehicles().find(c => c.id === carId);
  if (!car) return;

  const modal = document.getElementById('car-modal');
  const modalContent = document.getElementById('modal-dyn-content');
  if (!modal || !modalContent) return;

  // Pre-fill a professional sales request in Urdu/Bangla/English
  const whatsappQuery = `Salam Roadlink Automobiles, I am interested in purchasing the Japanese reconditioned ${car.year} ${car.make} ${car.model} listed for ${car.price} on your website. Please share the auction sheet and booking details.`;
  const whatsappLink = `https://wa.me/8801311503840?text=${encodeURIComponent(whatsappQuery)}`;

  modalContent.innerHTML = `
    <div class="modal-gallery">
      <img src="${car.image}" alt="${car.make} ${car.model}" class="modal-main-img">
    </div>
    <div class="modal-specs">
      <div class="modal-specs-headline">
        <div class="modal-badge-row">
          <span class="modal-badge badge-red">${car.year} Model</span>
          <span class="modal-badge">Auction Sheet Grade ${car.grade}</span>
        </div>
        <h2 class="modal-title">${car.make} ${car.model}</h2>
        <div class="modal-price-tag">${car.price}</div>
      </div>
      
      <p class="why-desc" style="margin-bottom: 24px;">
        ${car.description}
      </p>
 
      <div class="modal-specs-details">
        <div class="modal-spec-row">
          <span class="modal-spec-label">Brand</span>
          <span class="modal-spec-val">${car.make}</span>
        </div>
        <div class="modal-spec-row">
          <span class="modal-spec-label">Model Name</span>
          <span class="modal-spec-val">${car.model}</span>
        </div>
        <div class="modal-spec-row">
          <span class="modal-spec-label">Manufacture Year</span>
          <span class="modal-spec-val">${car.year}</span>
        </div>
        <div class="modal-spec-row">
          <span class="modal-spec-label">Genuine Mileage</span>
          <span class="modal-spec-val">${car.mileage}</span>
        </div>
        <div class="modal-spec-row">
          <span class="modal-spec-label">Transmission</span>
          <span class="modal-spec-val">${car.transmission}</span>
        </div>
        <div class="modal-spec-row">
          <span class="modal-spec-label">Engine Cylinder Displacement</span>
          <span class="modal-spec-val">${car.engine}</span>
        </div>
        <div class="modal-spec-row">
          <span class="modal-spec-label">Color</span>
          <span class="modal-spec-val">${car.color}</span>
        </div>
        <div class="modal-spec-row">
          <span class="modal-spec-label">Verifiable Grade</span>
          <span class="modal-spec-val">${car.grade}</span>
        </div>
      </div>
 
      <div class="modal-actions">
        <a href="${whatsappLink}" target="_blank" class="modal-btn-whatsapp">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-message-circle">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
          Inquire on WhatsApp
        </a>
        <a href="tel:+8801311503840" class="modal-btn-phone">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-phone">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Call +880 1311-503840
        </a>
      </div>
    </div>
  `;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // Freeze background scrolling
  
  // Shift keyboard focus into modal for accessibility purposes
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) closeBtn.focus();
}

function closeModal() {
  const modal = document.getElementById('car-modal');
  if (!modal) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; // Release scroll block
}

function initModalEvents() {
  const modal = document.getElementById('car-modal');
  const closeBtn = document.getElementById('modal-close');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  // Close when user clicks on background overlay
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Handle Escape key presses for quick modal exit
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });
}

/**
 * ScrollSpy highlights current section in sticky navigation links
 */
function initScrollSpy() {
  const sections = document.querySelectorAll('section, footer');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 120; // Margin adjustment

    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        currentId = id;
      }
    });

    if (currentId) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === `#${currentId}`) {
          link.classList.add('active');
        }
      });
    }
  });
}

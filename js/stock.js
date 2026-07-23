/**
 * Roadlink Automobiles - Inventory Page Application JavaScript
 * Fully responsive, modern, vanilla JS only.
 */

import "./settings-loader.js";
import { getAllVehicles, loadVehiclesAsync } from "./inventory.js";

// App State
let allVehicles = [];
let filteredVehicles = [];
let currentLimit = 9;
const LIMIT_INCREMENT = 9;

if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener('DOMContentLoaded', async () => {
    // Guard: Only execute on stock listing page
    if (!document.getElementById('filter-make')) {
      return;
    }

    // Sticky navigation setup
    initStickyHeader();

    // Mobile navigation setup
    initMobileMenu();

    // Load and initial render of vehicles
    try {
      allVehicles = (await loadVehicles()).filter(v => v.published !== false);
      populateDynamicFilters(); // Dynamically populates Make, Body Type, and Fuel filters
      setupFilters();
      applyFiltersAndRender(true); // reset pagination limit on fresh setup
    } catch (error) {
      console.error("Failed to load vehicle inventory:", error);
      showErrorMessage();
    }

    // Setup click actions on filter panel and reset button
    setupEventListeners();
  });
}

/**
 * Simulates loading vehicle data from an API endpoint
 * Resolves with the vehicles array from the shared inventory store
 */
async function loadVehicles() {
  return await loadVehiclesAsync();
}

/**
 * Handle Scroll behavior for Sticky Navigation Header
 */
function initStickyHeader() {
  const header = document.getElementById('main-header');
  if (!header) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/**
 * Mobile Navigation Drawer behaviors
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu-links');
  if (!toggleBtn || !navMenu) return;

  const navLinks = navMenu.querySelectorAll('.nav-link');

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.classList.contains('active');
    toggleBtn.classList.toggle('active');
    navMenu.classList.toggle('active');
    toggleBtn.setAttribute('aria-expanded', !isExpanded);
  });

  // Automatically collapse when clicking navigation links
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      toggleBtn.classList.remove('active');
      navMenu.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Dynamically populates unique filtering options based on loaded vehicles
 */
function populateDynamicFilters() {
  const makeSelect = document.getElementById('filter-make');
  const bodyTypeSelect = document.getElementById('filter-body-type');
  const fuelTypeSelect = document.getElementById('filter-fuel-type');

  if (makeSelect) {
    const makes = [...new Set(allVehicles.map(car => car.make))].filter(Boolean).sort();
    makeSelect.innerHTML = '<option value="All">All Makes</option>';
    makes.forEach(make => {
      const opt = document.createElement('option');
      opt.value = make;
      opt.textContent = make;
      makeSelect.appendChild(opt);
    });
  }

  if (bodyTypeSelect) {
    const bodyTypes = [...new Set(allVehicles.map(car => car.bodyType))].filter(Boolean).sort();
    bodyTypeSelect.innerHTML = '<option value="All">All Types</option>';
    bodyTypes.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      bodyTypeSelect.appendChild(opt);
    });
  }

  if (fuelTypeSelect) {
    const fuels = [...new Set(allVehicles.map(car => car.fuel))].filter(Boolean).sort();
    fuelTypeSelect.innerHTML = '<option value="All">All Fuels</option>';
    fuels.forEach(fuel => {
      const opt = document.createElement('option');
      opt.value = fuel;
      opt.textContent = fuel;
      fuelTypeSelect.appendChild(opt);
    });
  }
}

/**
 * Populate or setup dynamic aspects of filters (e.g. keyboard triggers)
 */
function setupFilters() {
  // Toggle filters on Mobile
  const filterToggleBtn = document.getElementById('filter-mobile-toggle');
  const filterForm = document.getElementById('filter-form');
  
  if (filterToggleBtn && filterForm) {
    filterToggleBtn.addEventListener('click', () => {
      filterForm.classList.toggle('mobile-open');
      const isOpen = filterForm.classList.contains('mobile-open');
      filterToggleBtn.setAttribute('aria-expanded', isOpen);
      filterToggleBtn.querySelector('.toggle-text').textContent = isOpen ? 'Hide Filters' : 'Show Filters';
    });
  }
}

/**
 * Dynamic event listeners configuration
 */
function setupEventListeners() {
  const form = document.getElementById('filter-form');
  if (!form) return;

  // Track field changes to re-filter dynamically
  const filterInputs = form.querySelectorAll('input, select');
  filterInputs.forEach(input => {
    input.addEventListener('input', () => {
      applyFiltersAndRender(true); // Reset limits on change
    });
  });

  // Track change on "Show Sold Vehicles" checkbox
  const showSoldToggle = document.getElementById('toggle-show-sold');
  if (showSoldToggle) {
    showSoldToggle.addEventListener('change', () => {
      // If user unchecks Show Sold, but Status selection was "Sold", reset Status back to "All"
      const statusSelect = document.getElementById('filter-status');
      if (statusSelect && !showSoldToggle.checked && statusSelect.value === 'Sold') {
        statusSelect.value = 'All';
      }
      applyFiltersAndRender(true);
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    applyFiltersAndRender(true);
  });

  // Reset Filters trigger
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      
      // Also uncheck the standalone Show Sold Vehicles checkbox
      if (showSoldToggle) {
        showSoldToggle.checked = false;
      }
      
      applyFiltersAndRender(true);
    });
  }

  // Load More Button trigger
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      currentLimit += LIMIT_INCREMENT;
      renderVehicles();
    });
  }
}

/**
 * Main application filter controller
 */
function applyFiltersAndRender(resetPagination = false) {
  if (resetPagination) {
    currentLimit = LIMIT_INCREMENT;
  }

  const searchVal = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
  const makeVal = document.getElementById('filter-make')?.value || 'All';
  const bodyTypeVal = document.getElementById('filter-body-type')?.value || 'All';
  const fuelTypeVal = document.getElementById('filter-fuel-type')?.value || 'All';
  const transmissionVal = document.getElementById('filter-transmission')?.value || 'All';
  const statusVal = document.getElementById('filter-status')?.value || 'All';
  const sortByVal = document.getElementById('filter-sort')?.value || 'newest';

  // Toggle/Sync "Show Sold Vehicles" checkbox automatically if user clicks "Sold" in the dropdown status filter
  const showSoldToggle = document.getElementById('toggle-show-sold');
  if (statusVal === 'Sold' && showSoldToggle && !showSoldToggle.checked) {
    showSoldToggle.checked = true;
  }

  const showSold = showSoldToggle?.checked || false;

  // Apply filters
  filteredVehicles = allVehicles.filter(car => {
    const status = car.status.toLowerCase();

    // 0. Hide Sold vehicles unless Show Sold checkbox is active
    if (!showSold && status === 'sold') {
      return false;
    }

    // 1. Search Box
    const matchesSearch = !searchVal || 
      car.make.toLowerCase().includes(searchVal) || 
      car.model.toLowerCase().includes(searchVal);

    // 1.5. Make Type
    const matchesMake = makeVal === 'All' || car.make === makeVal;

    // 2. Body Type
    const matchesBody = bodyTypeVal === 'All' || car.bodyType === bodyTypeVal;

    // 3. Fuel Type
    const matchesFuel = fuelTypeVal === 'All' || car.fuel === fuelTypeVal;

    // 4. Transmission
    const matchesTrans = transmissionVal === 'All' || car.transmission === transmissionVal;

    // 5. Status
    const matchesStatus = statusVal === 'All' || status === statusVal.toLowerCase();

    return matchesSearch && matchesMake && matchesBody && matchesFuel && matchesTrans && matchesStatus;
  });

  // Apply Sorting
  sortVehicles(sortByVal);

  // Render
  renderVehicles();
}

/**
 * Sorts filtered vehicles in place
 */
function sortVehicles(sortBy) {
  switch (sortBy) {
    case 'oldest':
      filteredVehicles.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
    case 'price-asc':
      filteredVehicles.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      filteredVehicles.sort((a, b) => b.price - a.price);
      break;
    case 'mileage-asc':
      filteredVehicles.sort((a, b) => a.mileage - b.mileage);
      break;
    case 'mileage-desc':
      filteredVehicles.sort((a, b) => b.mileage - a.mileage);
      break;
    case 'newest':
    default:
      filteredVehicles.sort((a, b) => {
        const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 999999;
        const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 999999;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        const dateA = a.createdAt ? new Date(a.createdAt) : 0;
        const dateB = b.createdAt ? new Date(b.createdAt) : 0;
        return dateB - dateA;
      });
      break;
  }
}

/**
 * Format functions for presentation layer
 */
function formatPrice(price, negotiable = false) {
  if (price === 0) return "Ask for Price";
  
  // Format to standard Bengali Lakh layout, e.g. 2150000 -> ৳ 21,50,000
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(price);
  
  return `৳ ${formatted}${negotiable ? ' (Negotiable)' : ''}`;
}

function formatMileage(mileage) {
  const formatted = new Intl.NumberFormat('en-US').format(mileage);
  return `${formatted} km`;
}

function formatEngine(engineCC) {
  if (engineCC === 0) return "Electric Motor";
  const formatted = new Intl.NumberFormat('en-US').format(engineCC);
  return `${formatted} cc`;
}

/**
 * Cleanly format arrivalDate string (e.g. YYYY-MM-DD to "DD Month YYYY")
 */
function formatArrivalDate(dateStr) {
  if (!dateStr) return '';
  
  // Parse standard YYYY-MM-DD
  const dateParts = dateStr.split('-');
  if (dateParts.length === 3) {
    const year = parseInt(dateParts[0], 10);
    const monthIndex = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    
    if (!isNaN(year) && !isNaN(monthIndex) && !isNaN(day)) {
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      return `${day} ${months[monthIndex]} ${year}`;
    }
  }
  
  // Fallback for non-standard dates (e.g., "Mid August 2026")
  return dateStr;
}

/**
 * Renders the slice of filtered vehicles to the grid container
 */
function renderVehicles() {
  const grid = document.getElementById('vehicles-grid');
  const loadMoreContainer = document.getElementById('pagination-container');
  const resultsCount = document.getElementById('results-count');

  if (!grid) return;

  grid.innerHTML = '';

  // Update dynamic results count indicator
  if (resultsCount) {
    resultsCount.textContent = `Showing ${Math.min(currentLimit, filteredVehicles.length)} of ${filteredVehicles.length} vehicles`;
  }

  if (filteredVehicles.length === 0) {
    renderEmptyState(grid);
    if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    return;
  }

  // Get active subset based on pagination limits
  const visibleSubset = filteredVehicles.slice(0, currentLimit);

  visibleSubset.forEach(car => {
    const card = renderVehicleCard(car);
    grid.appendChild(card);
  });

  // Handle load more pagination visibility
  if (loadMoreContainer) {
    if (filteredVehicles.length > currentLimit) {
      loadMoreContainer.style.display = 'flex';
    } else {
      loadMoreContainer.style.display = 'none';
    }
  }
}

/**
 * Renders and formats a single vehicle card component
 */
function renderVehicleCard(car) {
  const card = document.createElement('article');
  card.className = 'vehicle-card';
  
  // Badges status calculations
  const featuredBadge = car.featured ? `<span class="vehicle-badge badge-featured">Featured</span>` : '';
  const status = car.status.toLowerCase();
  
  let statusBadge = '';
  if (status === 'sold') {
    statusBadge = `<span class="vehicle-badge badge-sold">SOLD</span>`;
  } else if (status === 'reserved') {
    statusBadge = `<span class="vehicle-badge badge-reserved">RESERVED</span>`;
  } else if (status === 'incoming') {
    statusBadge = `<span class="vehicle-badge badge-incoming">INCOMING</span>`;
  } else if (status === 'available') {
    statusBadge = `<span class="vehicle-badge badge-available">AVAILABLE</span>`;
  }

  // Dynamic Grade presentation
  const gradeBadge = car.grade ? `<span class="vehicle-badge auction-grade">Grade ${car.grade}</span>` : '';

  // WhatsApp click query assembly
  const whatsappMsg = `Hi Roadlink Automobiles, I am interested in your reconditioned ${car.year} ${car.make} ${car.model} (Stock No: ${car.stockNumber}). Please let me know its availability and pricing options. Thank you.`;
  const whatsappUrl = `https://wa.me/8801311503840?text=${encodeURIComponent(whatsappMsg)}`;

  card.innerHTML = `
    <a href="vehicle.html?stock=${car.stockNumber}" class="vehicle-img-link" aria-label="View specifications for ${car.make} ${car.model}" style="display: block; text-decoration: none; color: inherit;">
      <div class="vehicle-img-wrapper">
        <span class="vehicle-badge badge-category">${car.bodyType.toUpperCase()}</span>
        ${statusBadge}
        ${featuredBadge}
        ${gradeBadge}
        <img src="${car.posterImage || car.images[0]}" alt="${car.year} ${car.make} ${car.model}" class="vehicle-img" loading="lazy">
      </div>
    </a>
    <div class="vehicle-content">
      <div class="vehicle-meta-row">
        <span class="vehicle-year-make">${car.year} • ${car.make}</span>
        <span class="vehicle-stock-no">Stock: ${car.stockNumber}</span>
      </div>
      <h3 class="vehicle-title">${car.model}</h3>
      
      ${status === 'incoming' && car.arrivalDate ? `
        <div class="expected-arrival-label">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
            <line x1="16" x2="16" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
          </svg>
          <span>Expected Arrival: ${formatArrivalDate(car.arrivalDate)}</span>
        </div>
      ` : ''}
      
      <div class="vehicle-specs-grid">
        <div class="spec-item" title="Genuine Mileage">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 14l4-4" />
            <path d="M3.34 19a10 10 0 1 1 17.32 0" />
          </svg>
          <span>${formatMileage(car.mileage)}</span>
        </div>
        <div class="spec-item" title="Transmission">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18M15 3v18" />
          </svg>
          <span>${car.transmission}</span>
        </div>
        <div class="spec-item" title="Engine Capacity">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span>${formatEngine(car.engineCC)}</span>
        </div>
        <div class="spec-item" title="Fuel Type">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="m4.93 4.93 14.14 14.14" />
          </svg>
          <span>${car.fuel}</span>
        </div>
      </div>
      
      <div class="vehicle-footer">
        <div class="vehicle-price-container">
          <span class="price-label">Price (BDT)</span>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="vehicle-price">${formatPrice(car.price, false)}</span>
            ${car.negotiable ? `<span class="panel-negotiable-badge" style="font-size: 0.6rem; padding: 2px 5px; margin-top: 1px;">Negotiable</span>` : ''}
          </div>
        </div>
        <div class="card-action-row">
          <a href="vehicle.html?stock=${car.stockNumber}" class="btn-card-details" aria-label="View specifications for ${car.make} ${car.model}">Details</a>
          <a href="${whatsappUrl}" target="_blank" class="btn-card-whatsapp" aria-label="Inquire about ${car.make} ${car.model} on WhatsApp">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </a>
        </div>
      </div>
    </div>
  `;

  return card;
}

/**
 * Display clean empty search state with illustration and reset support
 */
function renderEmptyState(container) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.innerHTML = `
    <div class="empty-icon-box">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-code">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        <path d="m8 10-2 1 2 1"/><path d="m14 10 2 1-2 1"/>
      </svg>
    </div>
    <h3>No vehicles matched your search.</h3>
    <p>Try adjusting your search queries or clearing filters to browse our wider collection.</p>
    <button class="btn btn-primary" id="empty-reset-btn">Reset Filters</button>
  `;

  container.appendChild(emptyState);

  // Attach listener to nested reset button
  const resetBtn = emptyState.querySelector('#empty-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const form = document.getElementById('filter-form');
      if (form) form.reset();
      
      const showSoldToggle = document.getElementById('toggle-show-sold');
      if (showSoldToggle) {
        showSoldToggle.checked = false;
      }
      
      applyFiltersAndRender(true);
    });
  }
}

/**
 * Fallback error UI display
 */
function showErrorMessage() {
  const grid = document.getElementById('vehicles-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="empty-state error">
      <div class="empty-icon-box" style="color: var(--primary-red);">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-circle"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
      </div>
      <h3>Failed to Load Inventory</h3>
      <p>We are currently experiencing technical updates. Please refresh the page or reach us directly on WhatsApp.</p>
      <a href="https://wa.me/8801311503840" class="btn btn-primary">Contact Support</a>
    </div>
  `;
}

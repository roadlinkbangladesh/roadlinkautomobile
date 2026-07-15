/**
 * Roadlink Automobiles - Admin Vehicle Table Module
 * Handles rendering, filtering, sorting, and pagination of the vehicle inventory table.
 */

import { getAllVehicles } from "../js/inventory.js";

const STORAGE_KEYS = {
  SEARCH: "roadlink_admin_search",
  STATUS: "roadlink_admin_status_filter",
  MAKE: "roadlink_admin_make_filter",
  SORT: "roadlink_admin_sort",
  PAGE: "roadlink_admin_page"
};

// Global state for search, filters, sorting, and pagination (persisted via sessionStorage)
export const state = {
  search: sessionStorage.getItem(STORAGE_KEYS.SEARCH) || "",
  statusFilter: sessionStorage.getItem(STORAGE_KEYS.STATUS) || "all",
  makeFilter: sessionStorage.getItem(STORAGE_KEYS.MAKE) || "all",
  sort: sessionStorage.getItem(STORAGE_KEYS.SORT) || "date-desc",
  currentPage: parseInt(sessionStorage.getItem(STORAGE_KEYS.PAGE) || "1", 10),
  itemsPerPage: 20
};

/**
 * Saves current table state to sessionStorage.
 */
export function saveState() {
  sessionStorage.setItem(STORAGE_KEYS.SEARCH, state.search);
  sessionStorage.setItem(STORAGE_KEYS.STATUS, state.statusFilter);
  sessionStorage.setItem(STORAGE_KEYS.MAKE, state.makeFilter);
  sessionStorage.setItem(STORAGE_KEYS.SORT, state.sort);
  sessionStorage.setItem(STORAGE_KEYS.PAGE, state.currentPage.toString());
}

/**
 * Helper element selector.
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * Initializes table event listeners and populates initial select choices.
 */
export function initVehicleTable() {
  const searchInput = $("vehicle-search");
  const statusFilter = $("vehicle-status-filter");
  const makeFilter = $("vehicle-make-filter");
  const sortSelect = $("vehicle-sort");

  const btnPrev = $("btn-prev-page");
  const btnNext = $("btn-next-page");

  // Populate input values from persisted state
  if (searchInput) searchInput.value = state.search;
  if (statusFilter) statusFilter.value = state.statusFilter;
  if (sortSelect) sortSelect.value = state.sort;

  // Render make choices from the actual vehicles
  populateMakeFilter();

  // Binds search change event (instant typing)
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value;
      state.currentPage = 1;
      saveState();
      renderVehicleTable();
    });
  }

  // Binds status filter change event
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      state.statusFilter = statusFilter.value;
      state.currentPage = 1;
      saveState();
      renderVehicleTable();
    });
  }

  // Binds make filter change event
  if (makeFilter) {
    makeFilter.addEventListener("change", () => {
      state.makeFilter = makeFilter.value;
      state.currentPage = 1;
      saveState();
      renderVehicleTable();
    });
  }

  // Binds sort select change event
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      state.currentPage = 1;
      saveState();
      renderVehicleTable();
    });
  }

  // Binds pagination button click events
  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        saveState();
        renderVehicleTable();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      state.currentPage++;
      saveState();
      renderVehicleTable();
    });
  }

  // Binds clickable table headers for instant sort
  const sortableHeaders = document.querySelectorAll(".inventory-table th.sortable");
  sortableHeaders.forEach(th => {
    th.addEventListener("click", () => {
      const sortKey = th.getAttribute("data-sort");
      if (sortKey) {
        handleHeaderClick(sortKey);
      }
    });
  });

  // Render initial table contents
  renderVehicleTable();
}

/**
 * Handles column header click and toggles sorting direction.
 * @param {string} sortKey - The column sort key
 */
function handleHeaderClick(sortKey) {
  const [currentField, currentDir] = state.sort.split("-");
  let nextDir = "asc";

  if (currentField === sortKey) {
    nextDir = currentDir === "asc" ? "desc" : "asc";
  } else {
    // Sensible defaults depending on target column type
    nextDir = (sortKey === "price" || sortKey === "year" || sortKey === "date") ? "desc" : "asc";
  }

  state.sort = `${sortKey}-${nextDir}`;
  state.currentPage = 1;
  saveState();

  // Sync sort select dropdown input UI
  const sortSelect = $("vehicle-sort");
  if (sortSelect) {
    sortSelect.value = state.sort;
  }

  renderVehicleTable();
}

/**
 * Dynamically builds list of unique makes based on active inventory.
 */
export function populateMakeFilter() {
  const select = $("vehicle-make-filter");
  if (!select) return;

  const vehicles = getAllVehicles();
  const makes = Array.from(new Set(vehicles.map(v => v.make).filter(Boolean))).sort();

  // Preserve selected value if it's still available
  const previousSelection = state.makeFilter;

  select.innerHTML = '<option value="all">All Makes</option>';
  makes.forEach(make => {
    const option = document.createElement("option");
    option.value = make.toLowerCase();
    option.textContent = make;
    if (make.toLowerCase() === previousSelection.toLowerCase()) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

/**
 * Filters the base vehicle array based on search text and select filters.
 * @param {Array} vehicles - The unfiltered vehicle list
 * @returns {Array} Filtered list of vehicles
 */
function getFilteredVehicles(vehicles) {
  const keyword = state.search.trim().toLowerCase();
  const statusF = state.statusFilter.toLowerCase();
  const makeF = state.makeFilter.toLowerCase();

  return vehicles.filter(v => {
    // 1. Keyword search check
    const matchesSearch = !keyword || [
      v.stockNumber,
      v.make,
      v.model,
      v.grade,
      v.year,
      v.chassisNumber
    ].some(field => field && String(field).toLowerCase().includes(keyword));

    if (!matchesSearch) return false;

    // 2. Status filter check
    if (statusF !== "all") {
      const vStatus = (v.status || "").toLowerCase();
      if (statusF === "reserved") {
        if (vStatus !== "reserved" && vStatus !== "pending") {
          return false;
        }
      } else {
        if (vStatus !== statusF) return false;
      }
    }

    // 3. Make filter check
    if (makeF !== "all") {
      const vMake = (v.make || "").toLowerCase();
      if (vMake !== makeF) return false;
    }

    return true;
  });
}

/**
 * Sorts the filtered list based on current active sort configuration.
 * @param {Array} vehicles - The filtered list to sort
 * @returns {Array} Sorted list of vehicles
 */
function getSortedVehicles(vehicles) {
  const [field, direction] = state.sort.split("-");
  const isAsc = direction === "asc";

  return vehicles.sort((a, b) => {
    let valA, valB;

    if (field === "stock") {
      valA = (a.stockNumber || "").toString().toLowerCase();
      valB = (b.stockNumber || "").toString().toLowerCase();
    } else if (field === "year") {
      valA = a.year || 0;
      valB = b.year || 0;
    } else if (field === "price") {
      valA = a.price || 0;
      valB = b.price || 0;
    } else if (field === "date") {
      valA = new Date(a.createdAt || 0).getTime();
      valB = new Date(b.createdAt || 0).getTime();
    } else {
      return 0;
    }

    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });
}

/**
 * Displays or updates header visual classes and up/down indicator arrows.
 */
function updateHeaderUI() {
  const [field, direction] = state.sort.split("-");
  const headers = document.querySelectorAll(".inventory-table th.sortable");

  headers.forEach(th => {
    th.classList.remove("sorted-asc", "sorted-desc");
    const sortKey = th.getAttribute("data-sort");
    const indicator = th.querySelector(".sort-indicator");

    if (sortKey === field) {
      th.classList.add(direction === "asc" ? "sorted-asc" : "sorted-desc");
      if (indicator) {
        indicator.innerHTML = direction === "asc" ? " ▲" : " ▼";
      }
    } else {
      if (indicator) {
        indicator.innerHTML = " ↕";
      }
    }
  });
}

/**
 * Fetches, filters, sorts, paginates, and renders vehicles in the table.
 */
export function renderVehicleTable() {
  const tableBody = $("vehicle-table-body");
  const emptyState = $("vehicle-empty-state");
  const paginationRow = $("vehicle-pagination");

  if (!tableBody) return;

  // Update sorted header indicators
  updateHeaderUI();

  // Get active raw data
  const rawVehicles = getAllVehicles();

  // Apply filters
  const filtered = getFilteredVehicles(rawVehicles);

  // Apply sorting
  const sorted = getSortedVehicles(filtered);

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / state.itemsPerPage) || 1;

  // Safe boundary check for current page
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
    saveState();
  }
  if (state.currentPage < 1) {
    state.currentPage = 1;
    saveState();
  }

  // Paginate list
  const startIdx = (state.currentPage - 1) * state.itemsPerPage;
  const paginated = sorted.slice(startIdx, startIdx + state.itemsPerPage);

  // Clean current rows
  tableBody.innerHTML = "";

  if (totalItems === 0) {
    if (emptyState) emptyState.style.display = "flex";
    if (paginationRow) paginationRow.style.display = "none";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (paginationRow) paginationRow.style.display = "flex";

  // Render paginated subset of rows
  paginated.forEach(v => {
    const row = document.createElement("tr");
    row.id = `vehicle-row-${v.id}`;

    const formattedPrice = new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: v.currency || "BDT",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(v.price).replace("BDT", "৳").replace("USD", "$").replace("JPY", "¥");

    let statusStyle = "";
    if (v.status === "available") {
      statusStyle = "background-color: rgba(37, 211, 102, 0.08); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.2);";
    } else if (v.status === "incoming") {
      statusStyle = "background-color: rgba(227, 27, 35, 0.08); color: #e31b23; border: 1px solid rgba(227, 27, 35, 0.2);";
    } else if (v.status === "reserved" || v.status === "pending") {
      statusStyle = "background-color: rgba(249, 115, 22, 0.08); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.2);";
    } else if (v.status === "sold") {
      statusStyle = "background-color: rgba(15, 23, 42, 0.08); color: #0f172a; border: 1px solid rgba(15, 23, 42, 0.2);";
    }

    const thumbnailSrc = v.coverImage || v.posterImage || (v.images && v.images[0]) || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800";
    const vehicleName = `${v.year} ${v.make} ${v.model} ${v.grade ? `(${v.grade})` : ""}`.trim();

    row.innerHTML = `
      <td>
        <img src="${thumbnailSrc}" alt="${v.make} ${v.model}" class="thumb-img" referrerpolicy="no-referrer" data-id="${v.id}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800';">
      </td>
      <td style="font-weight: 700; font-family: var(--font-mono); font-size: 0.85rem;">${v.stockNumber}</td>
      <td style="font-weight: 600; font-family: var(--font-display);">${vehicleName}</td>
      <td style="font-weight: 700; color: var(--primary-blue); font-family: var(--font-mono);">${formattedPrice}</td>
      <td>
        <span class="badge" style="padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; display: inline-block; ${statusStyle}">
          ${v.status === "pending" ? "reserved" : v.status}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-action-edit" data-id="${v.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            Edit
          </button>
          <button class="btn-action-delete" data-id="${v.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Delete
          </button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });

  // Update pagination indicators and buttons
  updatePaginationDOM(totalItems, totalPages);
}

/**
 * Updates UI pagination info and disables/enables navigation buttons.
 */
function updatePaginationDOM(totalItems, totalPages) {
  const paginationInfo = $("pagination-info");
  const currentPageSpan = $("pagination-current-page");
  const btnPrev = $("btn-prev-page");
  const btnNext = $("btn-next-page");

  if (paginationInfo) {
    const startItem = totalItems === 0 ? 0 : (state.currentPage - 1) * state.itemsPerPage + 1;
    const endItem = Math.min(state.currentPage * state.itemsPerPage, totalItems);
    paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} vehicles`;
  }

  if (currentPageSpan) {
    currentPageSpan.textContent = `Page ${state.currentPage} of ${totalPages}`;
  }

  if (btnPrev) {
    btnPrev.disabled = state.currentPage <= 1;
  }

  if (btnNext) {
    btnNext.disabled = state.currentPage >= totalPages;
  }
}

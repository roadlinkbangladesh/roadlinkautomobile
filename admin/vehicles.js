/**
 * Roadlink Automobiles - Vehicle Inventory Management
 * Handles Phase 1 of vehicle list display, in-memory searches, adding/editing, and deleting vehicles.
 */

import { getAllVehicles, addVehicle, updateVehicle, deleteVehicle } from "../js/inventory.js";
import { $ } from "./utils.js";
import { initDashboard } from "./dashboard.js";
import { initVehicleTable, renderVehicleTable, populateMakeFilter, state as tableState, saveState as saveTableState } from "./vehicle-table.js";

// Currently active vehicle ID (null for adding, ID string for editing)
let currentVehicleId = null;
// Active vehicle ID marked for deletion
let deleteVehicleId = null;
// In-memory arrays of base64/URL images for the active vehicle
let activeExteriorImages = [];
let activeInteriorImages = [];

/**
 * Initializes the Vehicles management view panel.
 */
export function initVehiclesView() {
  initVehicleTable();
  bindVehicleEvents();
}

/**
 * Binds DOM event listeners for search filtering, adding, editing, deleting and images.
 */
export function bindVehicleEvents() {
  const searchInput = $("vehicle-search");
  const btnAddVehicle = $("btn-add-vehicle");
  const btnCloseModal = $("btn-close-vehicle-modal");
  const btnCancelModal = $("btn-cancel-vehicle-modal");
  const vehicleForm = $("vehicle-form");
  
  const btnConfirmDelete = $("btn-confirm-delete");
  const btnCancelDelete = $("btn-cancel-delete");

  // Local Image Upload triggers
  const btnSelectExtImages = $("btn-select-ext-images");
  const extImagesFileInput = $("v-ext-images-input");
  const btnSelectIntImages = $("btn-select-int-images");
  const intImagesFileInput = $("v-int-images-input");

  // Larger preview modal triggers
  const btnClosePreviewModal = $("btn-close-preview-modal");

  // Open modal for adding
  if (btnAddVehicle) {
    btnAddVehicle.removeEventListener("click", handleAddClick);
    btnAddVehicle.addEventListener("click", handleAddClick);
  }

  // Close modal
  if (btnCloseModal) {
    btnCloseModal.removeEventListener("click", closeVehicleModal);
    btnCloseModal.addEventListener("click", closeVehicleModal);
  }
  if (btnCancelModal) {
    btnCancelModal.removeEventListener("click", closeVehicleModal);
    btnCancelModal.addEventListener("click", closeVehicleModal);
  }

  // Save vehicle (Add or Edit)
  if (vehicleForm) {
    vehicleForm.removeEventListener("submit", handleFormSubmit);
    vehicleForm.addEventListener("submit", handleFormSubmit);
  }

  // Bind dynamic event delegation for Edit/Delete/Thumbnail actions in the table body
  const tableBody = $("vehicle-table-body");
  if (tableBody) {
    tableBody.removeEventListener("click", handleTableActions);
    tableBody.addEventListener("click", handleTableActions);
  }

  // Delete modals actions
  if (btnConfirmDelete) {
    btnConfirmDelete.removeEventListener("click", confirmDeleteVehicle);
    btnConfirmDelete.addEventListener("click", confirmDeleteVehicle);
  }
  if (btnCancelDelete) {
    btnCancelDelete.removeEventListener("click", closeDeleteModal);
    btnCancelDelete.addEventListener("click", closeDeleteModal);
  }

  // Local Images Events
  if (btnSelectExtImages) {
    btnSelectExtImages.removeEventListener("click", handleSelectExtImages);
    btnSelectExtImages.addEventListener("click", handleSelectExtImages);
  }
  if (extImagesFileInput) {
    extImagesFileInput.removeEventListener("change", handleExtImagesFileChange);
    extImagesFileInput.addEventListener("change", handleExtImagesFileChange);
  }
  if (btnSelectIntImages) {
    btnSelectIntImages.removeEventListener("click", handleSelectIntImages);
    btnSelectIntImages.addEventListener("click", handleSelectIntImages);
  }
  if (intImagesFileInput) {
    intImagesFileInput.removeEventListener("change", handleIntImagesFileChange);
    intImagesFileInput.addEventListener("change", handleIntImagesFileChange);
  }

  // Large Preview Close Event
  if (btnClosePreviewModal) {
    btnClosePreviewModal.removeEventListener("click", closeImagePreviewModal);
    btnClosePreviewModal.addEventListener("click", closeImagePreviewModal);
  }
}

/**
 * Click handler for the Add Vehicle button.
 */
function handleAddClick() {
  openVehicleModal();
}

/**
 * Event delegation handler for actions (Edit, Delete, Thumbnail zoom) in the table body.
 */
function handleTableActions(e) {
  const thumbImg = e.target.closest(".thumb-img");
  const editBtn = e.target.closest(".btn-action-edit");
  const deleteBtn = e.target.closest(".btn-action-delete");

  if (thumbImg) {
    const vehicleId = thumbImg.getAttribute("data-id");
    openImagePreviewModal(vehicleId);
  } else if (editBtn) {
    const vehicleId = editBtn.getAttribute("data-id");
    openVehicleModal(vehicleId);
  } else if (deleteBtn) {
    const vehicleId = deleteBtn.getAttribute("data-id");
    openDeleteConfirmation(vehicleId);
  }
}

// (filterVehicles removed, now handled by vehicle-table.js)

/**
 * Opens the vehicle form modal (Edit mode if vehicleId is provided, else Add mode).
 * @param {string} vehicleId - Optional ID of vehicle to edit
 */
export function openVehicleModal(vehicleId = null) {
  currentVehicleId = vehicleId;
  const modal = $("vehicle-modal");
  const modalTitle = $("vehicle-modal-title");
  const form = $("vehicle-form");
  const validationError = $("v-validation-error");

  if (!modal || !form) return;

  // Reset validation state
  if (validationError) {
    validationError.style.display = "none";
    validationError.textContent = "Please fill out all required (*) fields.";
  }
  form.reset();

  // Reset visual border states of input fields
  form.querySelectorAll("input, select, textarea").forEach(el => {
    el.style.borderColor = "var(--border-color)";
  });

  if (vehicleId) {
    // Edit mode
    if (modalTitle) modalTitle.textContent = "Edit Vehicle";
    const vehicle = getAllVehicles().find(v => v.id === vehicleId);
    if (vehicle) {
      // Populates the fields
      populateField("stockNumber", vehicle.stockNumber);
      populateField("make", vehicle.make);
      populateField("model", vehicle.model);
      populateField("grade", vehicle.grade || "");
      populateField("year", vehicle.year);
      populateField("chassisNumber", vehicle.chassisNumber || "");
      populateField("registration", vehicle.registration || "");
      
      populateField("mileage", vehicle.mileage !== undefined ? vehicle.mileage : "");
      populateField("engineCC", vehicle.engineCC !== undefined ? vehicle.engineCC : "");
      populateField("transmission", vehicle.transmission || "");
      populateField("fuel", vehicle.fuel || "");
      populateField("drive", vehicle.drive || "");
      populateField("exteriorColor", vehicle.exteriorColor || "");
      populateField("interiorColor", vehicle.interiorColor || "");
      populateField("steering", vehicle.steering || "");
      populateField("doors", vehicle.doors !== undefined ? vehicle.doors : "");
      populateField("seats", vehicle.seats !== undefined ? vehicle.seats : "");

      populateField("purchasePrice", vehicle.purchasePrice !== undefined ? vehicle.purchasePrice : "");
      populateField("price", vehicle.price);
      populateField("currency", vehicle.currency || "BDT");

      populateField("status", vehicle.status);
      populateField("description", vehicle.description || "");

      // Newly synced public website fields
      populateField("bodyType", vehicle.bodyType || "");
      populateField("featured", !!vehicle.featured);
      populateField("published", vehicle.published !== false);
      populateField("negotiable", !!vehicle.negotiable);
      populateField("arrivalDate", vehicle.arrivalDate || "");
      populateField("accidentHistory", vehicle.accidentHistory || "");
      populateField("shortDescription", vehicle.shortDescription || "");
      populateField("youtubeUrl", vehicle.youtubeUrl || "");
      populateField("auctionSheetUrl", vehicle.auctionSheetUrl || "");
      populateField("auctionSheetAvailable", !!vehicle.auctionSheetAvailable);
      populateField("features", vehicle.features || []);

      // Populate Exterior Images array
      activeExteriorImages = [...(vehicle.exteriorImages || [])];
      // Fallback: if exteriorImages is empty, use vehicle.images or coverImage
      if (activeExteriorImages.length === 0) {
        if (vehicle.images && vehicle.images.length > 0) {
          activeExteriorImages = [...vehicle.images];
        } else if (vehicle.coverImage || vehicle.posterImage) {
          activeExteriorImages = [vehicle.coverImage || vehicle.posterImage];
        }
      }
      
      // Populate Interior Images array
      activeInteriorImages = [...(vehicle.interiorImages || [])];
    }
  } else {
    // Add mode
    if (modalTitle) modalTitle.textContent = "Add Vehicle";
    activeExteriorImages = [];
    activeInteriorImages = [];
    populateField("published", true);
  }

  // Render previews
  renderImagePreviews();
  modal.style.display = "flex";

  // Auto scroll to top when opening (Request #3)
  modal.scrollTop = 0;
  const card = modal.querySelector(".modal-card");
  if (card) {
    card.scrollTop = 0;
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}

/**
 * Helper to safely populate form field by input name attribute.
 */
function populateField(fieldName, value) {
  const input = document.querySelector(`#vehicle-form [name="${fieldName}"]`);
  if (input) {
    if (input.type === "checkbox") {
      input.checked = !!value;
    } else if (Array.isArray(value)) {
      input.value = value.join(", ");
    } else {
      input.value = value;
    }
  }
}

/**
 * Closes the vehicle form modal.
 */
export function closeVehicleModal() {
  const modal = $("vehicle-modal");
  if (modal) {
    modal.style.display = "none";
  }
  currentVehicleId = null;
  activeExteriorImages = [];
  activeInteriorImages = [];
}

/**
 * Form submit handler for saving a vehicle.
 */
function handleFormSubmit(e) {
  e.preventDefault();
  const form = $("vehicle-form");
  const validationError = $("v-validation-error");
  if (!form) return;

  // Read field values
  const fields = [
    "stockNumber", "make", "model", "grade", "year", "chassisNumber", "registration",
    "mileage", "engineCC", "transmission", "fuel", "drive", "exteriorColor", "interiorColor",
    "steering", "doors", "seats", "purchasePrice", "price", "currency", "status", "description",
    "bodyType", "featured", "published", "negotiable", "arrivalDate", "accidentHistory", "shortDescription",
    "youtubeUrl", "auctionSheetUrl", "auctionSheetAvailable", "features"
  ];

  const data = {};
  fields.forEach(fieldName => {
    const input = form.querySelector(`[name="${fieldName}"]`);
    if (input) {
      if (input.type === "checkbox") {
        data[fieldName] = input.checked;
      } else {
        data[fieldName] = input.value.trim();
      }
    }
  });

  // Manual required field validation
  const requiredFields = ["stockNumber", "make", "model", "year", "price", "status"];
  let isValid = true;

  requiredFields.forEach(fieldName => {
    const input = form.querySelector(`[name="${fieldName}"]`);
    if (input) {
      let val = "";
      if (input.type === "checkbox") {
        val = input.checked ? "true" : "";
      } else {
        val = input.value.trim();
      }
      if (!val) {
        isValid = false;
        input.style.borderColor = "var(--primary-red)";
      } else {
        input.style.borderColor = "var(--border-color)";
      }
    }
  });

  if (!isValid) {
    if (validationError) {
      validationError.textContent = "Please fill out all required (*) fields.";
      validationError.style.display = "block";
    }
    return;
  }

  // Prevent duplicate Stock IDs
  const stockInput = form.querySelector('[name="stockNumber"]');
  const enteredStock = data.stockNumber.trim();
  const vehicles = getAllVehicles();
  const isDuplicate = vehicles.some(v => 
    v.stockNumber.trim().toUpperCase() === enteredStock.toUpperCase() && 
    v.id !== currentVehicleId
  );

  if (isDuplicate) {
    if (stockInput) stockInput.style.borderColor = "var(--primary-red)";
    if (validationError) {
      validationError.textContent = `Stock ID "${enteredStock}" already exists! Please use a unique Stock ID.`;
      validationError.style.display = "block";
    }
    return;
  }

  if (validationError) validationError.style.display = "none";

  // Parse numeric values safely
  const parsedYear = parseInt(data.year, 10);
  const parsedPrice = parseFloat(data.price);
  const parsedMileage = data.mileage ? parseInt(data.mileage, 10) : undefined;
  const parsedEngine = data.engineCC ? parseInt(data.engineCC, 10) : undefined;
  const parsedDoors = data.doors ? parseInt(data.doors, 10) : undefined;
  const parsedSeats = data.seats ? parseInt(data.seats, 10) : undefined;
  const parsedPurchasePrice = data.purchasePrice ? parseFloat(data.purchasePrice) : undefined;
  
  // Parse comma-separated features into array
  const parsedFeatures = data.features ? data.features.split(",").map(f => f.trim()).filter(Boolean) : [];

  // The first exterior image becomes the cover/poster image
  const coverImg = activeExteriorImages[0] || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800";
  const combinedImages = [...activeExteriorImages, ...activeInteriorImages];

  if (currentVehicleId) {
    // Edit existing vehicle
    const updatedFields = {
      stockNumber: data.stockNumber,
      make: data.make,
      model: data.model,
      grade: data.grade || "",
      year: parsedYear,
      chassisNumber: data.chassisNumber || "",
      registration: data.registration || "",
      mileage: parsedMileage,
      engineCC: parsedEngine,
      transmission: data.transmission || "",
      fuel: data.fuel || "",
      drive: data.drive || "",
      exteriorColor: data.exteriorColor || "",
      interiorColor: data.interiorColor || "",
      steering: data.steering || "",
      doors: parsedDoors,
      seats: parsedSeats,
      purchasePrice: parsedPurchasePrice,
      price: parsedPrice,
      currency: data.currency || "BDT",
      status: data.status,
      description: data.description || "",
      bodyType: data.bodyType || "",
      featured: !!data.featured,
      published: !!data.published,
      negotiable: !!data.negotiable,
      arrivalDate: data.arrivalDate || "",
      accidentHistory: data.accidentHistory || "",
      shortDescription: data.shortDescription || "",
      youtubeUrl: data.youtubeUrl || "",
      auctionSheetUrl: data.auctionSheetUrl || "",
      auctionSheetAvailable: !!data.auctionSheetAvailable,
      features: parsedFeatures,
      images: combinedImages,
      exteriorImages: [...activeExteriorImages],
      interiorImages: [...activeInteriorImages],
      coverImage: coverImg,
      posterImage: coverImg
    };
    updateVehicle(currentVehicleId, updatedFields);
  } else {
    // Add new vehicle
    const newId = `${data.make.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${data.model.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newVehicle = {
      id: newId,
      displayOrder: (vehicles.length + 1) * 10,
      slug: `${data.make.toLowerCase()}-${data.model.toLowerCase()}-${parsedYear}`,
      stockNumber: data.stockNumber,
      featured: !!data.featured,
      status: data.status,
      make: data.make,
      model: data.model,
      grade: data.grade || "",
      year: parsedYear,
      chassisNumber: data.chassisNumber || "",
      registration: data.registration || "",
      mileage: parsedMileage,
      engineCC: parsedEngine,
      transmission: data.transmission || "",
      fuel: data.fuel || "",
      drive: data.drive || "",
      exteriorColor: data.exteriorColor || "",
      interiorColor: data.interiorColor || "",
      steering: data.steering || "",
      doors: parsedDoors,
      seats: parsedSeats,
      purchasePrice: parsedPurchasePrice,
      price: parsedPrice,
      currency: data.currency || "BDT",
      description: data.description || "",
      bodyType: data.bodyType || "",
      negotiable: !!data.negotiable,
      arrivalDate: data.arrivalDate || "",
      accidentHistory: data.accidentHistory || "",
      shortDescription: data.shortDescription || "",
      youtubeUrl: data.youtubeUrl || "",
      auctionSheetUrl: data.auctionSheetUrl || "",
      auctionSheetAvailable: !!data.auctionSheetAvailable,
      published: !!data.published,
      features: parsedFeatures,
      images: combinedImages,
      exteriorImages: [...activeExteriorImages],
      interiorImages: [...activeInteriorImages],
      coverImage: coverImg,
      posterImage: coverImg,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    addVehicle(newVehicle);
  }

  // Reload current store data
  const freshVehicles = getAllVehicles();
  // Refresh table UI and dashboard statistics live
  const searchInput = $("vehicle-search");
  if (searchInput) searchInput.value = "";
  tableState.search = "";
  saveTableState();

  populateMakeFilter();
  renderVehicleTable();
  initDashboard(freshVehicles);
  closeVehicleModal();
}

/**
 * Opens delete confirmation modal.
 * @param {string} vehicleId - ID of vehicle to delete
 */
export function openDeleteConfirmation(vehicleId) {
  deleteVehicleId = vehicleId;
  const modal = $("delete-confirm-modal");
  if (modal) {
    modal.style.display = "flex";
  }
}

/**
 * Closes delete confirmation modal.
 */
export function closeDeleteModal() {
  const modal = $("delete-confirm-modal");
  if (modal) {
    modal.style.display = "none";
  }
  deleteVehicleId = null;
}

/**
 * Confirms deletion of active vehicle.
 */
function confirmDeleteVehicle() {
  if (!deleteVehicleId) return;

  deleteVehicle(deleteVehicleId);

  // Reload current store data
  const freshVehicles = getAllVehicles();
  // Refresh table UI and dashboard statistics live
  const searchInput = $("vehicle-search");
  if (searchInput) searchInput.value = "";
  tableState.search = "";
  saveTableState();

  populateMakeFilter();
  renderVehicleTable();
  initDashboard(freshVehicles);
  closeDeleteModal();
}

/**
 * Triggers exterior file selector click.
 */
function handleSelectExtImages() {
  const fileInput = $("v-ext-images-input");
  if (fileInput) {
    fileInput.click();
  }
}

/**
 * Triggers interior file selector click.
 */
function handleSelectIntImages() {
  const fileInput = $("v-int-images-input");
  if (fileInput) {
    fileInput.click();
  }
}

/**
 * Handles exterior image files selection and converts them to base64.
 */
function handleExtImagesFileChange(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  let loadedCount = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const base64Data = event.target.result;
      activeExteriorImages.push(base64Data);
      loadedCount++;
      if (loadedCount === files.length) {
        renderImagePreviews();
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Handles interior image files selection and converts them to base64.
 */
function handleIntImagesFileChange(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  let loadedCount = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const base64Data = event.target.result;
      activeInteriorImages.push(base64Data);
      loadedCount++;
      if (loadedCount === files.length) {
        renderImagePreviews();
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Renders the preview thumbnails for both Exterior and Interior categories.
 */
function renderImagePreviews() {
  renderSpecificPreviews("ext-image-preview-container", activeExteriorImages, true);
  renderSpecificPreviews("int-image-preview-container", activeInteriorImages, false);
}

/**
 * Helper to render image previews for a specific array and container.
 */
function renderSpecificPreviews(containerId, imageArray, isExterior) {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = "";

  if (imageArray.length === 0) {
    container.innerHTML = `<p class="view-subtitle" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 16px 0; margin: 0;">No images selected.</p>`;
    return;
  }

  imageArray.forEach((src, index) => {
    const isFirst = index === 0;
    const isLast = index === imageArray.length - 1;

    const card = document.createElement("div");
    card.className = `image-preview-card ${isExterior && isFirst ? "is-cover" : ""}`;

    card.innerHTML = `
      <img src="${src}" alt="Preview ${index + 1}" referrerpolicy="no-referrer">
      ${isExterior && isFirst ? `<span class="image-preview-badge">Cover</span>` : ""}
      <div class="image-preview-actions">
        <button type="button" class="btn-img-prev" data-index="${index}" ${isFirst ? "disabled" : ""} title="Move Left">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <button type="button" class="btn-img-next" data-index="${index}" ${isLast ? "disabled" : ""} title="Move Right">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
        <button type="button" class="btn-img-delete" data-index="${index}" title="Remove Image">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Bind click handlers inside the specific container
  container.querySelectorAll(".btn-img-prev").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
      const temp = imageArray[idx];
      imageArray[idx] = imageArray[idx - 1];
      imageArray[idx - 1] = temp;
      renderImagePreviews();
    });
  });

  container.querySelectorAll(".btn-img-next").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
      const temp = imageArray[idx];
      imageArray[idx] = imageArray[idx + 1];
      imageArray[idx + 1] = temp;
      renderImagePreviews();
    });
  });

  container.querySelectorAll(".btn-img-delete").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
      imageArray.splice(idx, 1);
      renderImagePreviews();
    });
  });
}

/**
 * Opens image preview modal for a large view of cover image.
 */
function openImagePreviewModal(vehicleId) {
  const vehicle = getAllVehicles().find(v => v.id === vehicleId);
  if (!vehicle) return;

  const modal = $("image-preview-modal");
  const imgEl = $("preview-modal-img");
  const titleEl = $("preview-modal-title");

  if (modal && imgEl) {
    const thumbnailSrc = vehicle.coverImage || vehicle.posterImage || (vehicle.images && vehicle.images[0]) || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800";
    imgEl.src = thumbnailSrc;
    imgEl.alt = `${vehicle.make} ${vehicle.model}`;
    if (titleEl) {
      titleEl.textContent = `${vehicle.year} ${vehicle.make} ${vehicle.model} - Cover Image`;
    }
    modal.style.display = "flex";
  }
}

/**
 * Closes image preview modal.
 */
function closeImagePreviewModal() {
  const modal = $("image-preview-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

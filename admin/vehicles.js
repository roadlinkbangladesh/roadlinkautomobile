/**
 * Roadlink Automobiles - Vehicle Inventory Management
 * Handles Phase 1 of vehicle list display, in-memory searches, adding/editing, and deleting vehicles.
 */

import { getAllVehicles, loadVehiclesAsync, addVehicleAsync, updateVehicleAsync, deleteVehicleAsync, updateVehicleStatusAsync, uploadFileAsync } from "../js/inventory.js";
import { $ } from "./utils.js";
import { hasPermission } from "./auth.js";
import { initDashboard } from "./dashboard.js";
import { initVehicleTable, renderVehicleTable, populateMakeFilter, state as tableState, saveState as saveTableState } from "./vehicle-table.js";

// Currently active vehicle ID (null for adding, ID string for editing)
let currentVehicleId = null;
// Active vehicle ID marked for status change
let statusChangeVehicleId = null;
// Active vehicle ID marked for deletion
let deleteVehicleId = null;
// In-memory arrays of base64/URL images for the active vehicle
let activeExteriorImages = [];
let activeInteriorImages = [];

let vehiclesEventsBound = false;

/**
 * Initializes the Vehicles management view panel.
 * @param {Object} query - Optional route query parameters e.g. { status: "available" }
 */
export async function initVehiclesView(query = {}) {
  await loadVehiclesAsync();
  initVehicleTable();

  if (query && query.status) {
    const statusVal = query.status.toLowerCase();
    tableState.statusFilter = statusVal;
    tableState.currentPage = 1;
    saveTableState();

    const statusFilterSelect = $("vehicle-status-filter");
    if (statusFilterSelect) {
      statusFilterSelect.value = statusVal;
    }
    renderVehicleTable();
  } else {
    // Sync input UI with tableState if statusFilter was set
    const statusFilterSelect = $("vehicle-status-filter");
    if (statusFilterSelect && statusFilterSelect.value !== tableState.statusFilter) {
      statusFilterSelect.value = tableState.statusFilter;
    }
  }
  
  const btnAdd = $("btn-add-vehicle");
  if (btnAdd) {
    btnAdd.style.display = hasPermission("vehicles.create") ? "inline-flex" : "none";
  }

  if (!vehiclesEventsBound) {
    bindVehicleEvents();
    vehiclesEventsBound = true;
  }
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

  const copySelect = $("copy-vehicle-select");
  if (copySelect) {
    copySelect.removeEventListener("change", handleCopySelectChange);
    copySelect.addEventListener("change", handleCopySelectChange);
  }

  // Bind dynamic event delegation for Edit/Delete/Thumbnail actions in the table body
  const tableBody = $("vehicle-table-body");
  if (tableBody) {
    tableBody.removeEventListener("click", handleTableActions);
    tableBody.addEventListener("click", handleTableActions);
  }

  // Change Status modal actions
  const btnCloseStatusModal = $("btn-close-status-modal");
  const btnCancelStatusModal = $("btn-cancel-status-modal");
  const statusChangeForm = $("status-change-form");

  if (btnCloseStatusModal) {
    btnCloseStatusModal.removeEventListener("click", closeStatusModal);
    btnCloseStatusModal.addEventListener("click", closeStatusModal);
  }
  if (btnCancelStatusModal) {
    btnCancelStatusModal.removeEventListener("click", closeStatusModal);
    btnCancelStatusModal.addEventListener("click", closeStatusModal);
  }
  if (statusChangeForm) {
    statusChangeForm.removeEventListener("submit", handleStatusFormSubmit);
    statusChangeForm.addEventListener("submit", handleStatusFormSubmit);
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

  // Close details modal
  const btnCloseDetailsModal = $("btn-close-details-modal");
  const btnCloseDetails = $("btn-close-details");
  if (btnCloseDetailsModal) {
    btnCloseDetailsModal.removeEventListener("click", closeVehicleDetailsModal);
    btnCloseDetailsModal.addEventListener("click", closeVehicleDetailsModal);
  }
  if (btnCloseDetails) {
    btnCloseDetails.removeEventListener("click", closeVehicleDetailsModal);
    btnCloseDetails.addEventListener("click", closeVehicleDetailsModal);
  }

  // Edit from details modal
  const btnDetailsEdit = $("btn-details-edit");
  if (btnDetailsEdit) {
    btnDetailsEdit.removeEventListener("click", handleDetailsEditClick);
    btnDetailsEdit.addEventListener("click", handleDetailsEditClick);
  }

  // Delete from details modal
  const btnDetailsDelete = $("btn-details-delete");
  if (btnDetailsDelete) {
    btnDetailsDelete.removeEventListener("click", handleDetailsDeleteClick);
    btnDetailsDelete.addEventListener("click", handleDetailsDeleteClick);
  }

  // Quick actions change listeners
  const quickStatusSelect = $("details-quick-status");
  if (quickStatusSelect) {
    quickStatusSelect.removeEventListener("change", handleQuickStatusChange);
    quickStatusSelect.addEventListener("change", handleQuickStatusChange);
  }
  const quickPublishSelect = $("details-quick-publish");
  if (quickPublishSelect) {
    quickPublishSelect.removeEventListener("change", handleQuickPublishChange);
    quickPublishSelect.addEventListener("change", handleQuickPublishChange);
  }
}

/**
 * Click handler for the Add Vehicle button.
 */
function handleAddClick() {
  if (!hasPermission("vehicles.create")) {
    alert("Access Denied. You do not have permission to add vehicles.");
    return;
  }
  openVehicleModal();
}

/**
 * Event delegation handler for actions (Edit, Delete, Thumbnail zoom) in the table body.
 */
function handleTableActions(e) {
  const thumbImg = e.target.closest(".thumb-img");
  const viewBtn = e.target.closest(".btn-action-view");
  const editBtn = e.target.closest(".btn-action-edit");
  const deleteBtn = e.target.closest(".btn-action-delete");
  const statusBtn = e.target.closest(".btn-action-status");

  if (thumbImg) {
    const vehicleId = thumbImg.getAttribute("data-id");
    openVehicleDetailsModal(vehicleId);
  } else if (viewBtn) {
    const vehicleId = viewBtn.getAttribute("data-id");
    openVehicleDetailsModal(vehicleId);
  } else if (editBtn) {
    if (!hasPermission("vehicles.edit")) {
      alert("Access Denied. You do not have permission to edit vehicles.");
      return;
    }
    const vehicleId = editBtn.getAttribute("data-id");
    openVehicleModal(vehicleId);
  } else if (deleteBtn) {
    if (!hasPermission("vehicles.delete")) {
      alert("Access Denied. You do not have permission to delete vehicles.");
      return;
    }
    const vehicleId = deleteBtn.getAttribute("data-id");
    openDeleteConfirmation(vehicleId);
  } else if (statusBtn) {
    const vehicleId = statusBtn.getAttribute("data-id");
    openStatusModal(vehicleId);
  }
}

/**
 * Handles inline vehicle status select box change events.
 */
async function handleTableStatusChange(e) {
  const statusSelect = e.target.closest(".status-select-inline");
  if (statusSelect) {
    if (!hasPermission("vehicles.edit")) {
      alert("Access Denied. You do not have permission to change vehicle status.");
      renderVehicleTable();
      return;
    }
    const vehicleId = statusSelect.getAttribute("data-id");
    const newStatus = statusSelect.value;
    try {
      await updateVehicleStatusAsync(vehicleId, { status: newStatus });
      renderVehicleTable();
      initDashboard();
    } catch (err) {
      alert("Error updating status: " + err.message);
      renderVehicleTable();
    }
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

  // Handle Copy parameters dropdown visibility and options
  const copyContainer = $("copy-vehicle-container");
  const copySelect = $("copy-vehicle-select");
  if (copyContainer) {
    copyContainer.style.display = vehicleId ? "none" : "block";
  }
  if (copySelect && !vehicleId) {
    copySelect.innerHTML = '<option value="">-- Choose a vehicle to copy from --</option>';
    const vehicles = getAllVehicles();
    vehicles.forEach(v => {
      const option = document.createElement("option");
      option.value = v.id;
      option.textContent = `[${v.stockNumber}] ${v.year} ${v.make} ${v.model} (${v.price} BDT)`;
      copySelect.appendChild(option);
    });
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
 * Handles copy vehicle select dropdown changes.
 */
function handleCopySelectChange(e) {
  const selectedId = e.target.value;
  if (!selectedId) return;
  const vehicle = getAllVehicles().find(v => v.id === selectedId);
  if (vehicle) {
    copyVehicleParams(vehicle);
  }
}

/**
 * Copies parameters from a source vehicle to the form inputs.
 */
function copyVehicleParams(vehicle) {
  if (!vehicle) return;
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
  if (activeExteriorImages.length === 0) {
    if (vehicle.images && vehicle.images.length > 0) {
      activeExteriorImages = [...vehicle.images];
    } else if (vehicle.coverImage || vehicle.posterImage) {
      activeExteriorImages = [vehicle.coverImage || vehicle.posterImage];
    }
  }
  
  // Populate Interior Images array
  activeInteriorImages = [...(vehicle.interiorImages || [])];
  
  // Re-render preview lists
  renderImagePreviews();
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
    try {
      await updateVehicleAsync(currentVehicleId, updatedFields);
    } catch (err) {
      alert("Error updating vehicle: " + err.message);
      return;
    }
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
    try {
      await addVehicleAsync(newVehicle);
    } catch (err) {
      alert("Error adding vehicle: " + err.message);
      return;
    }
  }

  // Reload current store data
  const freshVehicles = await loadVehiclesAsync();
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
async function confirmDeleteVehicle() {
  if (!deleteVehicleId) return;

  if (!hasPermission("vehicles.delete")) {
    alert("Access Denied. You do not have permission to delete vehicles.");
    return;
  }

  try {
    await deleteVehicleAsync(deleteVehicleId);
  } catch (err) {
    alert("Error deleting vehicle: " + err.message);
    return;
  }

  // Reload current store data
  const freshVehicles = await loadVehiclesAsync();
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
 * Handles exterior image files selection and uploads them to R2.
 */
async function handleExtImagesFileChange(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  for (const file of files) {
    try {
      const uploaded = await uploadFileAsync(file);
      if (uploaded && uploaded.url) {
        activeExteriorImages.push(uploaded.url);
      }
    } catch (err) {
      console.error("Failed to upload exterior image:", err);
      // Fallback to base64 if R2 upload fails
      const reader = new FileReader();
      reader.onload = function(event) {
        activeExteriorImages.push(event.target.result);
        renderImagePreviews();
      };
      reader.readAsDataURL(file);
    }
  }
  renderImagePreviews();
  e.target.value = "";
}

/**
 * Handles interior image files selection and uploads them to R2.
 */
async function handleIntImagesFileChange(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  for (const file of files) {
    try {
      const uploaded = await uploadFileAsync(file);
      if (uploaded && uploaded.url) {
        activeInteriorImages.push(uploaded.url);
      }
    } catch (err) {
      console.error("Failed to upload interior image:", err);
      const reader = new FileReader();
      reader.onload = function(event) {
        activeInteriorImages.push(event.target.result);
        renderImagePreviews();
      };
      reader.readAsDataURL(file);
    }
  }
  renderImagePreviews();
  e.target.value = "";
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

/**
 * Opens vehicle status change modal.
 */
function openStatusModal(vehicleId) {
  statusChangeVehicleId = vehicleId;
  const vehicle = getAllVehicles().find(v => v.id === vehicleId);
  if (!vehicle) return;

  const modal = $("status-change-modal");
  const nameLabel = $("status-modal-vehicle-name");
  const selectStatus = $("status-modal-select");
  const selectPublish = $("status-modal-publish");
  const editHint = $("status-modal-edit-hint");
  const publishHint = $("status-modal-publish-hint");

  if (nameLabel) {
    nameLabel.textContent = `${vehicle.year} ${vehicle.make} ${vehicle.model} (Stock: ${vehicle.stockNumber})`;
  }

  const canEdit = hasPermission("vehicles.edit");
  const canPublish = hasPermission("vehicles.publish");

  if (selectStatus) {
    selectStatus.value = vehicle.status || "available";
    selectStatus.disabled = !canEdit;
  }
  if (editHint) {
    editHint.style.display = canEdit ? "none" : "block";
  }

  if (selectPublish) {
    const isPublished = vehicle.published !== false && vehicle.isPublished !== false;
    selectPublish.value = isPublished ? "published" : "draft";
    selectPublish.disabled = !canPublish;
  }
  if (publishHint) {
    publishHint.style.display = canPublish ? "none" : "block";
  }

  const btnSave = $("btn-save-status-modal");
  if (btnSave) {
    btnSave.disabled = !canEdit && !canPublish;
  }

  if (modal) {
    modal.style.display = "flex";
  }
}

/**
 * Closes vehicle status change modal.
 */
function closeStatusModal() {
  statusChangeVehicleId = null;
  const modal = $("status-change-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

/**
 * Handles saving changes from the status change modal.
 */
async function handleStatusFormSubmit(e) {
  e.preventDefault();
  if (!statusChangeVehicleId) return;

  const vehicle = getAllVehicles().find(v => v.id === statusChangeVehicleId);
  if (!vehicle) return;

  const selectStatus = $("status-modal-select");
  const selectPublish = $("status-modal-publish");

  const canEdit = hasPermission("vehicles.edit");
  const canPublish = hasPermission("vehicles.publish");

  const updatedFields = {};

  if (canEdit && selectStatus) {
    updatedFields.status = selectStatus.value;
  }

  if (canPublish && selectPublish) {
    const pubValue = selectPublish.value === "published";
    updatedFields.published = pubValue;
    updatedFields.isPublished = pubValue;
  }

  if (Object.keys(updatedFields).length > 0) {
    try {
      await updateVehicleStatusAsync(statusChangeVehicleId, updatedFields);
      renderVehicleTable();
      initDashboard(); // Update dashboard metric counts!
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  }

  closeStatusModal();
}

/**
 * --- READ-ONLY VEHICLE DETAILS MODAL LOGIC ---
 */
let activeDetailsVehicleId = null;

/**
 * Opens and renders the details modal for a vehicle in read-only mode.
 */
export function openVehicleDetailsModal(vehicleId) {
  if (!hasPermission("vehicles.view")) {
    alert("Access Denied. You do not have permission to view vehicle details.");
    return;
  }

  const vehicle = getAllVehicles().find(v => v.id === vehicleId);
  if (!vehicle) return;

  activeDetailsVehicleId = vehicleId;

  const modal = $("vehicle-details-modal");
  if (!modal) return;

  // Render Title
  const titleEl = $("details-modal-title");
  if (titleEl) {
    titleEl.textContent = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.grade ? `(${vehicle.grade})` : ""}`.trim();
  }

  // Render Badges
  updateDetailsModalBadges(vehicle);

  // Render Cover image / main image
  const mainImg = $("details-modal-main-img");
  const coverSrc = vehicle.coverImage || vehicle.posterImage || (vehicle.images && vehicle.images[0]) || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800";
  if (mainImg) {
    mainImg.src = coverSrc;
  }

  // Render Thumbnails Strip
  const thumbnailsEl = $("details-modal-thumbnails");
  if (thumbnailsEl) {
    thumbnailsEl.innerHTML = "";

    // Gather all unique images
    const allImages = [];
    if (vehicle.coverImage) allImages.push(vehicle.coverImage);
    if (vehicle.posterImage) allImages.push(vehicle.posterImage);
    if (Array.isArray(vehicle.images)) {
      vehicle.images.forEach(img => { if (img) allImages.push(img); });
    }
    if (Array.isArray(vehicle.exteriorImages)) {
      vehicle.exteriorImages.forEach(img => { if (img) allImages.push(img); });
    }
    if (Array.isArray(vehicle.interiorImages)) {
      vehicle.interiorImages.forEach(img => { if (img) allImages.push(img); });
    }

    const uniqueImages = Array.from(new Set(allImages)).filter(Boolean);

    if (uniqueImages.length > 1) {
      uniqueImages.forEach((imgSrc) => {
        const thumb = document.createElement("img");
        thumb.src = imgSrc;
        thumb.referrerPolicy = "no-referrer";
        thumb.style.cssText = "width: 64px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 2px solid var(--border-color); cursor: pointer; flex-shrink: 0; transition: border-color 0.2s;";
        if (imgSrc === coverSrc) {
          thumb.style.borderColor = "var(--primary-blue)";
        }
        thumb.onerror = function() {
          this.onerror = null;
          this.src = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800";
        };
        thumb.addEventListener("click", () => {
          if (mainImg) mainImg.src = imgSrc;
          thumbnailsEl.querySelectorAll("img").forEach(t => t.style.borderColor = "var(--border-color)");
          thumb.style.borderColor = "var(--primary-blue)";
        });
        thumbnailsEl.appendChild(thumb);
      });
      thumbnailsEl.style.display = "flex";
    } else {
      thumbnailsEl.style.display = "none";
    }
  }

  // Specifications
  const specsContainer = $("details-specs-container");
  if (specsContainer) {
    specsContainer.innerHTML = "";

    const hasEditOrDelete = hasPermission("vehicles.edit") || hasPermission("vehicles.create") || hasPermission("vehicles.delete");

    const specsList = [
      { label: "Stock ID", val: vehicle.stockNumber },
      { label: "Chassis No.", val: vehicle.chassisNumber || "N/A" },
      { label: "Registration", val: vehicle.registration || "N/A" },
      { label: "Year", val: vehicle.year },
      { label: "Mileage", val: vehicle.mileage !== undefined && vehicle.mileage !== "" ? `${vehicle.mileage.toLocaleString()} km` : "N/A" },
      { label: "Engine CC", val: vehicle.engineCC !== undefined && vehicle.engineCC !== "" ? `${vehicle.engineCC} cc` : "N/A" },
      { label: "Transmission", val: vehicle.transmission || "N/A" },
      { label: "Fuel Type", val: vehicle.fuel || "N/A" },
      { label: "Drive Type", val: vehicle.drive || "N/A" },
      { label: "Body Type", val: vehicle.bodyType || "N/A" },
      { label: "Exterior Color", val: vehicle.exteriorColor || "N/A" },
      { label: "Interior Color", val: vehicle.interiorColor || "N/A" },
      { label: "Steering", val: vehicle.steering || "N/A" },
      { label: "Doors", val: vehicle.doors || "N/A" },
      { label: "Seats", val: vehicle.seats || "N/A" },
      { label: "Arrival Date", val: vehicle.arrivalDate || "N/A" },
      { label: "Accident History", val: vehicle.accidentHistory || "N/A" },
      { 
        label: "Sale Price", 
        val: `${new Intl.NumberFormat('en-BD', { style: 'currency', currency: vehicle.currency || 'BDT', minimumFractionDigits: 0 }).format(vehicle.price).replace("BDT", "৳").replace("USD", "$").replace("JPY", "¥")}` 
      }
    ];

    if (hasEditOrDelete) {
      specsList.push({
        label: "Purchase Price",
        val: vehicle.purchasePrice !== undefined && vehicle.purchasePrice !== "" ? `${new Intl.NumberFormat('en-BD', { style: 'currency', currency: vehicle.currency || 'BDT', minimumFractionDigits: 0 }).format(vehicle.purchasePrice).replace("BDT", "৳").replace("USD", "$").replace("JPY", "¥")}` : "N/A",
        highlight: true
      });
    }

    specsList.forEach(item => {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
      
      const labelSpan = document.createElement("span");
      labelSpan.style.cssText = "font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;";
      labelSpan.textContent = item.label;

      const valSpan = document.createElement("span");
      valSpan.style.cssText = "font-size: 0.85rem; font-weight: 600; color: var(--text-dark);";
      valSpan.textContent = item.val;

      if (item.highlight) {
        valSpan.style.color = "var(--primary-red)";
      }

      row.appendChild(labelSpan);
      row.appendChild(valSpan);
      specsContainer.appendChild(row);
    });
  }

  // Features
  const featuresSection = $("details-features-section");
  const featuresContainer = $("details-features-container");
  if (featuresSection && featuresContainer) {
    if (Array.isArray(vehicle.features) && vehicle.features.length > 0) {
      featuresSection.style.display = "block";
      featuresContainer.innerHTML = "";
      vehicle.features.forEach(feat => {
        const chip = document.createElement("span");
        chip.style.cssText = "padding: 4px 10px; background: rgba(27, 54, 93, 0.05); color: var(--primary-blue); font-size: 0.75rem; font-weight: 600; border-radius: var(--radius-sm); border: 1px solid rgba(27, 54, 93, 0.1);";
        chip.textContent = feat;
        featuresContainer.appendChild(chip);
      });
    } else {
      featuresSection.style.display = "none";
    }
  }

  // Short description
  const shortDescSection = $("details-short-desc-container");
  const shortDescText = $("details-modal-short-desc");
  if (shortDescSection && shortDescText) {
    if (vehicle.shortDescription) {
      shortDescSection.style.display = "block";
      shortDescText.textContent = vehicle.shortDescription;
    } else {
      shortDescSection.style.display = "none";
    }
  }

  // Full description
  const descSection = $("details-desc-container");
  const descText = $("details-modal-desc");
  if (descSection && descText) {
    if (vehicle.description) {
      descSection.style.display = "block";
      descText.textContent = vehicle.description;
    } else {
      descSection.style.display = "none";
    }
  }

  // Quick Actions / Status controls
  const actionsPanel = $("details-actions-panel");
  const statusCtrl = $("details-status-control");
  const publishCtrl = $("details-publish-control");
  const quickStatusSelect = $("details-quick-status");
  const quickPublishSelect = $("details-quick-publish");

  const canEdit = hasPermission("vehicles.edit");
  const canPublish = hasPermission("vehicles.publish");

  if (actionsPanel) {
    if (canEdit || canPublish) {
      actionsPanel.style.display = "flex";

      if (canEdit && statusCtrl && quickStatusSelect) {
        statusCtrl.style.display = "flex";
        quickStatusSelect.value = vehicle.status;
      } else if (statusCtrl) {
        statusCtrl.style.display = "none";
      }

      if (canPublish && publishCtrl && quickPublishSelect) {
        publishCtrl.style.display = "flex";
        quickPublishSelect.value = vehicle.published !== false ? "published" : "draft";
      } else if (publishCtrl) {
        publishCtrl.style.display = "none";
      }
    } else {
      actionsPanel.style.display = "none";
    }
  }

  // Footer Buttons
  const editBtn = $("btn-details-edit");
  const deleteBtn = $("btn-details-delete");

  if (editBtn) {
    editBtn.style.display = canEdit ? "inline-flex" : "none";
  }
  if (deleteBtn) {
    deleteBtn.style.display = hasPermission("vehicles.delete") ? "inline-flex" : "none";
  }

  modal.style.display = "flex";
  modal.scrollTop = 0;
}

/**
 * Closes the details modal and resets state.
 */
export function closeVehicleDetailsModal() {
  const modal = $("vehicle-details-modal");
  if (modal) {
    modal.style.display = "none";
  }
  activeDetailsVehicleId = null;
  // Hide feedback toast if showing
  const feedback = $("details-quick-save-feedback");
  if (feedback) feedback.style.display = "none";
}

/**
 * Handles transition from Details to Edit modal.
 */
function handleDetailsEditClick() {
  if (activeDetailsVehicleId) {
    const idToEdit = activeDetailsVehicleId;
    closeVehicleDetailsModal();
    openVehicleModal(idToEdit);
  }
}

/**
 * Handles transition from Details to Delete confirmation.
 */
function handleDetailsDeleteClick() {
  if (activeDetailsVehicleId) {
    const idToDelete = activeDetailsVehicleId;
    closeVehicleDetailsModal();
    openDeleteConfirmation(idToDelete);
  }
}

/**
 * Instantly updates vehicle status from details modal controls.
 */
async function handleQuickStatusChange(e) {
  if (!activeDetailsVehicleId) return;
  const newStatus = e.target.value;
  try {
    await updateVehicleStatusAsync(activeDetailsVehicleId, { status: newStatus });
    showQuickSaveFeedback();
    renderVehicleTable();
    initDashboard();

    const vehicle = getAllVehicles().find(v => v.id === activeDetailsVehicleId);
    if (vehicle) {
      updateDetailsModalBadges(vehicle);
    }
  } catch (err) {
    alert("Failed to update status in DB: " + err.message);
  }
}

/**
 * Instantly updates vehicle publication state from details modal controls.
 */
async function handleQuickPublishChange(e) {
  if (!activeDetailsVehicleId) return;
  const pubValue = e.target.value === "published";
  try {
    await updateVehicleStatusAsync(activeDetailsVehicleId, { published: pubValue });
    showQuickSaveFeedback();
    renderVehicleTable();
    initDashboard();

    const vehicle = getAllVehicles().find(v => v.id === activeDetailsVehicleId);
    if (vehicle) {
      updateDetailsModalBadges(vehicle);
    }
  } catch (err) {
    alert("Failed to update publish state in DB: " + err.message);
  }
}

/**
 * Shows temporary confirmation indicator for quick action updates.
 */
function showQuickSaveFeedback() {
  const feedback = $("details-quick-save-feedback");
  if (feedback) {
    feedback.style.display = "inline-flex";
    setTimeout(() => {
      feedback.style.display = "none";
    }, 2000);
  }
}

/**
 * Dynamically re-renders the badge row on updates without closing the modal.
 */
function updateDetailsModalBadges(vehicle) {
  const badgesEl = $("details-modal-badges");
  if (!badgesEl) return;
  badgesEl.innerHTML = "";

  // Status Badge
  let statusBg = "rgba(100, 116, 139, 0.08)";
  let statusColor = "#64748b";
  let statusBorder = "1px solid rgba(100, 116, 139, 0.2)";
  if (vehicle.status === "available") {
    statusBg = "rgba(37, 211, 102, 0.08)";
    statusColor = "#25d366";
    statusBorder = "1px solid rgba(37, 211, 102, 0.2)";
  } else if (vehicle.status === "incoming") {
    statusBg = "rgba(227, 27, 35, 0.08)";
    statusColor = "#e31b23";
    statusBorder = "1px solid rgba(227, 27, 35, 0.2)";
  } else if (vehicle.status === "reserved" || vehicle.status === "pending") {
    statusBg = "rgba(249, 115, 22, 0.08)";
    statusColor = "#f97316";
    statusBorder = "1px solid rgba(249, 115, 22, 0.2)";
  } else if (vehicle.status === "sold") {
    statusBg = "rgba(15, 23, 42, 0.08)";
    statusColor = "#0f172a";
    statusBorder = "1px solid rgba(15, 23, 42, 0.2)";
  }

  const statusBadge = document.createElement("span");
  statusBadge.className = "badge";
  statusBadge.style.cssText = `padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: ${statusBg}; color: ${statusColor}; border: ${statusBorder};`;
  statusBadge.textContent = vehicle.status === "pending" ? "RESERVED" : vehicle.status.toUpperCase();
  badgesEl.appendChild(statusBadge);

  // Publication Badge
  const isPublished = vehicle.published !== false && vehicle.isPublished !== false;
  const pubBg = isPublished ? "rgba(37, 211, 102, 0.08)" : "rgba(100, 116, 139, 0.08)";
  const pubColor = isPublished ? "#25d366" : "#64748b";
  const pubBorder = isPublished ? "1px solid rgba(37, 211, 102, 0.2)" : "1px solid rgba(100, 116, 139, 0.2)";
  const pubBadge = document.createElement("span");
  pubBadge.className = "badge";
  pubBadge.style.cssText = `padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: ${pubBg}; color: ${pubColor}; border: ${pubBorder};`;
  pubBadge.textContent = isPublished ? "PUBLISHED" : "DRAFT";
  badgesEl.appendChild(pubBadge);

  // Featured Badge
  if (vehicle.featured) {
    const featBadge = document.createElement("span");
    featBadge.className = "badge";
    featBadge.style.cssText = `padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: rgba(249, 115, 22, 0.08); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.2);`;
    featBadge.textContent = "FEATURED";
    badgesEl.appendChild(featBadge);
  }

  // Negotiable Badge
  if (vehicle.negotiable) {
    const negBadge = document.createElement("span");
    negBadge.className = "badge";
    negBadge.style.cssText = `padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: rgba(27, 54, 93, 0.08); color: var(--primary-blue); border: 1px solid rgba(27, 54, 93, 0.2);`;
    negBadge.textContent = "NEGOTIABLE";
    badgesEl.appendChild(negBadge);
  }
}

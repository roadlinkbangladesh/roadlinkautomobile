/**
 * Roadlink Automobiles - Homepage Carousel Management Module
 */

import { $, apiFetch, sanitizeHTML } from "./utils.js";
import { hasPermission } from "./auth.js";
import { uploadFileAsync } from "../js/inventory.js";
import { getPublicFileUrl } from "../js/shared/api.js";

let carouselData = [];
let isSubmitting = false;

/**
 * Initializes the Homepage Carousel view
 */
export async function initCarouselView() {
  bindCarouselEvents();
  await loadCarouselList();
}

/**
 * Binds DOM event listeners for carousel view
 */
function bindCarouselEvents() {
  const btnAdd = $("btn-add-carousel-slide");
  if (btnAdd) {
    btnAdd.onclick = () => openCarouselModal();
  }

  const btnCloseModal = $("btn-close-carousel-modal");
  const btnCancelModal = $("btn-cancel-carousel");
  if (btnCloseModal) btnCloseModal.onclick = closeCarouselModal;
  if (btnCancelModal) btnCancelModal.onclick = closeCarouselModal;

  const btnUploadImg = $("btn-upload-carousel-img");
  const imgFileInput = $("car-image-file-input");
  if (btnUploadImg && imgFileInput) {
    btnUploadImg.onclick = () => imgFileInput.click();
    imgFileInput.onchange = handleImageFileUpload;
  }

  const form = $("carousel-form");
  if (form) {
    form.onsubmit = handleCarouselFormSubmit;
  }
}

async function handleImageFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const btnUpload = $("btn-upload-carousel-img");
  if (btnUpload) {
    btnUpload.disabled = true;
    btnUpload.textContent = "Uploading...";
  }

  try {
    const uploadedKey = await uploadFileAsync(file, "carousel");
    const imgUrlInput = $("car-image-url");
    if (imgUrlInput) {
      imgUrlInput.value = uploadedKey;
    }
    updatePreview(uploadedKey);
  } catch (err) {
    alert("Image upload failed: " + err.message);
  } finally {
    if (btnUpload) {
      btnUpload.disabled = false;
      btnUpload.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-upload"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg><span>Upload Image</span>`;
    }
    e.target.value = "";
  }
}

function updatePreview(key) {
  const previewContainer = $("car-preview-container");
  const previewImg = $("car-preview-img");
  if (previewContainer && previewImg) {
    if (key) {
      previewImg.src = getPublicFileUrl(key);
      previewContainer.style.display = "block";
    } else {
      previewContainer.style.display = "none";
    }
  }
}

/**
 * Loads all carousel slides from backend API
 */
export async function loadCarouselList() {
  const tbody = $("carousel-table-body");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
          <div class="spinner" style="width: 20px; height: 20px;"></div>
          <span>Loading carousel slides...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await apiFetch("/api/v1/admin/carousel");
    if (!response.ok) {
      throw new Error("Failed to load carousel slides.");
    }

    const payload = await response.json();
    carouselData = payload.data || [];
    renderCarouselTable(carouselData);
  } catch (error) {
    console.error("Error loading carousel slides:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; color: var(--primary-red);">
          Failed to load carousel slides.
        </td>
      </tr>
    `;
  }
}

/**
 * Renders carousel slides inside table view
 */
function renderCarouselTable(slides) {
  const tbody = $("carousel-table-body");
  if (!tbody) return;

  if (slides.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
          No carousel slides found. Click <strong>Add Carousel Slide</strong> to create one.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = slides.map((slide, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === slides.length - 1;
    const bannerUrl = getPublicFileUrl(slide.image_url);

    return `
      <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
        <td style="padding: 12px 16px; font-weight: 700; color: var(--primary-blue);">
          <div style="display: flex; align-items: center; gap: 4px;">
            <button onclick="window.reorderCarouselSlide('${slide.id}', 'up')" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-icon-sm" title="Move Up">▲</button>
            <button onclick="window.reorderCarouselSlide('${slide.id}', 'down')" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-icon-sm" title="Move Down">▼</button>
            <span style="margin-left: 4px;">${slide.display_order}</span>
          </div>
        </td>
        <td style="padding: 12px 16px;">
          <img src="${bannerUrl}" alt="${sanitizeHTML(slide.title)}" style="width: 80px; height: 48px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=200';">
        </td>
        <td style="padding: 12px 16px;">
          <strong style="color: var(--text-heading); display: block;">${sanitizeHTML(slide.title)}</strong>
          ${slide.badge ? `<span style="display: inline-block; padding: 2px 8px; font-size: 0.725rem; font-weight: 700; background: var(--bg-neutral); color: var(--primary-blue); border-radius: 12px; border: 1px solid var(--border-color); margin-top: 4px;">${sanitizeHTML(slide.badge)}</span>` : ''}
        </td>
        <td style="padding: 12px 16px;">
          <div style="font-size: 0.85rem; color: var(--text-body); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sanitizeHTML(slide.subtitle || '-')}</div>
          ${slide.button_text ? `<small style="color: var(--primary-blue); font-weight: 600;">Button: ${sanitizeHTML(slide.button_text)} (${sanitizeHTML(slide.button_url || '#')})</small>` : ''}
        </td>
        <td style="padding: 12px 16px; text-align: center;">
          <span style="padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 0.75rem; ${slide.is_active ? 'background: rgba(37,211,102,0.1); color: var(--whatsapp-green-hover);' : 'background: rgba(239,68,68,0.1); color: var(--primary-red);'}">
            ${slide.is_active ? 'Visible' : 'Hidden'}
          </span>
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button onclick="window.editCarouselSlide('${slide.id}')" class="btn btn-view-site" style="padding: 6px 12px; font-size: 0.8rem; margin: 0; width: auto;">Edit</button>
            <button onclick="window.deleteCarouselSlide('${slide.id}')" class="btn btn-view-site" style="padding: 6px 12px; font-size: 0.8rem; margin: 0; width: auto; color: var(--primary-red); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function openCarouselModal(slideId = null) {
  const modal = $("carousel-modal");
  const modalTitle = $("carousel-modal-title");
  const idInput = $("car-id-input");
  const titleInput = $("car-title");
  const subtitleInput = $("car-subtitle");
  const badgeInput = $("car-badge");
  const imgUrlInput = $("car-image-url");
  const btnTextInput = $("car-btn-text");
  const btnUrlInput = $("car-btn-url");
  const orderInput = $("car-display-order");
  const activeInput = $("car-is-active");

  if (!modal) return;

  if (slideId) {
    const slide = carouselData.find(s => s.id === slideId);
    if (!slide) return;
    if (modalTitle) modalTitle.textContent = "Edit Carousel Slide";
    if (idInput) idInput.value = slide.id;
    if (titleInput) titleInput.value = slide.title || "";
    if (subtitleInput) subtitleInput.value = slide.subtitle || "";
    if (badgeInput) badgeInput.value = slide.badge || "";
    if (imgUrlInput) imgUrlInput.value = slide.image_url || "";
    if (btnTextInput) btnTextInput.value = slide.button_text || "";
    if (btnUrlInput) btnUrlInput.value = slide.button_url || "";
    if (orderInput) orderInput.value = slide.display_order ?? 10;
    if (activeInput) activeInput.checked = !!slide.is_active;
    updatePreview(slide.image_url);
  } else {
    if (modalTitle) modalTitle.textContent = "Add Carousel Slide";
    if (idInput) idInput.value = "";
    if (titleInput) titleInput.value = "";
    if (subtitleInput) subtitleInput.value = "";
    if (badgeInput) badgeInput.value = "";
    if (imgUrlInput) imgUrlInput.value = "";
    if (btnTextInput) btnTextInput.value = "";
    if (btnUrlInput) btnUrlInput.value = "";
    if (orderInput) orderInput.value = (carouselData.length + 1) * 10;
    if (activeInput) activeInput.checked = true;
    updatePreview("");
  }

  modal.style.display = "flex";
}

export function closeCarouselModal() {
  const modal = $("carousel-modal");
  if (modal) modal.style.display = "none";
}

async function handleCarouselFormSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const id = $("car-id-input")?.value;
  const title = $("car-title")?.value?.trim();
  const subtitle = $("car-subtitle")?.value?.trim() || "";
  const badge = $("car-badge")?.value?.trim() || "";
  const imageUrl = $("car-image-url")?.value?.trim();
  const buttonText = $("car-btn-text")?.value?.trim() || "";
  const buttonUrl = $("car-btn-url")?.value?.trim() || "";
  const displayOrder = parseInt($("car-display-order")?.value || "10", 10);
  const isActive = $("car-is-active")?.checked ?? true;

  if (!title || !imageUrl) {
    alert("Please enter a Title and Banner Image.");
    return;
  }

  isSubmitting = true;
  const submitBtn = $("btn-save-carousel");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }

  try {
    const payload = {
      title, subtitle, badge,
      imageUrl, buttonText, buttonUrl,
      displayOrder, isActive
    };

    const method = id ? "PUT" : "POST";
    const endpoint = id ? `/api/v1/admin/carousel/${id}` : "/api/v1/admin/carousel";

    const response = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Failed to save carousel slide.");
    }

    closeCarouselModal();
    await loadCarouselList();
  } catch (err) {
    alert("Error saving slide: " + err.message);
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Slide";
    }
  }
}

// Window global handlers
window.editCarouselSlide = (id) => openCarouselModal(id);

window.deleteCarouselSlide = async (id) => {
  if (!confirm("Are you sure you want to delete this carousel slide?")) return;
  try {
    const response = await apiFetch(`/api/v1/admin/carousel/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete slide.");
    await loadCarouselList();
  } catch (err) {
    alert("Error deleting slide: " + err.message);
  }
};

window.reorderCarouselSlide = async (id, direction) => {
  const currentIndex = carouselData.findIndex(s => s.id === id);
  if (currentIndex === -1) return;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= carouselData.length) return;

  // Swap display orders
  const currentSlide = carouselData[currentIndex];
  const targetSlide = carouselData[targetIndex];

  const items = [
    { id: currentSlide.id, displayOrder: targetSlide.display_order },
    { id: targetSlide.id, displayOrder: currentSlide.display_order }
  ];

  try {
    await apiFetch("/api/v1/admin/carousel/reorder", {
      method: "PUT",
      body: JSON.stringify({ items })
    });
    await loadCarouselList();
  } catch (err) {
    alert("Failed to reorder slides: " + err.message);
  }
};

/**
 * Roadlink Automobiles - Testimonials Management Module
 */

import { $, apiFetch, sanitizeHTML } from "./utils.js";

let testimonialsData = [];
let isSubmitting = false;

/**
 * Initializes the Testimonials view
 */
export async function initTestimonialsView() {
  bindTestimonialsEvents();
  await loadTestimonialsList();
}

/**
 * Binds DOM event listeners for testimonials view
 */
function bindTestimonialsEvents() {
  const btnAdd = $("btn-add-testimonial");
  if (btnAdd) {
    btnAdd.onclick = () => openTestimonialModal();
  }

  const btnCloseModal = $("btn-close-testimonial-modal");
  const btnCancelModal = $("btn-cancel-testimonial");
  if (btnCloseModal) btnCloseModal.onclick = closeTestimonialModal;
  if (btnCancelModal) btnCancelModal.onclick = closeTestimonialModal;

  const form = $("testimonial-form");
  if (form) {
    form.onsubmit = handleTestimonialFormSubmit;
  }
}

/**
 * Loads all testimonials from backend API
 */
export async function loadTestimonialsList() {
  const tbody = $("testimonials-table-body");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
          <div class="spinner" style="width: 20px; height: 20px;"></div>
          <span>Loading testimonials...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await apiFetch("/api/v1/admin/testimonials");
    if (!response.ok) {
      throw new Error("Failed to load testimonials.");
    }

    const payload = await response.json();
    testimonialsData = payload.data || [];
    renderTestimonialsTable(testimonialsData);
  } catch (error) {
    console.error("Error loading testimonials:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; color: var(--primary-red);">
          Failed to load customer testimonials.
        </td>
      </tr>
    `;
  }
}

/**
 * Renders testimonials inside table view
 */
function renderTestimonialsTable(testimonials) {
  const tbody = $("testimonials-table-body");
  if (!tbody) return;

  if (testimonials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
          No customer testimonials found. Click <strong>Add Testimonial</strong> to create one.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = testimonials.map((test, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === testimonials.length - 1;
    const stars = "★".repeat(test.rating || 5) + "☆".repeat(5 - (test.rating || 5));

    return `
      <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
        <td style="padding: 12px 16px; font-weight: 700; color: var(--primary-blue);">
          <div style="display: flex; align-items: center; gap: 4px;">
            <button onclick="window.reorderTestimonial('${test.id}', 'up')" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-icon-sm" title="Move Up">▲</button>
            <button onclick="window.reorderTestimonial('${test.id}', 'down')" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-icon-sm" title="Move Down">▼</button>
            <span style="margin-left: 4px;">${test.display_order}</span>
          </div>
        </td>
        <td style="padding: 12px 16px;">
          <strong style="color: var(--text-heading); display: block;">${sanitizeHTML(test.author_name)}</strong>
          ${test.designation ? `<span style="font-size: 0.8rem; color: var(--text-muted); display: block;">${sanitizeHTML(test.designation)}</span>` : ''}
          ${test.vehicle_model ? `<span style="font-size: 0.78rem; color: var(--primary-blue); font-weight: 600;">🚗 ${sanitizeHTML(test.vehicle_model)}</span>` : ''}
        </td>
        <td style="padding: 12px 16px; color: #f59e0b; font-size: 1rem; letter-spacing: 1px;">
          ${stars}
        </td>
        <td style="padding: 12px 16px;">
          <div style="font-size: 0.85rem; color: var(--text-body); max-width: 320px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
            "${sanitizeHTML(test.testimonial_text)}"
          </div>
        </td>
        <td style="padding: 12px 16px; text-align: center;">
          <span style="padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 0.75rem; ${test.is_active ? 'background: rgba(37,211,102,0.1); color: var(--whatsapp-green-hover);' : 'background: rgba(239,68,68,0.1); color: var(--primary-red);'}">
            ${test.is_active ? 'Visible' : 'Hidden'}
          </span>
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button onclick="window.editTestimonial('${test.id}')" class="btn btn-view-site" style="padding: 6px 12px; font-size: 0.8rem; margin: 0; width: auto;">Edit</button>
            <button onclick="window.deleteTestimonial('${test.id}')" class="btn btn-view-site" style="padding: 6px 12px; font-size: 0.8rem; margin: 0; width: auto; color: var(--primary-red); border-color: rgba(239, 68, 68, 0.3);">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function openTestimonialModal(testId = null) {
  const modal = $("testimonial-modal");
  const modalTitle = $("testimonial-modal-title");
  const idInput = $("test-id-input");
  const authorInput = $("test-author");
  const designationInput = $("test-designation");
  const vehicleInput = $("test-vehicle-model");
  const ratingInput = $("test-rating");
  const textInput = $("test-text");
  const orderInput = $("test-display-order");
  const activeInput = $("test-is-active");

  if (!modal) return;

  if (testId) {
    const item = testimonialsData.find(t => t.id === testId);
    if (!item) return;
    if (modalTitle) modalTitle.textContent = "Edit Testimonial";
    if (idInput) idInput.value = item.id;
    if (authorInput) authorInput.value = item.author_name || "";
    if (designationInput) designationInput.value = item.designation || "";
    if (vehicleInput) vehicleInput.value = item.vehicle_model || "";
    if (ratingInput) ratingInput.value = item.rating || 5;
    if (textInput) textInput.value = item.testimonial_text || "";
    if (orderInput) orderInput.value = item.display_order ?? 10;
    if (activeInput) activeInput.checked = !!item.is_active;
  } else {
    if (modalTitle) modalTitle.textContent = "Add Testimonial";
    if (idInput) idInput.value = "";
    if (authorInput) authorInput.value = "";
    if (designationInput) designationInput.value = "";
    if (vehicleInput) vehicleInput.value = "";
    if (ratingInput) ratingInput.value = "5";
    if (textInput) textInput.value = "";
    if (orderInput) orderInput.value = (testimonialsData.length + 1) * 10;
    if (activeInput) activeInput.checked = true;
  }

  modal.style.display = "flex";
}

export function closeTestimonialModal() {
  const modal = $("testimonial-modal");
  if (modal) modal.style.display = "none";
}

async function handleTestimonialFormSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const id = $("test-id-input")?.value;
  const authorName = $("test-author")?.value?.trim();
  const designation = $("test-designation")?.value?.trim() || "";
  const vehicleModel = $("test-vehicle-model")?.value?.trim() || "";
  const rating = parseInt($("test-rating")?.value || "5", 10);
  const testimonialText = $("test-text")?.value?.trim();
  const displayOrder = parseInt($("test-display-order")?.value || "10", 10);
  const isActive = $("test-is-active")?.checked ?? true;

  if (!authorName || !testimonialText) {
    alert("Please enter Customer Name and Review text.");
    return;
  }

  isSubmitting = true;
  const submitBtn = $("btn-save-testimonial");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }

  try {
    const payload = {
      authorName, designation, vehicleModel,
      rating, testimonialText, displayOrder, isActive
    };

    const method = id ? "PUT" : "POST";
    const endpoint = id ? `/api/v1/admin/testimonials/${id}` : "/api/v1/admin/testimonials";

    const response = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Failed to save testimonial.");
    }

    closeTestimonialModal();
    await loadTestimonialsList();
  } catch (err) {
    alert("Error saving testimonial: " + err.message);
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Testimonial";
    }
  }
}

// Window global handlers
window.editTestimonial = (id) => openTestimonialModal(id);

window.deleteTestimonial = async (id) => {
  if (!confirm("Are you sure you want to delete this testimonial?")) return;
  try {
    const response = await apiFetch(`/api/v1/admin/testimonials/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete testimonial.");
    await loadTestimonialsList();
  } catch (err) {
    alert("Error deleting testimonial: " + err.message);
  }
};

window.reorderTestimonial = async (id, direction) => {
  const currentIndex = testimonialsData.findIndex(t => t.id === id);
  if (currentIndex === -1) return;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= testimonialsData.length) return;

  const currentItem = testimonialsData[currentIndex];
  const targetItem = testimonialsData[targetIndex];

  const items = [
    { id: currentItem.id, displayOrder: targetItem.display_order },
    { id: targetItem.id, displayOrder: currentItem.display_order }
  ];

  try {
    await apiFetch("/api/v1/admin/testimonials/reorder", {
      method: "PUT",
      body: JSON.stringify({ items })
    });
    await loadTestimonialsList();
  } catch (err) {
    alert("Failed to reorder testimonials: " + err.message);
  }
};

import { TestimonialRepository } from "../repositories/testimonial-repository.js";
import { logAudit } from "../utils/audit.js";

export class TestimonialDomainError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = "TestimonialDomainError";
    this.status = status;
    this.code = code;
  }
}

export class TestimonialService {
  static async getPublicTestimonials(env) {
    return await TestimonialRepository.findAllPublic(env.DB);
  }

  static async listAdminTestimonials(env) {
    const list = await TestimonialRepository.findAllAdmin(env.DB);
    return list.map(item => ({
      ...item,
      isVisible: Boolean(item.isVisible)
    }));
  }

  static async createTestimonial(env, authUser, body, meta) {
    const rating = Math.min(5, Math.max(1, parseInt(body.rating || "5", 10)));
    const testimonialText = (body.testimonialText || body.testimonial_text || "").trim();
    const customerName = (body.customerName || body.customer_name || "").trim();
    const isVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : 1;

    if (!testimonialText) throw new TestimonialDomainError("Testimonial text is required.", 400);
    if (!customerName) throw new TestimonialDomainError("Customer name is required.", 400);

    const maxOrder = await TestimonialRepository.getMaxDisplayOrder(env.DB);
    const displayOrder = body.displayOrder ? Number(body.displayOrder) : (maxOrder + 1);

    const now = new Date().toISOString();
    const id = await TestimonialRepository.create(env.DB, {
      rating, testimonialText, customerName, displayOrder, isVisible
    });

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "testimonial.create",
      resourceType: "testimonial",
      resourceId: id,
      status: "SUCCESS"
    });

    return {
      id,
      rating,
      testimonialText,
      customerName,
      displayOrder,
      isVisible: Boolean(isVisible),
      createdAt: now,
      updatedAt: now
    };
  }

  static async updateTestimonial(env, authUser, id, body, meta) {
    const existing = await TestimonialRepository.findById(env.DB, id);
    if (!existing) throw new TestimonialDomainError("Testimonial not found.", 404);

    const rating = body.rating !== undefined ? Math.min(5, Math.max(1, parseInt(body.rating, 10))) : existing.rating;
    const testimonialText = body.testimonialText !== undefined ? body.testimonialText.trim() : (body.testimonial_text !== undefined ? body.testimonial_text.trim() : existing.testimonial_text);
    const customerName = body.customerName !== undefined ? body.customerName.trim() : (body.customer_name !== undefined ? body.customer_name.trim() : existing.customer_name);
    const isVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : existing.is_visible;
    const displayOrder = body.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order;

    if (!testimonialText) throw new TestimonialDomainError("Testimonial text is required.", 400);
    if (!customerName) throw new TestimonialDomainError("Customer name is required.", 400);

    const now = new Date().toISOString();
    await TestimonialRepository.update(env.DB, id, {
      rating, testimonialText, customerName, displayOrder, isVisible
    });

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "testimonial.update",
      resourceType: "testimonial",
      resourceId: id,
      status: "SUCCESS"
    });

    return {
      id,
      rating,
      testimonialText,
      customerName,
      displayOrder,
      isVisible: Boolean(isVisible),
      updatedAt: now
    };
  }

  static async deleteTestimonial(env, authUser, id, meta) {
    await TestimonialRepository.delete(env.DB, id);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "testimonial.delete",
      resourceType: "testimonial",
      resourceId: id,
      status: "SUCCESS"
    });

    return { id };
  }

  static async reorderTestimonials(env, authUser, testimonialIds, meta) {
    if (!Array.isArray(testimonialIds)) throw new TestimonialDomainError("testimonialIds array is required.", 400);

    let order = 1;
    for (const id of testimonialIds) {
      await TestimonialRepository.updateDisplayOrder(env.DB, id, order++);
    }
  }
}

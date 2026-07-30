import { CarouselRepository } from "../repositories/carousel-repository.js";
import { deleteSupersededMedia } from "./orphan-cleanup.js";
import { logAudit } from "../utils/audit.js";

export class CarouselDomainError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = "CarouselDomainError";
    this.status = status;
    this.code = code;
  }
}

export class CarouselService {
  static async getPublicCarousel(env) {
    return await CarouselRepository.findAllPublic(env.DB);
  }

  static async listAdminSlides(env) {
    const list = await CarouselRepository.findAllAdmin(env.DB);
    return list.map(s => ({
      ...s,
      isVisible: Boolean(s.isVisible)
    }));
  }

  static async createSlide(env, authUser, body, meta) {
    const imageUrl = (body.imageUrl || body.image_url || "").trim();
    const heading = (body.heading || "").trim();
    const subheading = (body.subheading || "").trim();
    const badgeText = (body.badgeText || body.badge_text || "").trim();
    const isVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : 1;

    if (!imageUrl) throw new CarouselDomainError("Background image is required.", 400);
    if (!heading) throw new CarouselDomainError("Slide heading is required.", 400);

    const maxOrder = await CarouselRepository.getMaxDisplayOrder(env.DB);
    const displayOrder = body.displayOrder ? Number(body.displayOrder) : (maxOrder + 1);

    const now = new Date().toISOString();
    const id = await CarouselRepository.create(env.DB, {
      imageUrl, heading, subheading, badgeText, displayOrder, isVisible
    });

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "carousel.create",
      resourceType: "carousel_slide",
      resourceId: id,
      status: "SUCCESS"
    });

    return {
      id,
      imageUrl,
      heading,
      subheading,
      badgeText,
      displayOrder,
      isVisible: Boolean(isVisible),
      createdAt: now,
      updatedAt: now
    };
  }

  static async updateSlide(env, authUser, id, body, meta) {
    const existing = await CarouselRepository.findById(env.DB, id);
    if (!existing) throw new CarouselDomainError("Carousel slide not found.", 404);

    const imageUrl = body.imageUrl !== undefined ? body.imageUrl.trim() : (body.image_url !== undefined ? body.image_url.trim() : existing.image_url);
    const heading = body.heading !== undefined ? body.heading.trim() : existing.heading;
    const subheading = body.subheading !== undefined ? body.subheading.trim() : existing.subheading;
    const badgeText = body.badgeText !== undefined ? body.badgeText.trim() : (body.badge_text !== undefined ? body.badge_text.trim() : existing.badge_text);
    const isVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : existing.is_visible;
    const displayOrder = body.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order;

    if (!imageUrl) throw new CarouselDomainError("Background image is required.", 400);
    if (!heading) throw new CarouselDomainError("Slide heading is required.", 400);
    if (isVisible && !imageUrl) {
      throw new CarouselDomainError("Visible homepage slides require a background image.", 400);
    }

    if (imageUrl !== existing.image_url) {
      await deleteSupersededMedia(env, existing.image_url, imageUrl);
    }

    const now = new Date().toISOString();
    await CarouselRepository.update(env.DB, id, {
      imageUrl, heading, subheading, badgeText, displayOrder, isVisible
    });

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "carousel.update",
      resourceType: "carousel_slide",
      resourceId: id,
      status: "SUCCESS"
    });

    return {
      id,
      imageUrl,
      heading,
      subheading,
      badgeText,
      displayOrder,
      isVisible: Boolean(isVisible),
      updatedAt: now
    };
  }

  static async deleteSlide(env, authUser, id, meta) {
    const existing = await CarouselRepository.findById(env.DB, id);
    if (existing && existing.image_url) {
      await deleteSupersededMedia(env, existing.image_url, null);
    }

    await CarouselRepository.delete(env.DB, id);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "carousel.delete",
      resourceType: "carousel_slide",
      resourceId: id,
      status: "SUCCESS"
    });

    return { id };
  }

  static async reorderSlides(env, authUser, slideIds, meta) {
    if (!Array.isArray(slideIds)) throw new CarouselDomainError("slideIds array is required.", 400);

    let order = 1;
    for (const id of slideIds) {
      await CarouselRepository.updateDisplayOrder(env.DB, id, order++);
    }
  }
}

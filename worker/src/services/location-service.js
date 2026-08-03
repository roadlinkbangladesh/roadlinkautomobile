import { LocationRepository } from "../repositories/location-repository.js";
import { parseAndNormalizeMapInput, deriveNavigationUrl } from "../utils/map-helper.js";
import { logAudit } from "../utils/audit.js";

function formatLocationRecord(loc, phones = []) {
  const rawEmbed = loc.mapEmbedUrl || loc.map_embed_url || "";
  const rawNav = loc.mapUrl || loc.map_url || "";
  const embedUrl = (rawEmbed && (rawEmbed.includes("/embed") || rawEmbed.includes("output=embed")))
    ? rawEmbed 
    : (rawNav.includes("/embed") || rawNav.includes("output=embed") ? rawNav : rawEmbed);
  const navUrl = deriveNavigationUrl(rawNav, embedUrl, loc.title, loc.address);

  return {
    ...loc,
    mapEmbedUrl: embedUrl || (navUrl !== "#" ? `https://maps.google.com/maps?q=${encodeURIComponent([loc.title, loc.address].filter(Boolean).join(" "))}&output=embed` : ""),
    mapUrl: navUrl,
    isVisible: Boolean(loc.isVisible),
    isDefault: Boolean(loc.isDefault),
    phones
  };
}

export class LocationDomainError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = "LocationDomainError";
    this.status = status;
    this.code = code;
  }
}

export class LocationService {
  /**
   * Helper to generate unique stable slug
   */
  static async generateUniqueSlug(db, title) {
    let baseSlug = (title || "location").toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = "location";

    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await LocationRepository.findBySlug(db, slug);
      if (!existing) return slug;
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  /**
   * Get public locations
   */
  static async getPublicLocations(env) {
    const locations = await LocationRepository.findAllPublic(env.DB);
    const locationIds = locations.map(l => l.id);
    const phoneMap = await LocationRepository.fetchPhonesForLocations(env.DB, locationIds);

    return locations.map(loc => formatLocationRecord(loc, phoneMap[loc.id] || []));
  }

  /**
   * Get public location by slug
   */
  static async getPublicLocationBySlug(env, slug) {
    if (!slug) throw new LocationDomainError("Location slug is required.", 400);

    const location = await LocationRepository.findBySlug(env.DB, slug);
    if (!location || !location.isVisible) {
      throw new LocationDomainError(`Location with slug '${slug}' not found.`, 404);
    }

    const phoneMap = await LocationRepository.fetchPhonesForLocations(env.DB, [location.id]);

    return formatLocationRecord(location, phoneMap[location.id] || []);
  }

  /**
   * List all admin locations
   */
  static async listAdminLocations(env) {
    const locations = await LocationRepository.findAllAdmin(env.DB);
    const locationIds = locations.map(l => l.id);
    const phoneMap = await LocationRepository.fetchPhonesForLocations(env.DB, locationIds);

    return locations.map(loc => formatLocationRecord(loc, phoneMap[loc.id] || []));
  }

  /**
   * Create admin location
   */
  static async createLocation(env, authUser, data, meta) {
    const title = (data.title || "").trim();
    const address = (data.address || "").trim();
    const rawMapInput = (data.mapEmbedUrl || data.mapUrl || data.map_url || "").trim();
    const isVisible = data.isVisible !== undefined ? (data.isVisible ? 1 : 0) : 1;
    let isDefault = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : 0;
    const rawPhones = Array.isArray(data.phones) ? data.phones : [];
    const phones = rawPhones.map(p => typeof p === "string" ? p.trim() : "").filter(Boolean);

    if (!title) throw new LocationDomainError("Location title is required.", 400);
    if (!address) throw new LocationDomainError("Location full address is required.", 400);

    let storedEmbedUrl = "";
    let storedNavUrl = "";

    if (rawMapInput) {
      const mapCheck = parseAndNormalizeMapInput(rawMapInput, title, address);
      if (!mapCheck.valid) {
        throw new LocationDomainError(mapCheck.error, 400);
      }
      storedEmbedUrl = mapCheck.embedUrl;
      storedNavUrl = mapCheck.navUrl;
    } else {
      storedNavUrl = deriveNavigationUrl("", "", title, address);
      const query = [title, address].filter(Boolean).join(" ");
      storedEmbedUrl = query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : "";
    }

    const currentDefault = await LocationRepository.findDefault(env.DB);
    if (!currentDefault) {
      isDefault = 1;
    }

    const slug = await this.generateUniqueSlug(env.DB, title);
    const maxOrder = await LocationRepository.getMaxDisplayOrder(env.DB);
    const displayOrder = data.displayOrder ? Number(data.displayOrder) : (maxOrder + 1);

    if (isDefault) {
      await LocationRepository.unsetDefaults(env.DB);
    }

    const now = new Date().toISOString();
    const locationId = await LocationRepository.create(env.DB, {
      slug, title, address, mapUrl: storedNavUrl, mapEmbedUrl: storedEmbedUrl, isVisible, isDefault, displayOrder
    });

    if (phones.length > 0) {
      await LocationRepository.setPhones(env.DB, locationId, phones);
    }

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "location.create",
      targetType: "location",
      targetId: locationId,
      details: { title, slug, isDefault: Boolean(isDefault), isVisible: Boolean(isVisible) }
    });

    return {
      id: locationId,
      slug,
      title,
      address,
      mapUrl: storedNavUrl,
      mapEmbedUrl: storedEmbedUrl,
      isVisible: Boolean(isVisible),
      isDefault: Boolean(isDefault),
      displayOrder,
      phones,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Update admin location
   */
  static async updateLocation(env, authUser, id, data, meta) {
    const existing = await LocationRepository.findById(env.DB, id);
    if (!existing) {
      throw new LocationDomainError(`Business location with ID ${id} not found.`, 404);
    }

    const title = data.title !== undefined ? data.title.trim() : existing.title;
    const address = data.address !== undefined ? data.address.trim() : existing.address;
    const rawMapInput = data.mapEmbedUrl !== undefined ? data.mapEmbedUrl.trim() : (data.mapUrl !== undefined ? data.mapUrl.trim() : (data.map_url !== undefined ? data.map_url.trim() : (existing.map_embed_url || existing.map_url || "")));
    const isVisible = data.isVisible !== undefined ? (data.isVisible ? 1 : 0) : existing.is_visible;
    let isDefault = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : existing.is_default;
    const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : existing.display_order;

    if (!title) throw new LocationDomainError("Location title is required.", 400);
    if (!address) throw new LocationDomainError("Location address is required.", 400);

    let storedEmbedUrl = "";
    let storedNavUrl = "";

    if (rawMapInput) {
      const mapCheck = parseAndNormalizeMapInput(rawMapInput, title, address);
      if (!mapCheck.valid) {
        throw new LocationDomainError(mapCheck.error, 400);
      }
      storedEmbedUrl = mapCheck.embedUrl;
      storedNavUrl = mapCheck.navUrl;
    } else {
      storedNavUrl = deriveNavigationUrl("", "", title, address);
      const query = [title, address].filter(Boolean).join(" ");
      storedEmbedUrl = query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : "";
    }

    if (isDefault) {
      await LocationRepository.unsetDefaults(env.DB, id);
    } else if (existing.is_default === 1 && !isDefault) {
      const otherDefault = await env.DB.prepare(`
        SELECT id FROM business_locations WHERE id != ? AND is_default = 1 AND deleted_at IS NULL
      `).bind(id).first();
      if (!otherDefault) {
        throw new LocationDomainError("At least one location must remain designated as the default location.", 400);
      }
    }

    await LocationRepository.update(env.DB, id, {
      title, address, mapUrl: storedNavUrl, mapEmbedUrl: storedEmbedUrl, isVisible, isDefault, displayOrder
    });

    let phones = [];
    if (data.phones !== undefined && Array.isArray(data.phones)) {
      phones = data.phones.map(p => typeof p === "string" ? p.trim() : "").filter(Boolean);
      await LocationRepository.setPhones(env.DB, id, phones);
    } else {
      const phoneMap = await LocationRepository.fetchPhonesForLocations(env.DB, [id]);
      phones = phoneMap[id] || [];
    }

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "location.update",
      targetType: "location",
      targetId: id,
      details: { title, slug: existing.slug, isDefault: Boolean(isDefault), isVisible: Boolean(isVisible) }
    });

    const now = new Date().toISOString();
    return {
      id,
      slug: existing.slug,
      title,
      address,
      mapUrl: storedNavUrl,
      mapEmbedUrl: storedEmbedUrl,
      isVisible: Boolean(isVisible),
      isDefault: Boolean(isDefault),
      displayOrder,
      phones,
      createdAt: existing.created_at,
      updatedAt: now
    };
  }

  /**
   * Delete admin location
   */
  static async deleteLocation(env, authUser, id, meta) {
    const existing = await LocationRepository.findById(env.DB, id);
    if (!existing) {
      throw new LocationDomainError(`Business location with ID ${id} not found or already deleted.`, 404);
    }

    const activeCount = await LocationRepository.countActive(env.DB);
    if (activeCount <= 1) {
      throw new LocationDomainError("Cannot delete the last remaining business location.", 400);
    }

    if (existing.is_default === 1) {
      throw new LocationDomainError("Cannot delete the default business location. Please set another location as default first.", 400);
    }

    await LocationRepository.softDelete(env.DB, id);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "location.delete",
      targetType: "location",
      targetId: id,
      details: { title: existing.title, slug: existing.slug }
    });

    return { id };
  }

  /**
   * Reorder admin locations
   */
  static async reorderLocations(env, authUser, locationIds, meta) {
    if (!Array.isArray(locationIds) || locationIds.length === 0) {
      throw new LocationDomainError("locationIds array is required.", 400);
    }

    let order = 1;
    for (const locId of locationIds) {
      const id = parseInt(locId, 10);
      if (!isNaN(id)) {
        await LocationRepository.updateDisplayOrder(env.DB, id, order++);
      }
    }

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "location.reorder",
      targetType: "location",
      targetId: null,
      details: { locationIds }
    });

    return { locationIds };
  }

  /**
   * Set location as default
   */
  static async setDefaultLocation(env, authUser, id, meta) {
    const existing = await LocationRepository.findById(env.DB, id);
    if (!existing) {
      throw new LocationDomainError(`Business location with ID ${id} not found.`, 404);
    }

    await LocationRepository.setDefault(env.DB, id);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "location.set_default",
      targetType: "location",
      targetId: id,
      details: { title: existing.title, slug: existing.slug }
    });

    return {
      id,
      isDefault: true,
      message: `'${existing.title}' set as default business location.`
    };
  }
}

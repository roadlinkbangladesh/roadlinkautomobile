import { success, badRequest, notFound, serverError, forbidden } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { logAudit } from "../../utils/audit.js";

/**
 * Helper to fetch phone numbers for a list of location IDs.
 */
async function fetchPhonesForLocations(env, locationIds) {
  if (!locationIds || locationIds.length === 0) return {};
  const placeholders = locationIds.map(() => "?").join(",");
  const query = await env.DB.prepare(`
    SELECT location_id, phone_number, display_order
    FROM business_location_phones
    WHERE location_id IN (${placeholders})
    ORDER BY display_order ASC, id ASC
  `).bind(...locationIds).all();

  const phoneMap = {};
  locationIds.forEach(id => { phoneMap[id] = []; });
  
  (query.results || []).forEach(row => {
    if (!phoneMap[row.location_id]) phoneMap[row.location_id] = [];
    phoneMap[row.location_id].push(row.phone_number);
  });

  return phoneMap;
}

/**
 * Generates a unique, stable slug for a new business location.
 */
async function generateUniqueSlug(env, title) {
  let baseSlug = (title || "location").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (!baseSlug) baseSlug = "location";

  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await env.DB.prepare(`SELECT id FROM business_locations WHERE slug = ?`).bind(slug).first();
    if (!existing) return slug;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

/**
 * Check if user has permission to manage locations.
 */
async function checkLocationsAuth(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth;
  
  const hasAccess = auth.user.is_super_admin || 
                    auth.permissions.includes("locations.manage") || 
                    auth.permissions.includes("settings.edit") ||
                    auth.permissions.includes("settings.view");
                    
  if (!hasAccess) {
    return { errorResponse: forbidden("Access denied. Insufficient permissions to manage business locations.") };
  }
  return auth;
}

/**
 * GET /api/v1/admin/locations - List all active locations for administration
 */
export async function listAdminLocations(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const query = await env.DB.prepare(`
      SELECT 
        id,
        slug,
        title,
        address,
        map_url as mapUrl,
        is_visible as isVisible,
        is_default as isDefault,
        display_order as displayOrder,
        created_at as createdAt,
        updated_at as updatedAt
      FROM business_locations
      WHERE deleted_at IS NULL
      ORDER BY display_order ASC, id ASC
    `).all();

    const locations = query.results || [];
    const locationIds = locations.map(l => l.id);
    const phoneMap = await fetchPhonesForLocations(env, locationIds);

    const formatted = locations.map(loc => ({
      ...loc,
      isVisible: Boolean(loc.isVisible),
      isDefault: Boolean(loc.isDefault),
      phones: phoneMap[loc.id] || []
    }));

    return success(formatted);
  } catch (error) {
    console.error("Error listing admin locations:", error);
    return serverError("Failed to load business locations.");
  }
}

/**
 * POST /api/v1/admin/locations - Create a new business location
 */
export async function createAdminLocation(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const data = await request.json();
    const title = (data.title || "").trim();
    const address = (data.address || "").trim();
    const mapUrl = (data.mapUrl || data.map_url || "").trim();
    const isVisible = data.isVisible !== undefined ? (data.isVisible ? 1 : 0) : 1;
    let isDefault = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : 0;
    const rawPhones = Array.isArray(data.phones) ? data.phones : [];
    const phones = rawPhones.map(p => typeof p === "string" ? p.trim() : "").filter(Boolean);

    if (!title) return badRequest("Location title is required.");
    if (!address) return badRequest("Location full address is required.");

    // Check if any default location exists currently
    const currentDefault = await env.DB.prepare(`
      SELECT id FROM business_locations WHERE is_default = 1 AND deleted_at IS NULL
    `).first();

    // If no default exists, force this new location to be default
    if (!currentDefault) {
      isDefault = 1;
    }

    // Auto-generate stable, unique slug
    const slug = await generateUniqueSlug(env, title);

    // Get max display_order
    const maxOrderRow = await env.DB.prepare(`
      SELECT MAX(display_order) as maxOrder FROM business_locations WHERE deleted_at IS NULL
    `).first();
    const displayOrder = data.displayOrder ? Number(data.displayOrder) : ((maxOrderRow?.maxOrder || 0) + 1);

    // If setting this location as default, unset default on all other locations
    if (isDefault) {
      await env.DB.prepare(`UPDATE business_locations SET is_default = 0 WHERE deleted_at IS NULL`).run();
    }

    const now = new Date().toISOString();
    const insertResult = await env.DB.prepare(`
      INSERT INTO business_locations (
        slug, title, address, map_url, is_visible, is_default, display_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(slug, title, address, mapUrl, isVisible, isDefault, displayOrder, now, now).run();

    const locationId = insertResult.meta.last_row_id;

    // Insert phones
    let order = 1;
    for (const phone of phones) {
      await env.DB.prepare(`
        INSERT INTO business_location_phones (location_id, phone_number, display_order, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(locationId, phone, order++, now).run();
    }

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "location.create",
      targetType: "location",
      targetId: locationId,
      details: { title, slug, isDefault, isVisible }
    });

    return success({
      id: locationId,
      slug,
      title,
      address,
      mapUrl,
      isVisible: Boolean(isVisible),
      isDefault: Boolean(isDefault),
      displayOrder,
      phones,
      createdAt: now,
      updatedAt: now
    }, "Business location created successfully.", 201);
  } catch (error) {
    console.error("Error creating location:", error);
    return serverError("Failed to create business location.");
  }
}

/**
 * PUT /api/v1/admin/locations/:id - Update an existing business location
 */
export async function updateAdminLocation(request, env, ctx, params) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const id = parseInt(params?.id || parts[parts.length - 1], 10);

    if (!id || isNaN(id)) return badRequest("Invalid location ID.");

    const existing = await env.DB.prepare(`
      SELECT * FROM business_locations WHERE id = ? AND deleted_at IS NULL
    `).bind(id).first();

    if (!existing) return notFound(`Business location with ID ${id} not found.`);

    const data = await request.json();
    const title = data.title !== undefined ? data.title.trim() : existing.title;
    const address = data.address !== undefined ? data.address.trim() : existing.address;
    const mapUrl = data.mapUrl !== undefined ? data.mapUrl.trim() : (data.map_url !== undefined ? data.map_url.trim() : (existing.map_url || ""));
    const isVisible = data.isVisible !== undefined ? (data.isVisible ? 1 : 0) : existing.is_visible;
    let isDefault = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : existing.is_default;
    const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : existing.display_order;

    if (!title) return badRequest("Location title is required.");
    if (!address) return badRequest("Location address is required.");

    // Handle default location logic
    if (isDefault) {
      // Unset default for all other locations
      await env.DB.prepare(`UPDATE business_locations SET is_default = 0 WHERE id != ? AND deleted_at IS NULL`).bind(id).run();
    } else if (existing.is_default === 1 && !isDefault) {
      // Trying to unset default on the current default location
      const otherDefault = await env.DB.prepare(`
        SELECT id FROM business_locations WHERE id != ? AND is_default = 1 AND deleted_at IS NULL
      `).bind(id).first();
      
      if (!otherDefault) {
        return badRequest("At least one location must remain designated as the default location.");
      }
    }

    const now = new Date().toISOString();

    // IMPORTANT: Title changes MUST NOT change the slug (slug remains existing.slug)
    await env.DB.prepare(`
      UPDATE business_locations SET
        title = ?,
        address = ?,
        map_url = ?,
        is_visible = ?,
        is_default = ?,
        display_order = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(title, address, mapUrl, isVisible, isDefault, displayOrder, now, id).run();

    // Update phone numbers if provided
    let phones = [];
    if (data.phones !== undefined && Array.isArray(data.phones)) {
      phones = data.phones.map(p => typeof p === "string" ? p.trim() : "").filter(Boolean);
      await env.DB.prepare(`DELETE FROM business_location_phones WHERE location_id = ?`).bind(id).run();
      let order = 1;
      for (const phone of phones) {
        await env.DB.prepare(`
          INSERT INTO business_location_phones (location_id, phone_number, display_order, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(id, phone, order++, now).run();
      }
    } else {
      const phoneMap = await fetchPhonesForLocations(env, [id]);
      phones = phoneMap[id] || [];
    }

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "location.update",
      targetType: "location",
      targetId: id,
      details: { title, slug: existing.slug, isDefault, isVisible }
    });

    return success({
      id,
      slug: existing.slug,
      title,
      address,
      mapUrl,
      isVisible: Boolean(isVisible),
      isDefault: Boolean(isDefault),
      displayOrder,
      phones,
      createdAt: existing.created_at,
      updatedAt: now
    }, "Business location updated successfully.");
  } catch (error) {
    console.error("Error updating location:", error);
    return serverError("Failed to update business location.");
  }
}

/**
 * DELETE /api/v1/admin/locations/:id - Soft delete location
 */
export async function deleteAdminLocation(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const id = parseInt(parts[parts.length - 1], 10);

    if (!id || isNaN(id)) return badRequest("Invalid location ID.");

    const existing = await env.DB.prepare(`
      SELECT * FROM business_locations WHERE id = ? AND deleted_at IS NULL
    `).bind(id).first();

    if (!existing) return notFound(`Business location with ID ${id} not found or already deleted.`);

    // 1. Prevent deleting last remaining location
    const totalCountRow = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM business_locations WHERE deleted_at IS NULL
    `).first();

    if ((totalCountRow?.count || 0) <= 1) {
      return badRequest("Cannot delete the last remaining business location.");
    }

    // 2. Prevent deleting default location
    if (existing.is_default === 1) {
      return badRequest("Cannot delete the default business location. Please set another location as default first.");
    }

    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE business_locations
      SET deleted_at = ?, is_visible = 0, is_default = 0, updated_at = ?
      WHERE id = ?
    `).bind(now, now, id).run();

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "location.delete",
      targetType: "location",
      targetId: id,
      details: { title: existing.title, slug: existing.slug }
    });

    return success({ id }, "Business location archived successfully.");
  } catch (error) {
    console.error("Error deleting location:", error);
    return serverError("Failed to delete business location.");
  }
}

/**
 * PUT /api/v1/admin/locations/reorder - Reorder location display sequence
 */
export async function reorderAdminLocations(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const data = await request.json();
    const locationIds = data.locationIds || data.ids;

    if (!Array.isArray(locationIds) || locationIds.length === 0) {
      return badRequest("locationIds array is required.");
    }

    const now = new Date().toISOString();
    let order = 1;
    for (const locId of locationIds) {
      const id = parseInt(locId, 10);
      if (!isNaN(id)) {
        await env.DB.prepare(`
          UPDATE business_locations SET display_order = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL
        `).bind(order++, now, id).run();
      }
    }

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "location.reorder",
      targetType: "location",
      targetId: null,
      details: { locationIds }
    });

    return success({ locationIds }, "Business locations reordered successfully.");
  } catch (error) {
    console.error("Error reordering locations:", error);
    return serverError("Failed to reorder business locations.");
  }
}

/**
 * PUT /api/v1/admin/locations/:id/default - Set a location as default
 */
export async function setDefaultAdminLocation(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    // path: /api/v1/admin/locations/:id/default
    const id = parseInt(parts[parts.length - 2], 10);

    if (!id || isNaN(id)) return badRequest("Invalid location ID.");

    const existing = await env.DB.prepare(`
      SELECT * FROM business_locations WHERE id = ? AND deleted_at IS NULL
    `).bind(id).first();

    if (!existing) return notFound(`Business location with ID ${id} not found.`);

    const now = new Date().toISOString();

    // Reset default for all active locations
    await env.DB.prepare(`UPDATE business_locations SET is_default = 0, updated_at = ? WHERE deleted_at IS NULL`).bind(now).run();

    // Set this location as default and visible
    await env.DB.prepare(`UPDATE business_locations SET is_default = 1, is_visible = 1, updated_at = ? WHERE id = ?`).bind(now, id).run();

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "location.set_default",
      targetType: "location",
      targetId: id,
      details: { title: existing.title, slug: existing.slug }
    });

    return success({ id, isDefault: true }, `'${existing.title}' set as default business location.`);
  } catch (error) {
    console.error("Error setting default location:", error);
    return serverError("Failed to set default location.");
  }
}

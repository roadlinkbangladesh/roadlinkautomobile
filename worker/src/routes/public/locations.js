import { success, badRequest, notFound, serverError } from "../../utils/response.js";

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
 * GET /api/v1/public/locations - Fetch all visible, active business locations
 */
export async function getPublicLocations(request, env) {
  try {
    const locationsQuery = await env.DB.prepare(`
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
      WHERE deleted_at IS NULL AND is_visible = 1
      ORDER BY display_order ASC, id ASC
    `).all();

    const locations = locationsQuery.results || [];
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
    console.error("Error fetching public locations:", error);
    return serverError("Failed to retrieve business locations.");
  }
}

/**
 * GET /api/v1/public/locations/:slug - Fetch single public location by slug
 */
export async function getPublicLocationBySlug(request, env) {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const slug = parts[parts.length - 1];

    if (!slug) return badRequest("Location slug is required.");

    const location = await env.DB.prepare(`
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
      WHERE slug = ? AND deleted_at IS NULL AND is_visible = 1
    `).bind(slug).first();

    if (!location) {
      return notFound(`Location with slug '${slug}' not found.`);
    }

    const phoneMap = await fetchPhonesForLocations(env, [location.id]);

    return success({
      ...location,
      isVisible: Boolean(location.isVisible),
      isDefault: Boolean(location.isDefault),
      phones: phoneMap[location.id] || []
    });
  } catch (error) {
    console.error("Error fetching location by slug:", error);
    return serverError("Failed to retrieve location details.");
  }
}

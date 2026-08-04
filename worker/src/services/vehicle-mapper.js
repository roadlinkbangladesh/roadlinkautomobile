import { resolveFileUrl } from "../utils/storage.js";

/**
 * Maps a database vehicle row and its associated vehicle_images rows to a domain/API vehicle object.
 * @param {Object} row - The DB row from the `vehicles` table.
 * @param {Array} images - Array of DB rows from the `vehicle_images` table.
 * @param {Object} [options={}] - Options (e.g., { isAdmin: true })
 * @returns {Object|null}
 */
export function mapDbToVehicle(row, images = [], options = {}) {
  if (!row) return null;
  const isAdmin = Boolean(options.isAdmin);

  const exteriorImages = images.filter(i => i.image_type === "exterior").map(i => resolveFileUrl(i.image_url));
  const interiorImages = images.filter(i => i.image_type === "interior").map(i => resolveFileUrl(i.image_url));
  const auctionImages = images.filter(i => i.image_type === "auction").map(i => resolveFileUrl(i.image_url));
  const allImageUrls = images.map(i => resolveFileUrl(i.image_url));

  let parsedFeatures = [];
  if (row.features) {
    try {
      parsedFeatures = JSON.parse(row.features);
    } catch (e) {
      parsedFeatures = String(row.features).split(",").map(f => f.trim()).filter(Boolean);
    }
  }

  const defaultFallback = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800";
  const cover = exteriorImages[0] || allImageUrls[0] || defaultFallback;

  // Resolve auction sheet URL and enforce auctionSheetAvailable logic
  const rawSheet = row.auction_sheet_url || (auctionImages[0] || "");
  const hasAuctionSheet = Boolean(rawSheet && rawSheet.trim() !== "");
  const auctionSheetAvailable = Boolean(row.auction_sheet_available) && hasAuctionSheet;

  // Detect auction sheet format
  const ext = (rawSheet.split(".").pop() || "").toLowerCase();
  const auctionSheetFormat = ext === "pdf" ? "pdf" : "image";

  // For public consumers, use the protected vehicle endpoint rather than raw file/R2 storage path
  let auctionSheetUrl = "";
  if (hasAuctionSheet) {
    if (isAdmin) {
      auctionSheetUrl = resolveFileUrl(rawSheet);
    } else {
      auctionSheetUrl = `/api/v1/public/vehicles/${row.id}/auction-sheet`;
    }
  }

  return {
    id: String(row.id),
    dbId: row.id,
    displayOrder: row.display_order ?? 0,
    featuredPosition: row.featured_position ?? 0,
    isNewArrival: Boolean(row.is_new_arrival),
    slug: row.slug,
    stockNumber: row.stock_number,
    featured: Boolean(row.is_featured),
    published: Boolean(row.is_published),
    status: row.status,
    make: row.make,
    model: row.model,
    grade: row.grade || "",
    year: row.year,
    mileage: row.mileage ?? 0,
    engineCC: row.engine_cc ?? 0,
    fuel: row.fuel || "",
    transmission: row.transmission || "",
    drive: row.drive || "",
    bodyType: row.body_type || "",
    exteriorColor: row.exterior_color || "",
    interiorColor: row.interior_color || "",
    seats: row.seats ?? 5,
    doors: row.doors ?? 4,
    chassisNumber: row.chassis_number || "",
    registration: row.registration || "",
    steering: row.steering || "",
    accidentHistory: row.accident_history || "None",
    purchasePrice: row.purchase_price ?? 0,
    price: row.price ?? 0,
    currency: row.currency || "BDT",
    negotiable: Boolean(row.negotiable),
    showPrice: row.show_price !== undefined && row.show_price !== null ? Boolean(row.show_price) : true,
    show_price: row.show_price !== undefined && row.show_price !== null ? Boolean(row.show_price) : true,
    shortDescription: row.short_description || "",
    description: row.description || "",
    features: parsedFeatures,
    auctionGrade: row.auction_grade || "",
    auctionSheetAvailable,
    auctionSheetUrl,
    auctionSheetFormat,
    youtubeUrl: row.youtube_url || "",
    arrivalDate: row.arrival_date || "",
    archivedAt: row.archived_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: allImageUrls.length > 0 ? allImageUrls : [cover],
    exteriorImages: exteriorImages.length > 0 ? exteriorImages : [cover],
    interiorImages: interiorImages,
    coverImage: cover
  };
}

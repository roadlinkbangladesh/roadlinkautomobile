/**
 * Media Lifecycle & Storage Orphan Cleanup Service
 */

import { getStorageBucket, extractObjectKey, deleteStoredFile } from "../utils/storage.js";
import { platformConfig } from "./platform-config.js";
import { VehicleRepository } from "../repositories/vehicle-repository.js";

/**
 * Deletes a superseded media file from R2 storage if it is no longer referenced.
 */
export async function deleteSupersededMedia(env, oldKeyOrUrl, newKeyOrUrl) {
  if (!oldKeyOrUrl) return false;

  const oldKey = extractObjectKey(oldKeyOrUrl);
  const newKey = extractObjectKey(newKeyOrUrl);

  // If key hasn't changed or isn't an R2 upload path, skip
  if (!oldKey || oldKey === newKey || !oldKey.startsWith("uploads/")) {
    return false;
  }

  // Double check if old key is used elsewhere in database
  try {
    const isVehicleRef = await VehicleRepository.hasVehicleMediaReferences(env.DB, oldKey);
    if (isVehicleRef) return false;

    const setLogoCheck = await env.DB.prepare(`SELECT id FROM settings WHERE company_logo_url LIKE ?`).bind(`%${oldKey}%`).first();
    const setFaviconCheck = await env.DB.prepare(`SELECT id FROM settings WHERE favicon_url LIKE ?`).bind(`%${oldKey}%`).first();
    const carCheck = await env.DB.prepare(`SELECT id FROM carousel_slides WHERE image_url LIKE ?`).bind(`%${oldKey}%`).first();

    if (!setLogoCheck && !setFaviconCheck && !carCheck) {
      return await deleteStoredFile(env, oldKey);
    }
  } catch (err) {
    console.error(`Error checking references for old media ${oldKey}:`, err);
  }

  return false;
}

/**
 * Scans storage bucket for unreferenced orphan files older than orphan_cleanup_days and deletes them.
 */
export async function runOrphanCleanup(env) {
  const bucket = getStorageBucket(env);
  if (!bucket || typeof bucket.list !== "function") {
    console.warn("[OrphanCleanup] Storage bucket list() method is unavailable.");
    return { scanned: 0, deleted: 0 };
  }

  const config = await platformConfig.getConfig(env);
  const orphanDays = config.orphan_cleanup_days || 7;
  const cutoffTime = Date.now() - (orphanDays * 24 * 60 * 60 * 1000);

  // 1. Gather all active referenced media keys from database
  const activeKeys = new Set();

  try {
    // Settings branding keys
    const settings = await env.DB.prepare(`SELECT company_logo_url, favicon_url FROM settings WHERE id = 1`).first();
    if (settings) {
      if (settings.company_logo_url) activeKeys.add(extractObjectKey(settings.company_logo_url));
      if (settings.favicon_url) activeKeys.add(extractObjectKey(settings.favicon_url));
    }

    // Carousel slide image keys
    const carouselRes = await env.DB.prepare(`SELECT image_url FROM carousel_slides`).all();
    for (const slide of carouselRes?.results || []) {
      if (slide.image_url) activeKeys.add(extractObjectKey(slide.image_url));
    }

    // Vehicle image keys and auction sheet keys via VehicleRepository
    const vehicleKeys = await VehicleRepository.getActiveVehicleMediaKeys(env.DB);
    for (const rawUrl of vehicleKeys) {
      const key = extractObjectKey(rawUrl);
      if (key) activeKeys.add(key);
    }
  } catch (err) {
    console.error("[OrphanCleanup] Error collecting active media references from DB:", err);
    return { scanned: 0, deleted: 0, error: err.message };
  }

  // 2. Scan objects in storage
  let scannedCount = 0;
  let deletedCount = 0;

  try {
    const listRes = await bucket.list({ prefix: "uploads/" });
    const objects = listRes?.objects || [];

    for (const obj of objects) {
      const key = obj.key;
      scannedCount++;

      if (!key || activeKeys.has(key)) {
        continue;
      }

      // Check file age
      const uploadedTime = obj.uploaded ? new Date(obj.uploaded).getTime() : 0;
      if (uploadedTime > 0 && uploadedTime > cutoffTime) {
        continue; // File is newer than orphan_cleanup_days threshold
      }

      // Delete unreferenced orphan file
      const success = await deleteStoredFile(env, key);
      if (success) {
        deletedCount++;
        console.log(`[OrphanCleanup] Deleted orphan file: ${key}`);
      }
    }
  } catch (err) {
    console.error("[OrphanCleanup] Error scanning or deleting storage objects:", err);
  }

  return { scanned: scannedCount, deleted: deletedCount, orphanDaysCutoff: orphanDays };
}


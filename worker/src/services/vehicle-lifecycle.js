/**
 * Vehicle Lifecycle & Retention Policy Service
 */

import { platformConfig } from "./platform-config.js";
import { extractObjectKey, deleteStoredFile } from "../utils/storage.js";
import { logAudit } from "../utils/audit.js";
import { VehicleRepository } from "../repositories/vehicle-repository.js";

/**
 * Purges media assets (exterior/interior images and auction sheet) for a vehicle when it transitions to Archived.
 * Retains all vehicle record data, specifications, pricing, stock number, status, and metadata in D1.
 */
export async function purgeArchivedVehicleMedia(env, vehicleId) {
  if (!vehicleId) return { purgedImages: 0, purgedDocs: 0 };

  let purgedImages = 0;
  let purgedDocs = 0;

  try {
    // 1. Fetch vehicle auction sheet
    const vehicle = await VehicleRepository.getAuctionSheetUrl(env.DB, vehicleId);
    if (vehicle && vehicle.auction_sheet_url) {
      const docKey = extractObjectKey(vehicle.auction_sheet_url);
      if (docKey) {
        await deleteStoredFile(env, docKey);
        purgedDocs++;
      }
      // Clear auction_sheet_url and availability flag in database
      await VehicleRepository.clearAuctionSheet(env.DB, vehicleId);
    }

    // 2. Fetch all vehicle images
    const images = await VehicleRepository.findVehicleImages(env.DB, vehicleId);

    for (const img of images) {
      if (img.image_url) {
        const imgKey = extractObjectKey(img.image_url);
        if (imgKey) {
          await deleteStoredFile(env, imgKey);
          purgedImages++;
        }
      }
    }

    // Delete image records from vehicle_images table
    await VehicleRepository.deleteVehicleImages(env.DB, vehicleId);

  } catch (err) {
    console.error(`Error purging media for archived vehicle ID ${vehicleId}:`, err);
  }

  return { purgedImages, purgedDocs };
}

/**
 * Runs automated retention check to archive sold vehicles older than archive_after_months.
 */
export async function runVehicleRetentionArchiving(env) {
  const config = await platformConfig.getConfig(env);
  const months = config.archive_after_months || 12;

  // Calculate cutoff date threshold: current timestamp minus `months`
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  const cutoffIso = cutoffDate.toISOString();

  let archivedCount = 0;

  try {
    // Select sold vehicles updated or sold prior to cutoffIso that are not yet archived
    const vehiclesToArchive = await VehicleRepository.findVehiclesToArchive(env.DB, cutoffIso);
    const nowIso = new Date().toISOString();

    for (const v of vehiclesToArchive) {
      // 1. Update vehicle status to archived and set archived_at
      await VehicleRepository.archiveVehicleRecord(env.DB, v.id, nowIso);

      // 2. Purge media files (exterior images, interior images, auction sheet) to reduce R2 storage
      await purgeArchivedVehicleMedia(env, v.id);

      archivedCount++;

      await logAudit(env, {
        actingUserId: null,
        actingUsername: "SYSTEM_RETENTION_JOB",
        action: "AUTO_ARCHIVE_VEHICLE",
        resourceType: "vehicle",
        resourceId: String(v.id),
        status: "SUCCESS",
        details: JSON.stringify({ stockNumber: v.stock_number, archiveAfterMonths: months, archivedAt: nowIso })
      });
    }
  } catch (err) {
    console.error("Error during automated vehicle retention archiving:", err);
  }

  return { archivedVehiclesCount: archivedCount, cutoffDate: cutoffIso, archiveAfterMonths: months };
}


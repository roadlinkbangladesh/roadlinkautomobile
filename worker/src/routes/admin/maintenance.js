import { success, serverError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { runVehicleRetentionArchiving } from "../../services/vehicle-lifecycle.js";
import { runOrphanCleanup } from "../../services/orphan-cleanup.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";

/**
 * POST /api/v1/admin/maintenance/run
 * Executes retention policy auto-archiving and orphan storage cleanup.
 */
export async function runMaintenanceTasks(request, env) {
  const auth = await authenticate(request, env, "settings.edit");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    const archiveResult = await runVehicleRetentionArchiving(env);
    const orphanResult = await runOrphanCleanup(env);

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "MAINTENANCE_RUN",
      resourceType: "system",
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: JSON.stringify({ archiveResult, orphanResult })
    });

    return success({
      autoArchivedVehicles: archiveResult.archivedVehiclesCount,
      archiveCutoffDate: archiveResult.cutoffDate,
      scannedStorageObjects: orphanResult.scanned,
      deletedOrphanFiles: orphanResult.deleted,
      orphanDaysCutoff: orphanResult.orphanDaysCutoff
    }, "Platform maintenance tasks executed successfully.");
  } catch (error) {
    console.error("Maintenance task execution error:", error);
    return serverError("Failed to execute platform maintenance tasks.");
  }
}

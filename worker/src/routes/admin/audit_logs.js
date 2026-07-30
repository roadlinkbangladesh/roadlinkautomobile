import { success, badRequest, serverError, applySecurityHeaders } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { escapeSqlWildcards } from "../../utils/validator.js";

/**
 * GET /api/v1/admin/audit-logs
 * List append-only audit logs with search, filtering, and pagination.
 */
export async function listAuditLogs(request, env) {
    // Audit logs require audit.view permission or Super Administrator role
    const auth = await authenticate(request, env, "audit.view");
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const url = new URL(request.url);
        const search = url.searchParams.get("query")?.trim() || "";
        const actionFilter = url.searchParams.get("action")?.trim() || "";
        const statusFilter = url.searchParams.get("status")?.trim() || "";
        const startDate = url.searchParams.get("startDate")?.trim() || "";
        const endDate = url.searchParams.get("endDate")?.trim() || "";
        
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
        const offset = (page - 1) * limit;

        const whereClauses = [];
        const bindings = [];

        if (search) {
            whereClauses.push("(acting_username LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR resource_type LIKE ? ESCAPE '\\' OR reason LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\')");
            const term = `%${escapeSqlWildcards(search)}%`;
            bindings.push(term, term, term, term, term);
        }

        if (actionFilter) {
            whereClauses.push("action = ?");
            bindings.push(actionFilter);
        }

        if (statusFilter) {
            whereClauses.push("status = ?");
            bindings.push(statusFilter);
        }

        if (startDate) {
            whereClauses.push("timestamp >= ?");
            bindings.push(startDate);
        }

        if (endDate) {
            whereClauses.push("timestamp <= ?");
            bindings.push(endDate);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        // Count total matching records
        const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereSql}`;
        const countStmt = env.DB.prepare(countQuery);
        const countRes = bindings.length > 0 ? await countStmt.bind(...bindings).first() : await countStmt.first();
        const total = countRes?.total || 0;

        // Fetch paginated rows
        const dataQuery = `
            SELECT * FROM audit_logs
            ${whereSql}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `;
        const dataStmt = env.DB.prepare(dataQuery);
        const dataRes = await dataStmt.bind(...bindings, limit, offset).all();

        const items = dataRes.results || [];

        return success({
            items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("List audit logs error:", error);
        return serverError("Failed to fetch audit logs.");
    }
}

/**
 * GET /api/v1/admin/audit-logs/export
 * Export audit logs in JSON format for security reports or SIEM integration.
 */
export async function exportAuditLogs(request, env) {
    const auth = await authenticate(request, env, "audit.view");
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const query = await env.DB.prepare(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1000`).all();
        const items = query.results || [];

        const responseHeaders = applySecurityHeaders({
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="audit-logs.json"'
        }, request);

        return new Response(JSON.stringify(items, null, 2), {
            status: 200,
            headers: responseHeaders
        });
    } catch (error) {
        console.error("Export audit logs error:", error);
        return serverError("Failed to export audit logs.");
    }
}

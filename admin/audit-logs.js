import { $, apiFetch, sanitizeHTML } from "./utils.js";

let currentPage = 1;
const limit = 20;

export async function initAuditLogsView() {
  bindAuditLogEvents();
  await loadAuditLogs(1);
}

function bindAuditLogEvents() {
  const searchInput = $("audit-log-search");
  const actionFilter = $("audit-log-action-filter");
  const statusFilter = $("audit-log-status-filter");
  const btnExport = $("btn-export-audit-logs");
  const btnPrev = $("btn-audit-prev-page");
  const btnNext = $("btn-audit-next-page");

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    let debounceTimer;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 1;
        loadAuditLogs(1);
      }, 300);
    });
  }

  if (actionFilter && !actionFilter.dataset.bound) {
    actionFilter.dataset.bound = "true";
    actionFilter.addEventListener("change", () => {
      currentPage = 1;
      loadAuditLogs(1);
    });
  }

  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.dataset.bound = "true";
    statusFilter.addEventListener("change", () => {
      currentPage = 1;
      loadAuditLogs(1);
    });
  }

  if (btnExport && !btnExport.dataset.bound) {
    btnExport.dataset.bound = "true";
    btnExport.addEventListener("click", exportAuditLogs);
  }

  if (btnPrev && !btnPrev.dataset.bound) {
    btnPrev.dataset.bound = "true";
    btnPrev.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadAuditLogs(currentPage);
      }
    });
  }

  if (btnNext && !btnNext.dataset.bound) {
    btnNext.dataset.bound = "true";
    btnNext.addEventListener("click", () => {
      currentPage++;
      loadAuditLogs(currentPage);
    });
  }
}

export async function loadAuditLogs(page = 1) {
  const tableBody = $("audit-logs-table-body");
  const loadingIndicator = $("audit-logs-loading");
  const paginationInfo = $("audit-logs-pagination-info");
  const btnPrev = $("btn-audit-prev-page");
  const btnNext = $("btn-audit-next-page");

  if (!tableBody) return;

  if (loadingIndicator) loadingIndicator.style.display = "block";

  const search = $("audit-log-search")?.value?.trim() || "";
  const action = $("audit-log-action-filter")?.value || "";
  const status = $("audit-log-status-filter")?.value || "";

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  });

  if (search) params.append("query", search);
  if (action) params.append("action", action);
  if (status) params.append("status", status);

  try {
    const res = await apiFetch(`/api/v1/admin/audit-logs?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 403) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Access denied. You do not have permission to view audit logs.</td></tr>`;
      } else {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Failed to load security audit logs.</td></tr>`;
      }
      return;
    }

    const result = await res.json();
    if (!result.success || !result.data) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No audit records found.</td></tr>`;
      return;
    }

    const { items, pagination } = result.data;

    if (!items || items.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No security audit records match your filters.</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = "Showing 0 records";
      if (btnPrev) btnPrev.disabled = true;
      if (btnNext) btnNext.disabled = true;
      return;
    }

    tableBody.innerHTML = items.map(log => {
      const formattedTime = new Date(log.timestamp).toLocaleString();
      const statusBadge = log.status === "SUCCESS"
        ? `<span class="status-badge badge-published">SUCCESS</span>`
        : `<span class="status-badge badge-unpublished">FAILURE</span>`;

      let detailsText = "-";
      if (log.details) {
        try {
          const parsed = typeof log.details === "string" ? JSON.parse(log.details) : log.details;
          detailsText = sanitizeHTML(JSON.stringify(parsed));
        } catch (e) {
          detailsText = sanitizeHTML(String(log.details));
        }
      }

      let detailsHtml = detailsText;
      if (log.reason) {
        detailsHtml = `<span class="text-danger" style="color:#e31b23; font-weight:600;">${sanitizeHTML(log.reason)}</span> ${detailsText !== "-" ? "(" + detailsText + ")" : ""}`;
      }

      const rawTooltipText = sanitizeHTML(String(log.reason ? `${log.reason} - ${log.details || ''}` : (log.details || '')));

      return `
        <tr>
          <td><small class="text-muted">${sanitizeHTML(formattedTime)}</small></td>
          <td><strong>${sanitizeHTML(log.acting_username || log.acting_user_id || "System")}</strong></td>
          <td><code>${sanitizeHTML(log.action || "")}</code></td>
          <td><span class="text-muted">${sanitizeHTML(log.resource_type || "")}${log.resource_id ? " #" + sanitizeHTML(log.resource_id) : ""}</span></td>
          <td>${statusBadge}</td>
          <td><small class="text-muted">${sanitizeHTML(log.ip_address || "N/A")}</small></td>
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${rawTooltipText}">${detailsHtml}</td>
        </tr>
      `;
    }).join("");

    const totalPages = pagination?.totalPages || 1;
    const total = pagination?.total || items.length;
    const startNum = (page - 1) * limit + 1;
    const endNum = Math.min(page * limit, total);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startNum}-${endNum} of ${total} security events`;
    }

    if (btnPrev) btnPrev.disabled = page <= 1;
    if (btnNext) btnNext.disabled = page >= totalPages;

  } catch (err) {
    console.error("Error loading audit logs:", err);
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Error loading audit logs. Please try again.</td></tr>`;
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}

async function exportAuditLogs() {
  try {
    const res = await apiFetch("/api/v1/admin/audit-logs/export");
    if (!res.ok) {
      alert("Failed to export security audit logs.");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-audit-logs-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error("Failed to download audit log export:", err);
    alert("Error downloading security audit logs.");
  }
}

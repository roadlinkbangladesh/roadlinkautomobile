/**
 * Roadlink Automobiles - User Management Module
 * Client-side user database UI handler.
 */

import { $ } from "./utils.js";

const MOCK_USERS = [
  { id: "U-101", name: "Administrator", username: "admin", email: "roadlinkbangladesh@gmail.com", role: "Super Admin", status: "Active" },
  { id: "U-102", name: "Ehsanul Hannan", username: "ehsan", email: "hannanehsanul@gmail.com", role: "Manager", status: "Active" },
  { id: "U-103", name: "Sales Desk", username: "sales", email: "sales@roadlinkbd.com", role: "Viewer", status: "Suspended" }
];

let usersEventsBound = false;
let userSearchQuery = "";

/**
 * Initializes and populates the Users View.
 */
export function initUsersView() {
  renderUsersTable();
  if (!usersEventsBound) {
    bindUsersEvents();
    usersEventsBound = true;
  }
}

/**
 * Binds DOM element events for filtering and refreshing the users list.
 */
function bindUsersEvents() {
  const searchInput = $("user-search");
  const refreshBtn = $("btn-refresh-users");
  const addUserBtn = $("btn-add-user");
  const tableBody = $("user-table-body");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      userSearchQuery = searchInput.value.toLowerCase().trim();
      renderUsersTable();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      console.log("Refreshing users list from local cache...");
      // Highlight refresh visually with a brief reset
      const tableBody = $("user-table-body");
      if (tableBody) tableBody.style.opacity = "0.5";
      setTimeout(() => {
        if (tableBody) tableBody.style.opacity = "1";
        renderUsersTable();
      }, 300);
    });
  }

  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      alert("The 'Add User' form modal is a placeholder action designed for Phase 2 implementation.");
    });
  }

  // Event delegation on table body for edit triggers
  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".btn-action-edit");
      if (editBtn) {
        alert("Editing user profiles will be fully supported once Phase 2 backend REST API endpoints are ready.");
      }
    });
  }
}

/**
 * Filters the mock user database and renders rows into the tables.
 */
function renderUsersTable() {
  const tableBody = $("user-table-body");
  const emptyState = $("user-empty-state");

  if (!tableBody) return;

  // Perform search matching
  const filtered = MOCK_USERS.filter(u => {
    return !userSearchQuery || 
      u.name.toLowerCase().includes(userSearchQuery) ||
      u.username.toLowerCase().includes(userSearchQuery) ||
      u.email.toLowerCase().includes(userSearchQuery) ||
      u.role.toLowerCase().includes(userSearchQuery);
  });

  tableBody.innerHTML = "";

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  filtered.forEach(u => {
    const row = document.createElement("tr");
    row.id = `user-row-${u.id}`;

    let statusStyle = "";
    if (u.status === "Active") {
      statusStyle = "background-color: rgba(37, 211, 102, 0.08); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.2);";
    } else {
      statusStyle = "background-color: rgba(227, 27, 35, 0.08); color: #e31b23; border: 1px solid rgba(227, 27, 35, 0.2);";
    }

    row.innerHTML = `
      <td style="font-weight: 600; font-family: var(--font-display);">${u.name}</td>
      <td style="font-weight: 700; font-family: var(--font-mono); font-size: 0.85rem; color: var(--primary-blue);">${u.username}</td>
      <td>${u.email}</td>
      <td style="font-weight: 500;">${u.role}</td>
      <td>
        <span class="badge" style="padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; display: inline-block; ${statusStyle}">
          ${u.status}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-action-edit" data-id="${u.id}" style="padding: 6px 12px; font-size: 0.8rem; border-radius: var(--radius-sm);">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            Edit
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

/**
 * Roadlink Automobiles - User Management Module
 * Encapsulates view rendering, in-memory filtering, and CRUD placeholders.
 */

import { $ } from "./utils.js";

// Mock database representing users
const MOCK_USERS = [
  {
    id: 1,
    name: "Roadlink Manager",
    email: "manager@roadlink.com",
    username: "admin",
    role: "Administrator",
    status: "Active",
    lastLogin: "2026-07-19 19:18:20",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150"
  },
  {
    id: 2,
    name: "Hannan Ehsanul",
    email: "hannanehsanul@gmail.com",
    username: "hannan.sales",
    role: "Sales Executive",
    status: "Active",
    lastLogin: "2026-07-18 14:32:05",
    avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=150"
  },
  {
    id: 3,
    name: "Dhanmondi Staff",
    email: "dhanmondi@roadlink.com",
    username: "dhanmondi.showroom",
    role: "Showroom Auditor",
    status: "Inactive",
    lastLogin: "2026-07-10 11:15:40",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=150"
  }
];

let activeUsers = [...MOCK_USERS];
let usersInitialized = false;

/**
 * Initializes and populates the User Management panel.
 */
export function initUsersView() {
  renderUsersTable();
  if (!usersInitialized) {
    bindUsersEvents();
    usersInitialized = true;
  }
}

/**
 * Binds DOM triggers for user interactions (Add, Search, Refresh, Edit, Delete).
 */
function bindUsersEvents() {
  const searchInput = $("user-search");
  const refreshBtn = $("btn-refresh-users");
  const addUserBtn = $("btn-add-user");
  const tableBody = $("user-table-body");

  // Live query search
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase().trim();
      activeUsers = MOCK_USERS.filter(u => 
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query)
      );
      renderUsersTable();
    });
  }

  // Refresh user table
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      const icon = refreshBtn.querySelector("svg");
      if (icon) {
        icon.style.transform = "rotate(360deg)";
        icon.style.transition = "transform 0.5s ease";
      }
      
      setTimeout(() => {
        if (icon) {
          icon.style.transform = "none";
          icon.style.transition = "none";
        }
        activeUsers = [...MOCK_USERS];
        if (searchInput) searchInput.value = "";
        renderUsersTable();
      }, 500);
    });
  }

  // Mock add user click
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      alert("CRUD Operations: 'Add User' form or modal will open here in a future version.");
    });
  }

  // Row operations via event delegation
  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".btn-action-edit");
      const deleteBtn = e.target.closest(".btn-action-delete");
      
      if (editBtn) {
        const userId = editBtn.getAttribute("data-id");
        alert(`CRUD Operations: Editing user account (ID: ${userId})`);
      }
      
      if (deleteBtn) {
        const userId = deleteBtn.getAttribute("data-id");
        const userObj = activeUsers.find(u => u.id === parseInt(userId, 10));
        if (userObj) {
          const confirmText = `Are you sure you want to permanently delete the administrator profile for '${userObj.name}'? This will disable their access key.`;
          if (confirm(confirmText)) {
            activeUsers = activeUsers.filter(u => u.id !== parseInt(userId, 10));
            renderUsersTable();
          }
        }
      }
    });
  }
}

/**
 * Renders list of users or empty state.
 */
export function renderUsersTable() {
  const tbody = $("user-table-body");
  const emptyState = $("user-empty-state");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (activeUsers.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  activeUsers.forEach(u => {
    const tr = document.createElement("tr");
    tr.id = `user-row-${u.id}`;

    let badgeStyle = "";
    if (u.status === "Active") {
      badgeStyle = "background-color: rgba(37, 211, 102, 0.08); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.2);";
    } else {
      badgeStyle = "background-color: rgba(15, 23, 42, 0.08); color: #0f172a; border: 1px solid rgba(15, 23, 42, 0.2);";
    }

    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 12px; padding: 4px 0;">
          <img src="${u.avatar}" alt="${u.name}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--border-color);" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='../assets/logo.png';">
          <div>
            <div style="font-weight: 700; color: var(--primary-blue); font-family: var(--font-display);">${u.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${u.email}</div>
          </div>
        </div>
      </td>
      <td style="font-weight: 600; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-dark);">${u.username}</td>
      <td style="font-weight: 600;">${u.role}</td>
      <td>
        <span class="badge" style="padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; display: inline-block; ${badgeStyle}">
          ${u.status}
        </span>
      </td>
      <td style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">${u.lastLogin}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action-edit" data-id="${u.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            Edit
          </button>
          <button class="btn-action-delete" data-id="${u.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

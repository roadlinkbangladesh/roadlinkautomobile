/**
 * Roadlink Automobiles - Admin Navigation Controller
 * Manages SPA state, view transitions, page titles, sidebar active highlighting,
 * session-persistent navigation history, and lazy module initialization.
 */

import { $ } from "./utils.js";
import { getAllVehicles } from "../js/inventory.js";
import { initDashboard } from "./dashboard.js";
import { initVehiclesView } from "./vehicles.js";
import { initSettingsView } from "./settings.js";
import { initUsersView } from "./users.js";
import { initChangePasswordView } from "./change-password.js";

const PERSISTENCE_KEY = "roadlink_admin_active_module";

// Configuration mapping views to their DOM panels, sidebar menu triggers, page titles, and loaders
const VIEWS = {
  dashboard: {
    panelId: "dashboard-view-panel",
    btnId: "nav-item-dashboard",
    title: "Dashboard",
    init: () => initDashboard(getAllVehicles())
  },
  vehicles: {
    panelId: "vehicles-view-panel",
    btnId: "nav-item-vehicles",
    title: "Vehicles Inventory",
    init: () => initVehiclesView()
  },
  settings: {
    panelId: "settings-view-panel",
    btnId: "nav-item-settings",
    title: "System Settings",
    init: () => initSettingsView()
  },
  users: {
    panelId: "users-view-panel",
    btnId: "nav-item-users",
    title: "User Management",
    init: () => initUsersView()
  },
  "change-password": {
    panelId: "change-password-view-panel",
    btnId: "nav-item-change-password",
    title: "Change Password",
    init: () => initChangePasswordView()
  }
};

// Tracks which modules have already been initialized to avoid redundant event bindings
const initializedModules = new Set();

/**
 * Switch the active visible panel in the admin workspace.
 * @param {string} viewName - Key of the view (dashboard, vehicles, settings, users, change-password)
 */
export function switchView(viewName) {
  // If the view name is invalid or not registered, default to dashboard
  const targetView = VIEWS[viewName] ? viewName : "dashboard";
  
  const pageTitle = $("topbar-page-title");
  const sidebar = $("admin-sidebar");

  // Persist chosen navigation state
  try {
    sessionStorage.setItem(PERSISTENCE_KEY, targetView);
  } catch (err) {
    console.error("Failed to persist navigation state:", err);
  }

  // Iterate over all views and toggle display blocks/active menu elements
  Object.keys(VIEWS).forEach(key => {
    const config = VIEWS[key];
    const panel = $(config.panelId);
    const button = $(config.btnId);

    if (key === targetView) {
      if (panel) panel.style.display = "block";
      if (button) button.classList.add("active");
      if (pageTitle) pageTitle.textContent = config.title;

      // Lazy initialization of active module (runs only once per session)
      if (!initializedModules.has(key)) {
        try {
          if (config.init) {
            config.init();
          }
          initializedModules.add(key);
        } catch (err) {
          console.error(`Failed to initialize module [${key}]:`, err);
        }
      }
    } else {
      if (panel) panel.style.display = "none";
      if (button) button.classList.remove("active");
    }
  });

  // Close mobile drawer if it's open
  if (sidebar) {
    sidebar.classList.remove("drawer-open");
  }
  
  const mobileSidebarOpen = $("mobile-sidebar-open");
  if (mobileSidebarOpen) {
    mobileSidebarOpen.setAttribute("aria-expanded", "false");
  }
}

/**
 * Restores and displays the previously persistent view, or defaults to dashboard.
 */
export function restorePreviousView() {
  let savedView = "dashboard";
  try {
    const stored = sessionStorage.getItem(PERSISTENCE_KEY);
    if (stored && VIEWS[stored]) {
      savedView = stored;
    }
  } catch (err) {
    console.warn("Storage reading failed, falling back to dashboard view", err);
  }
  switchView(savedView);
}

/**
 * Binds sidebar list items to navigate between modular views.
 */
export function bindNavigationEvents() {
  Object.keys(VIEWS).forEach(key => {
    const button = $(VIEWS[key].btnId);
    if (button) {
      // Clean previous listeners by replacing element clone if needed, but simple event listener is fine.
      // Since bindNavigationEvents is only run once during bootstrap, standard registration is safe.
      button.addEventListener("click", () => {
        switchView(key);
      });
    }
  });
}

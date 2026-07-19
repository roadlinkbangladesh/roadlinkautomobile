/**
 * Roadlink Automobiles - Admin Portal Bootstrap
 * Standard ES Modules bootstrap file for orchestrating the admin workspace.
 */

import { getAllVehicles } from "../js/inventory.js";
import { $ } from "./utils.js";
import { isAuthenticated, bindLoginEvents, bindLogoutEvents, validateSession } from "./auth.js";
import { initDashboard } from "./dashboard.js";
import { initVehiclesView } from "./vehicles.js";
import { initSettingsView } from "./settings.js";
import { showLoginView } from "./ui.js";

/**
 * Initialize core application
 */
async function init() {
  // Always bind event handlers first
  bindLoginEvents(showDashboardView);
  bindLogoutEvents(showLoginView);
  bindNavigationEvents();
  bindSidebarEvents();

  if (isAuthenticated()) {
    showDashboardView();

    const valid = await validateSession();

    if (!valid) {
      showLoginView();
      return;
    }
  } else {
    showLoginView();
  }
}

/**
 * Displays the Login screen view
 */

/**
 * Handles switching active views in the admin workspace.
 * @param {string} viewName - "dashboard", "vehicles", or "settings"
 */
function switchView(viewName) {
  const pageTitle = $("topbar-page-title");
  const sidebar = $("admin-sidebar");
  
  // Define panel bindings, buttons, page titles and their loaders
  const views = {
    dashboard: { panel: $("dashboard-view-panel"), btn: $("nav-item-dashboard"), title: "Dashboard", init: () => initDashboard(getAllVehicles()) },
    vehicles: { panel: $("vehicles-view-panel"), btn: $("nav-item-vehicles"), title: "Vehicles Inventory", init: () => initVehiclesView() },
    settings: { panel: $("settings-view-panel"), btn: $("nav-item-settings"), title: "System Settings", init: () => initSettingsView() }
  };

  // Switch display states and trigger loaders
  Object.keys(views).forEach(key => {
    const item = views[key];
    if (key === viewName) {
      if (item.panel) item.panel.style.display = "block";
      if (item.btn) item.btn.classList.add("active");
      if (pageTitle) pageTitle.textContent = item.title;
      if (item.init) {
        try {
          item.init();
        } catch (err) {
          console.error(`Failed to initialize view: ${key}`, err);
        }
      }
    } else {
      if (item.panel) item.panel.style.display = "none";
      if (item.btn) item.btn.classList.remove("active");
    }
  });

  // Close mobile navigation drawer if open
  if (sidebar) sidebar.classList.remove("drawer-open");
}

/**
 * Displays the main Admin Dashboard view
 */

/**
 * Handles toggling between views (Dashboard vs Vehicles)
 */
function bindNavigationEvents() {
  const btnDashboard = $("nav-item-dashboard");
  const btnVehicles = $("nav-item-vehicles");
  const btnSettings = $("nav-item-settings");

  if (btnDashboard) btnDashboard.addEventListener("click", () => switchView("dashboard"));
  if (btnVehicles) btnVehicles.addEventListener("click", () => switchView("vehicles"));
  if (btnSettings) btnSettings.addEventListener("click", () => switchView("settings"));
}

/**
 * Binds sidebar navigation and responsive drawer events
 */
function bindSidebarEvents() {
  const sidebar = $("admin-sidebar");
  const mobileSidebarOpen = $("mobile-sidebar-open");
  const mobileSidebarClose = $("mobile-sidebar-close");

  if (!sidebar || !mobileSidebarOpen || !mobileSidebarClose) return;

  // Mobile navigation drawer toggle controls
  mobileSidebarOpen.addEventListener("click", () => {
    sidebar.classList.add("drawer-open");
    mobileSidebarOpen.setAttribute("aria-expanded", "true");
  });

  mobileSidebarClose.addEventListener("click", () => {
    sidebar.classList.remove("drawer-open");
    mobileSidebarOpen.setAttribute("aria-expanded", "false");
  });

  // Close mobile drawer when clicking backdrop outside of sidebar area
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 991) {
      const isClickInsideSidebar = sidebar.contains(e.target);
      const isClickOnToggleBtn = mobileSidebarOpen.contains(e.target);
      
      if (!isClickInsideSidebar && !isClickOnToggleBtn && sidebar.classList.contains("drawer-open")) {
        sidebar.classList.remove("drawer-open");
        mobileSidebarOpen.setAttribute("aria-expanded", "false");
      }
    }
  });

  // Escape key hides mobile navigation drawer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("drawer-open")) {
      sidebar.classList.remove("drawer-open");
      mobileSidebarOpen.setAttribute("aria-expanded", "false");
    }
  });
}

// Start core execution once document is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function showDashboardView() {
  const loginView = $("login-view");
  const adminLayout = $("admin-layout");

  if (loginView) loginView.style.display = "none";
  if (adminLayout) adminLayout.style.display = "grid";

  switchView("dashboard");
}

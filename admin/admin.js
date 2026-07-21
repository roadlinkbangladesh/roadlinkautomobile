/**
 * Roadlink Automobiles - Admin Portal Bootstrap
 * Standard ES Modules bootstrap file for orchestrating the admin workspace.
 */

import { getAllVehicles } from "../js/inventory.js";
import { $, setUnauthorizedHandler } from "./utils.js";
import { isAuthenticated, bindLoginEvents, bindLogoutEvents, validateSession, clearToken, hasPermission, getCurrentUser } from "./auth.js";
import { initDashboard } from "./dashboard.js";
import { initVehiclesView } from "./vehicles.js";
import { initSettingsView } from "./settings.js";
import { initUsersView } from "./users.js";
import { initProfileView } from "./profile.js";
import { initRolesView } from "./roles.js";
import { showLoginView } from "./ui.js";
import { navigationController } from "./navigation.js";

/**
 * Initialize core application
 */
async function init() {
  // Always bind event handlers first
  bindLoginEvents(showDashboardView);
  bindLogoutEvents(showLoginView);
  
  // Register all modules with centralized Navigation Controller
  navigationController.registerModule("dashboard", {
    panelId: "dashboard-view-panel",
    btnId: "nav-item-dashboard",
    title: "Dashboard",
    init: () => initDashboard()
  });

  navigationController.registerModule("vehicles", {
    panelId: "vehicles-view-panel",
    btnId: "nav-item-vehicles",
    title: "Vehicles Inventory",
    init: () => initVehiclesView()
  });

  navigationController.registerModule("settings", {
    panelId: "settings-view-panel",
    btnId: "nav-item-settings",
    title: "System Settings",
    init: () => initSettingsView()
  });

  navigationController.registerModule("users", {
    panelId: "users-view-panel",
    btnId: "nav-item-users",
    title: "User Management",
    init: () => initUsersView()
  });

  navigationController.registerModule("profile", {
    panelId: "profile-view-panel",
    btnId: "nav-item-profile",
    title: "My Profile",
    init: () => initProfileView()
  });

  navigationController.registerModule("roles", {
    panelId: "roles-view-panel",
    btnId: "nav-item-roles",
    title: "Roles & Permissions",
    init: () => initRolesView()
  });

  bindSidebarEvents();

  // Bind topbar profile click to navigate to My Profile
  const topbarProfileBadge = $("topbar-profile-badge");
  if (topbarProfileBadge) {
    topbarProfileBadge.onclick = () => {
      navigationController.navigateTo("profile");
    };
  }

  setUnauthorizedHandler(() => {
    clearToken();
    showLoginView();
  });

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
 * Binds responsive sidebar drawer events (non-nav toggle controls)
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

function applyUIPermissions() {
  const user = getCurrentUser();
  if (!user) return;

  // Update topbar profile labels
  const topbarRoleElements = document.querySelectorAll(".user-role");
  const topbarLabelElements = document.querySelectorAll(".user-label");
  topbarRoleElements.forEach(el => {
    el.textContent = user.displayName || user.username;
  });
  topbarLabelElements.forEach(el => {
    el.textContent = user.roleName || "User";
  });

  const mustChange = sessionStorage.getItem("mustChangePassword") === "true";

  const navDashboard = $("nav-item-dashboard");
  const navVehicles = $("nav-item-vehicles");
  const navSettings = $("nav-item-settings");
  const navUsers = $("nav-item-users");
  const navRoles = $("nav-item-roles");
  const navProfile = $("nav-item-profile");

  if (mustChange) {
    // If password change is mandatory, hide all other views
    if (navDashboard) navDashboard.style.display = "none";
    if (navVehicles) navVehicles.style.display = "none";
    if (navSettings) navSettings.style.display = "none";
    if (navUsers) navUsers.style.display = "none";
    if (navRoles) navRoles.style.display = "none";
    if (navProfile) navProfile.style.display = "flex";
  } else {
    // Show normal based on permissions
    if (navDashboard) navDashboard.style.display = "flex";
    if (navVehicles) navVehicles.style.display = "flex";
    if (navSettings) navSettings.style.display = "flex";
    if (navUsers) navUsers.style.display = hasPermission("users.manage") ? "flex" : "none";
    if (navRoles) navRoles.style.display = hasPermission("roles.manage") ? "flex" : "none";
    if (navProfile) navProfile.style.display = "flex";
  }
}

function showDashboardView() {
  const loginView = $("login-view");
  const adminLayout = $("admin-layout");

  if (loginView) loginView.style.display = "none";
  if (adminLayout) adminLayout.style.display = "grid";

  applyUIPermissions();
  navigationController.init();
}

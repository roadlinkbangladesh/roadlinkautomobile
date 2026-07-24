import { $, apiFetch } from "./utils.js";
import { resetFilters } from "./vehicle-table.js";
import { hasPermission, isAuthenticated } from "./auth.js";

class NavigationController {
  constructor() {
    this.modules = {};
    this.currentModule = null;
    this.currentQuery = {};
    this.storageKey = "active_admin_module";
    this.popStateBound = false;
  }

  /**
   * Registers an administrative module with the controller
   * @param {string} name - Short unique key for the module
   * @param {Object} config - { panelId, btnId, title, init }
   */
  registerModule(name, config) {
    this.modules[name] = config;
  }

  /**
   * Normalizes URL route segment to internal module key
   * @param {string} path 
   * @returns {string} Module key
   */
  normalizeRoute(path) {
    const map = {
      "dashboard": "dashboard",
      "vehicles": "vehicles",
      "users": "users",
      "roles": "roles",
      "settings": "settings",
      "locations": "locations",
      "profile": "profile",
      "auditlogs": "auditLogs",
      "audit-logs": "auditLogs"
    };
    const key = (path || "").toLowerCase().trim();
    return map[key] || "dashboard";
  }

  /**
   * Maps internal module name to canonical URL path segment
   * @param {string} route 
   * @returns {string} URL path segment
   */
  getRoutePath(route) {
    const map = {
      "dashboard": "dashboard",
      "vehicles": "vehicles",
      "users": "users",
      "roles": "roles",
      "settings": "settings",
      "locations": "locations",
      "profile": "profile",
      "auditLogs": "audit-logs"
    };
    return map[route] || route;
  }

  /**
   * Parses current window.location.hash into module name and query object
   * @param {string} hashStr 
   * @returns {Object} { route, query }
   */
  parseHash(hashStr) {
    const hash = hashStr || window.location.hash || "";
    if (!hash || hash === "#" || hash === "#/") {
      return { route: "dashboard", query: {} };
    }

    let clean = hash.startsWith("#/") ? hash.substring(2) : (hash.startsWith("#") ? hash.substring(1) : hash);
    if (!clean) return { route: "dashboard", query: {} };

    const [pathPart, queryPart] = clean.split("?");
    const route = this.normalizeRoute(pathPart);

    const query = {};
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      for (const [key, value] of searchParams.entries()) {
        query[key] = value;
      }
    }

    return { route, query };
  }

  /**
   * Constructs URL hash string from route and query object
   * @param {string} route 
   * @param {Object} query 
   * @returns {string} Hash string e.g. "#/vehicles?status=available"
   */
  getHashFromRoute(route, query = {}) {
    const path = this.getRoutePath(route);
    const searchParams = new URLSearchParams();
    Object.keys(query).forEach(k => {
      if (query[k] !== undefined && query[k] !== null && query[k] !== "") {
        searchParams.set(k, query[k]);
      }
    });
    const queryString = searchParams.toString();
    return `#/${path}${queryString ? `?${queryString}` : ""}`;
  }

  /**
   * Restores active module from URL hash or storage
   */
  init() {
    this.bindSidebarEvents();
    this.bindPopState();

    const mustChange = sessionStorage.getItem("mustChangePassword") === "true";
    if (mustChange) {
      this.navigateTo("profile", { replaceState: true });
      return;
    }

    const { route, query } = this.parseHash(window.location.hash);
    if (route && this.modules[route]) {
      this.navigateTo(route, { query, isNavEvent: true });
    } else {
      let savedModule = sessionStorage.getItem(this.storageKey);
      if (!savedModule || !this.modules[savedModule]) {
        savedModule = "dashboard";
      }
      this.navigateTo(savedModule, { isNavEvent: true });
    }
  }

  /**
   * Binds browser history navigation events (Back/Forward)
   */
  bindPopState() {
    if (this.popStateBound) return;
    this.popStateBound = true;

    const handleHashChange = () => {
      if (!isAuthenticated()) return;
      const { route, query } = this.parseHash(window.location.hash);
      
      const mustChange = sessionStorage.getItem("mustChangePassword") === "true";
      if (mustChange && route !== "profile") {
        this.navigateTo("profile", { replaceState: true });
        return;
      }

      this.navigateTo(route, { query, isNavEvent: true });
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
  }

  /**
   * Navigates directly using a raw hash string
   * @param {string} rawHash 
   */
  navigateToHash(rawHash) {
    const { route, query } = this.parseHash(rawHash);
    this.navigateTo(route, { query });
  }

  /**
   * Switches context to target module and updates interface elements & URL hash
   * @param {string} name - Registered module key
   * @param {Object} options - { query, isNavEvent, replaceState }
   */
  async navigateTo(name, options = {}) {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (token) {
      try {
        const profRes = await apiFetch("/api/v1/admin/profile");
        if (profRes.ok) {
          const result = await profRes.json();
          if (result.success && result.data) {
            sessionStorage.setItem("currentUser", JSON.stringify(result.data));
            if (typeof window.applyUIPermissions === "function") {
              window.applyUIPermissions();
            }
          }
        }
      } catch (e) {
        console.error("Failed to refresh profile during navigation:", e);
      }
    }

    const mustChange = sessionStorage.getItem("mustChangePassword") === "true";
    if (mustChange) {
      name = "profile";
    } else {
      // Enforce navigation guards based on permissions
      if (name === "settings" && !hasPermission("settings.view")) {
        name = "dashboard";
      } else if (name === "users" && !hasPermission("users.manage")) {
        name = "dashboard";
      } else if (name === "roles" && !hasPermission("roles.manage")) {
        name = "dashboard";
      } else if (name === "auditLogs" && !hasPermission("audit.view")) {
        name = "dashboard";
      } else if (name === "vehicles" && !hasPermission("vehicles.view")) {
        name = "dashboard";
      }
    }

    if (!this.modules[name]) {
      name = "dashboard";
    }

    const query = options.query || {};
    const targetHash = this.getHashFromRoute(name, query);

    // Sync URL location hash if not triggered by browser popstate/hashchange event
    if (!options.isNavEvent && window.location.hash !== targetHash) {
      if (options.replaceState) {
        history.replaceState(null, "", targetHash);
      } else {
        window.location.hash = targetHash;
      }
    }

    const module = this.modules[name];
    const pageTitle = $("topbar-page-title");
    const sidebar = $("admin-sidebar");

    // Switch display states and trigger initializers
    Object.keys(this.modules).forEach(key => {
      const item = this.modules[key];
      const panel = $(item.panelId);
      const btn = $(item.btnId);

      if (key === name) {
        if (panel) panel.style.display = "block";
        if (btn) btn.classList.add("active");
        if (pageTitle) pageTitle.textContent = item.title;
        document.title = `${item.title} - Roadlink Automobiles Admin`;
        
        // Execute dynamic initialization or reload with query options
        if (typeof item.init === "function") {
          try {
            item.init(query);
          } catch (err) {
            console.error(`Failed to initialize module: ${key}`, err);
          }
        }
      } else {
        if (panel) panel.style.display = "none";
        if (btn) btn.classList.remove("active");
      }
    });

    this.currentModule = name;
    this.currentQuery = query;
    sessionStorage.setItem(this.storageKey, name);

    // Close mobile navigation drawer if open
    if (sidebar) sidebar.classList.remove("drawer-open");
  }

  /**
   * Binds click events to registered sidebar items
   */
  bindSidebarEvents() {
    Object.keys(this.modules).forEach(key => {
      const item = this.modules[key];
      const btn = $(item.btnId);
      if (btn) {
        btn.onclick = () => {
          if (key === "vehicles") {
            try {
              resetFilters();
            } catch (err) {
              console.error("Error resetting vehicles filters on sidebar navigation:", err);
            }
            this.navigateTo("vehicles", { query: {} });
          } else {
            this.navigateTo(key, { query: {} });
          }
        };
      }
    });
  }
}

export const navigationController = new NavigationController();


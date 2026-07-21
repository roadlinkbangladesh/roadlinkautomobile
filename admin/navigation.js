import { $ } from "./utils.js";

class NavigationController {
  constructor() {
    this.modules = {};
    this.currentModule = null;
    this.storageKey = "active_admin_module";
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
   * Restores previously open module on page refresh, defaulting to dashboard
   */
  init() {
    this.bindSidebarEvents();
    
    const mustChange = sessionStorage.getItem("mustChangePassword") === "true";
    let savedModule = sessionStorage.getItem(this.storageKey);
    
    if (mustChange) {
      savedModule = "profile";
    } else if (!savedModule || !this.modules[savedModule]) {
      savedModule = "dashboard";
    }
    
    this.navigateTo(savedModule);
  }

  /**
   * Switches context to target module and updates interface elements
   * @param {string} name - Registered module key
   */
  navigateTo(name) {
    const mustChange = sessionStorage.getItem("mustChangePassword") === "true";
    if (mustChange) {
      name = "profile";
    } else if (!this.modules[name]) {
      name = "dashboard";
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
        
        // Execute dynamic initialization or reload
        if (typeof item.init === "function") {
          try {
            item.init();
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
        // Prevent duplicate listener attachments by using direct property assignment
        btn.onclick = () => this.navigateTo(key);
      }
    });
  }
}

export const navigationController = new NavigationController();

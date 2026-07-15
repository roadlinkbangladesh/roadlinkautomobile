/**
 * Roadlink Automobiles - Live Environment & Portal Switcher Widget
 * Dynamically overlays an interactive environment selector badge/switcher.
 * Allows instant, elegant, non-obtrusive jumping between Admin Portal and Public Website.
 */

(function() {
  function initSwitcher() {
    // Determine current view context
    const isEditingAdmin = window.location.pathname.includes('/admin');
    
    // Create container elements
    const switcherContainer = document.createElement('div');
    switcherContainer.id = 'roadlink-env-switcher';
    
    // Inject Custom Styles for the Switcher (highly polished and matches the brand identity)
    const styleElem = document.createElement('style');
    styleElem.textContent = `
      #roadlink-env-switcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        background-color: #0B1220;
        color: #F8FAFC;
        border: 1px solid #1E293B;
        border-radius: 9999px;
        padding: 6px 6px 6px 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 16px -6px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease;
        animation: switcherEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      #roadlink-env-switcher:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 12px 20px -8px rgba(0, 0, 0, 0.4);
      }
      .switcher-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .switcher-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .dot-public {
        background-color: #10B981;
        box-shadow: 0 0 12px #10B981;
        animation: switcherPulse 2s infinite;
      }
      .dot-admin {
        background-color: #EF4444;
        box-shadow: 0 0 12px #EF4444;
        animation: switcherPulse 2s infinite;
      }
      .switcher-divider {
        width: 1px;
        height: 16px;
        background-color: #1E293B;
      }
      .switcher-btn {
        background-color: #E31B23;
        color: #FFFFFF;
        border: none;
        border-radius: 9999px;
        padding: 8px 16px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background-color 0.15s ease, transform 0.15s ease;
        text-decoration: none;
      }
      .switcher-btn:hover {
        background-color: #FF2B34;
        transform: scale(1.02);
      }
      .switcher-btn:active {
        transform: scale(0.98);
      }
      .switcher-btn svg {
        flex-shrink: 0;
      }
      @keyframes switcherEntrance {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes switcherPulse {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }
      /* Adjust styling on mobile */
      @media (max-width: 576px) {
        #roadlink-env-switcher {
          bottom: 16px;
          right: 16px;
          padding: 4px 4px 4px 12px;
          gap: 8px;
        }
        .switcher-status span {
          display: none;
        }
      }
    `;
    document.head.appendChild(styleElem);
    
    // Build internal HTML structure
    if (isEditingAdmin) {
      switcherContainer.innerHTML = `
        <div class="switcher-status">
          <span class="switcher-status-dot dot-admin"></span>
          <span>Admin Portal</span>
        </div>
        <div class="switcher-divider"></div>
        <a href="../index.html" class="switcher-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>View Site</span>
        </a>
      `;
    } else {
      // Find the relative path to admin folder based on current document structure
      const isSubpage = window.location.pathname.includes('/stock') || window.location.pathname.includes('/vehicle');
      const adminPath = isSubpage ? './admin/index.html' : './admin/index.html';
      // To be perfectly robust with static files in development & build phases:
      const destination = window.location.pathname.endsWith('stock.html') || window.location.pathname.endsWith('vehicle.html') 
        ? './admin/index.html' 
        : 'admin/index.html';

      switcherContainer.innerHTML = `
        <div class="switcher-status">
          <span class="switcher-status-dot dot-public"></span>
          <span>Public Website</span>
        </div>
        <div class="switcher-divider"></div>
        <a href="${destination}" class="switcher-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Admin Portal</span>
        </a>
      `;
    }
    
    // Append to body
    document.body.appendChild(switcherContainer);
  }

  // Self-execute on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSwitcher);
  } else {
    initSwitcher();
  }
})();

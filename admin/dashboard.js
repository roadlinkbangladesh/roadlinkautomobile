/**
 * Roadlink Automobiles - Admin Dashboard Module
 * Handles dashboard statistics calculation and rendering via Backend REST API.
 */

import { $, apiFetch } from "./utils.js";
import { getAllVehicles, loadAdminVehiclesAsync } from "../js/inventory.js";
import { navigationController } from "./navigation.js";

let dashboardEventsBound = false;

/**
 * Calculates vehicle statistics based on their status fields.
 * @param {Array} vehicles - Array of vehicle data objects
 * @returns {Object} Calculated metrics
 */
export function calculateVehicleStatistics(vehicles) {
  if (!vehicles || !Array.isArray(vehicles)) {
    return { total: 0, available: 0, incoming: 0, reserved: 0, sold: 0 };
  }

  const total = vehicles.length;
  const available = vehicles.filter(v => v.status === "available").length;
  const incoming = vehicles.filter(v => v.status === "incoming").length;
  const reserved = vehicles.filter(v => v.status === "reserved" || v.status === "pending").length;
  const sold = vehicles.filter(v => v.status === "sold").length;

  return { total, available, incoming, reserved, sold };
}

/**
 * Renders the calculated vehicle statistics onto the dashboard metrics cards.
 * @param {Object} stats - Calculated metrics containing total, available, incoming, reserved, sold
 */
export function renderDashboardStatistics(stats) {
  const statTotal = $("stat-total");
  const statAvailable = $("stat-available");
  const statIncoming = $("stat-incoming");
  const statReserved = $("stat-reserved");
  const statSold = $("stat-sold");

  if (statTotal) statTotal.textContent = (stats.total || 0).toString();
  if (statAvailable) statAvailable.textContent = (stats.available || 0).toString();
  if (statIncoming) statIncoming.textContent = (stats.incoming || 0).toString();
  if (statReserved) statReserved.textContent = (stats.reserved || 0).toString();
  if (statSold) statSold.textContent = (stats.sold || 0).toString();
}

/**
 * Bind click events to metric cards for module navigation and table filtering
 */
function bindMetricCardEvents() {
  const cardTotal = document.querySelector(".bg-card-blue");
  const cardAvailable = document.querySelector(".bg-card-green");
  const cardIncoming = document.querySelector(".bg-card-red");
  const cardReserved = document.querySelector(".bg-card-orange");
  const cardSold = document.querySelector(".bg-card-charcoal");

  const navigateAndFilter = (status) => {
    if (status === "all") {
      navigationController.navigateTo("vehicles", { query: {} });
    } else {
      navigationController.navigateTo("vehicles", { query: { status } });
    }
  };

  if (cardTotal) {
    cardTotal.style.cursor = "pointer";
    cardTotal.onclick = () => navigateAndFilter("all");
  }
  if (cardAvailable) {
    cardAvailable.style.cursor = "pointer";
    cardAvailable.onclick = () => navigateAndFilter("available");
  }
  if (cardIncoming) {
    cardIncoming.style.cursor = "pointer";
    cardIncoming.onclick = () => navigateAndFilter("incoming");
  }
  if (cardReserved) {
    cardReserved.style.cursor = "pointer";
    cardReserved.onclick = () => navigateAndFilter("reserved");
  }
  if (cardSold) {
    cardSold.style.cursor = "pointer";
    cardSold.onclick = () => navigateAndFilter("sold");
  }
}

/**
 * Initializes and updates the dashboard metrics from API endpoint.
 */
export async function initDashboard() {
  await loadAdminVehiclesAsync();
  try {
    const res = await apiFetch("/api/v1/admin/dashboard/stats");
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const payload = await res.json();
      if (payload && payload.success && payload.data) {
        renderDashboardStatistics(payload.data);
      } else {
        const vehicles = getAllVehicles();
        renderDashboardStatistics(calculateVehicleStatistics(vehicles));
      }
    } else {
      const vehicles = getAllVehicles();
      renderDashboardStatistics(calculateVehicleStatistics(vehicles));
    }
  } catch (err) {
    console.error("Failed to fetch dashboard stats from API:", err);
    const vehicles = getAllVehicles();
    renderDashboardStatistics(calculateVehicleStatistics(vehicles));
  }

  if (!dashboardEventsBound) {
    bindMetricCardEvents();
    dashboardEventsBound = true;
  }
}

/**
 * Roadlink Automobiles - Admin Dashboard Module
 * Handles dashboard statistics calculation and rendering.
 */

import { $ } from "./utils.js";
import { getAllVehicles } from "../js/inventory.js";

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

  if (statTotal) statTotal.textContent = stats.total.toString();
  if (statAvailable) statAvailable.textContent = stats.available.toString();
  if (statIncoming) statIncoming.textContent = stats.incoming.toString();
  if (statReserved) statReserved.textContent = stats.reserved.toString();
  if (statSold) statSold.textContent = stats.sold.toString();
}

/**
 * Initializes and updates the dashboard metrics.
 */
export function initDashboard() {
  const vehicles = getAllVehicles();
  const stats = calculateVehicleStatistics(vehicles);
  renderDashboardStatistics(stats);
}

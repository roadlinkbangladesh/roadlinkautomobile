import { MOCK_VEHICLES } from "./stock.js";

const STORAGE_KEY = "roadlink_vehicles";

/**
 * Loads vehicles from localStorage. If localStorage is empty,
 * automatically seeds it from MOCK_VEHICLES and returns the array.
 * @returns {Array} List of vehicles
 */
export function loadVehicles() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing stored vehicles from localStorage, re-seeding...", e);
    }
  }
  
  // Seed database
  saveVehicles(MOCK_VEHICLES);
  return MOCK_VEHICLES;
}

/**
 * Persists the vehicle list to localStorage.
 * @param {Array} vehicles - The full list of vehicles to save
 */
export function saveVehicles(vehicles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

/**
 * Returns all vehicles from the inventory.
 * @returns {Array} List of vehicles
 */
export function getAllVehicles() {
  return loadVehicles();
}

/**
 * Retrieves a vehicle by its unique ID.
 * @param {string} id - The vehicle ID
 * @returns {Object|null} The matching vehicle object or null
 */
export function getVehicleById(id) {
  const vehicles = loadVehicles();
  return vehicles.find(v => v.id === id) || null;
}

/**
 * Adds a new vehicle to the inventory.
 * @param {Object} vehicle - The vehicle data to add
 * @returns {Object} The added vehicle
 */
export function addVehicle(vehicle) {
  const vehicles = loadVehicles();
  vehicles.push(vehicle);
  saveVehicles(vehicles);
  return vehicle;
}

/**
 * Updates an existing vehicle's details.
 * @param {string} id - The vehicle ID to update
 * @param {Object} updatedFields - The fields and values to merge
 * @returns {Object|null} The updated vehicle object or null
 */
export function updateVehicle(id, updatedFields) {
  const vehicles = loadVehicles();
  const index = vehicles.findIndex(v => v.id === id);
  if (index === -1) return null;

  vehicles[index] = {
    ...vehicles[index],
    ...updatedFields,
    updatedAt: new Date().toISOString()
  };

  saveVehicles(vehicles);
  return vehicles[index];
}

/**
 * Deletes a vehicle from the inventory by its ID.
 * @param {string} id - The vehicle ID to delete
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteVehicle(id) {
  const vehicles = loadVehicles();
  const index = vehicles.findIndex(v => v.id === id);
  if (index === -1) return false;

  vehicles.splice(index, 1);
  saveVehicles(vehicles);
  return true;
}

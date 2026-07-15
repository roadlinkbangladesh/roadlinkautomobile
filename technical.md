# Roadlink Automobiles - Synced Inventory Schema & Specifications

This technical document outlines the synchronized data structures, variable names, data types, and mapping relationships between the **Admin Portal** inventory manager and the **Public Customer-Facing Website**.

---

## 1. Core Synchronized Fields

The following fields have been synchronized across the admin inventory editor (`/admin/index.html`, `/admin/vehicles.js`) and the public detail viewer (`/js/vehicle.js`, `/js/stock.js`):

| Variable Name | JSON Data Type | Admin Input Type | UI Form Section | Public Website Mapping & Display |
| :--- | :--- | :--- | :--- | :--- |
| `bodyType` | `string` | `<select>` dropdown | Core Information | Displayed in Key Specs table (Sedan, SUV, Hatchback, etc.) |
| `featured` | `boolean` | `<input type="checkbox">` | Core Information | Flags vehicle for Home page featured slider & prominent badges |
| `negotiable` | `boolean` | `<input type="checkbox">` | Pricing | Appends a "Negotiable" note next to the price on the detail page |
| `arrivalDate` | `string` | `<input type="text">` | Status | Displays expected delivery timeline on incoming/pending vehicles |
| `accidentHistory` | `string` | `<input type="text">` | Specifications | Renders under the specifications detail list (e.g. "None", "Repaired") |
| `shortDescription` | `string` | `<input type="text">` | Description | Displayed as a premium bold subtitle/tagline below the main title |
| `youtubeUrl` | `string` | `<input type="url">` | Media & Verification | Embeds an interactive YouTube walkaround video frame on the details page |
| `auctionSheetUrl` | `string` | `<input type="text">` | Media & Verification | Connects direct download/view link to the verifiable report |
| `auctionSheetAvailable`| `boolean` | `<input type="checkbox">` | Media & Verification | Shows verified auction badge, unlocking "View Report" interactive controls |
| `published` | `boolean` | `<input type="checkbox">` | Core Information | If false, hides the vehicle from all public portal pages (home, stock, related list, and detail direct lookup) |
| `showAuctionDownload` | `boolean` | `<input type="checkbox">` | Media & Verification | If false, hides the "Download Document" button from the public vehicle detail page while keeping the "View Auction Sheet" option available |
| `features` | `string[]` | Comma-separated input | Specifications | Parses into an array to render responsive highlight bullet points |

---

## 2. Updated Specifications Table Mappings

To maximize transparency, several fields that were previously omitted or hidden from the public website specifications table have been integrated and fully formatted in `/js/vehicle.js`:

*   **Chassis Number (`chassisNumber`)**: Integrated directly into the specs list.
*   **Registration (`registration`)**: Displays current registration status or "Unregistered / Auction Grade" dynamically.
*   **Steering Config (`steering`)**: Formatted dynamically for instant recognition (e.g., `"RHD"` converts to `"Right Hand Drive (RHD)"` and `"LHD"` to `"Left Hand Drive (LHD)"`).

---

## 3. Data Safety & Form Handlers

*   **Robust Parsing**: Boolean checkbox inputs are parsed via strict truthiness tests (`!!value` and `input.checked`) rather than string comparisons.
*   **List Transformations**: The comma-separated feature string is automatically split, trimmed, and stripped of empty elements to produce a clean TypeScript/JavaScript array:
    ```js
    const parsedFeatures = data.features ? data.features.split(",").map(f => f.trim()).filter(Boolean) : [];
    ```
*   **Fallback Assets**: Missing cover photos default to a high-resolution premium Unsplash placeholder to maintain elegant UI presentation in both grids and tabular logs.

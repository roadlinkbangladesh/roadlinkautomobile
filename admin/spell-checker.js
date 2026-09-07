/**
 * Roadlink Automobiles - Automotive Spell Checking & Autocomplete Engine
 * Provides intelligent typo detection and suggestions for vehicle data entry.
 */

// Popular automotive color finishes and base terms
const COLOR_KEYWORDS = [
  "Pearl", "Metallic", "Mica", "Clearcoat", "Matte", "Gloss", "Satin",
  "White", "Black", "Silver", "Gray", "Grey", "Blue", "Red", "Green",
  "Brown", "Yellow", "Orange", "Gold", "Bronze", "Beige", "Burgundy",
  "Maroon", "Purple", "Violet", "Titanium", "Platinum", "Champagne",
  "Charcoal", "Crimson", "Navy", "Teal", "Turquoise", "Emerald",
  "Ruby", "Sapphire", "Crystal", "Diamond", "Obsidian", "Graphite",
  "Gunmetal", "Sonic", "Velvet", "Alabaster", "Ivory", "Midnight",
  "Cosmic", "Magnetic", "Blizzard", "Super", "Pure", "Deep", "Dark",
  "Light", "Frost", "Glacier", "Shadow", "Celestial", "Radiant"
];

// Well-known OEM / Market paint color formulas
const OEM_COLORS = [
  // White / Silver / Gray
  "Pearl White", "Super White", "Platinum White Pearl", "Blizzard Pearl",
  "Crystal White Pearl", "Glacier White", "Pure White", "Alabaster White",
  "Silver Metallic", "Celestial Silver Metallic", "Atomic Silver", "Sonic Silver",
  "Magnetic Gray Metallic", "Dark Gray Metallic", "Machine Gray Metallic",
  "Graphite Gray", "Charcoal Gray", "Gunmetal Gray Metallic", "Titanium Silver Metallic",
  
  // Black
  "Midnight Black Metallic", "Attitude Black Mica", "Jet Black",
  "Obsidian Black", "Phantom Black", "Crystal Black Pearl", "Onyx Black",
  
  // Red / Burgundy
  "Ruby Red Pearl", "Soul Red Crystal Metallic", "Radiant Red Metallic",
  "Crimson Spark Red Metallic", "Barcelona Red Metallic", "Wine Red Pearl",
  "Bordeaux Mica", "Deep Red Mica", "Cherry Red Pearl", "Burgundy Velvet",
  
  // Blue
  "Cosmic Blue Metallic", "Deep Blue Pearl", "Midnight Blue Pearl",
  "Sapphire Blue Metallic", "Nautical Blue Metallic", "Aegean Blue Metallic",
  "Blueprint", "Dark Blue Mica", "Pacific Blue Metallic", "Sky Blue Pearl",
  
  // Brown / Bronze / Gold / Beige
  "Avant-Garde Bronze Metallic", "Bronze Metallic", "Champagne Gold Metallic",
  "Beige Velvet", "Almond Beige", "Quicksand", "Mocha Brown Pearl",
  
  // Green / Yellow / Orange
  "Emerald Green Metallic", "Army Green", "Spruce Mica", "Thermal Orange Pearl"
];

// Interior color common terms
const INTERIOR_COLORS = [
  "Black", "Black Leather", "Beige", "Beige Velvet", "Beige Leather",
  "Dark Grey", "Light Grey", "Brown Leather", "Saddle Brown", "Cognac Leather",
  "Burgundy Leather", "Ivory", "Ivory White", "Oatmeal Fabric", "Charcoal Fabric"
];

// Popular Makes
const POPULAR_MAKES = [
  "Toyota", "Honda", "Nissan", "Mazda", "Mitsubishi", "Subaru", "Lexus",
  "Suzuki", "Daihatsu", "BMW", "Mercedes-Benz", "Audi", "Volkswagen",
  "Hyundai", "Kia", "Ford", "Land Rover", "Jeep", "Porsche", "Volvo"
];

// Drive types
const DRIVE_TYPES = ["2WD", "4WD", "AWD", "FWD", "RHD", "LHD"];

// Fuel types
const FUEL_TYPES = ["Hybrid", "Petrol", "Octane", "Diesel", "Electric", "Plug-in Hybrid (PHEV)", "CNG", "LPG"];

/**
 * Standard Levenshtein Distance algorithm.
 * Computes the minimum number of single-character edits between two strings.
 */
function levenshteinDistance(s1, s2) {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const d = [];
  for (let i = 0; i <= m; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Finds if a word has a close match in a dictionary.
 * Threshold:
 * - words <= 3 chars: exact only
 * - words 4-6 chars: max distance 1 (e.g. "Pear" vs "Pearl", "Metalic" vs "Metallic")
 * - words 7+ chars: max distance 2 (e.g. "Burgendy" vs "Burgundy", "Platinam" vs "Platinum")
 */
function findClosestWord(word, dictionary) {
  const w = word.trim();
  if (!w || w.length < 3) return null;

  const wLower = w.toLowerCase();
  let bestCandidate = null;
  let minDistance = 999;

  for (const dictWord of dictionary) {
    const dLower = dictWord.toLowerCase();
    if (wLower === dLower) {
      return null; // Already correctly spelled
    }

    const dist = levenshteinDistance(wLower, dLower);
    const maxAllowedDist = w.length <= 4 ? 1 : (w.length <= 7 ? 1 : 2);

    if (dist <= maxAllowedDist && dist < minDistance) {
      minDistance = dist;
      bestCandidate = dictWord;
    }
  }

  return bestCandidate;
}

/**
 * Checks a full phrase word by word against the automotive dictionary,
 * and also checks the full phrase against known OEM colors.
 * Returns suggested correction or null.
 */
export function checkAutomotiveSpell(fieldName, text) {
  const raw = (text || "").trim();
  if (!raw || raw.length < 3) return null;

  if (fieldName === "exteriorColor" || fieldName === "interiorColor") {
    const dict = fieldName === "exteriorColor" ? OEM_COLORS : INTERIOR_COLORS;

    // 1. Full phrase check against OEM colors (e.g., "Ruby Red Pear" -> "Ruby Red Pearl")
    for (const oem of dict) {
      if (raw.toLowerCase() === oem.toLowerCase()) {
        return null; // Perfect match
      }
      const dist = levenshteinDistance(raw.toLowerCase(), oem.toLowerCase());
      // For full color phrase, allow distance 1 or 2 depending on length
      const allowed = raw.length > 8 ? 2 : 1;
      if (dist > 0 && dist <= allowed) {
        return oem;
      }
    }

    // 2. Word-by-word check against color keywords (handles custom combinations like "Sonic Blue Pear" -> "Sonic Blue Pearl")
    const words = raw.split(/\s+/);
    let hasCorrection = false;
    const correctedWords = words.map(w => {
      const cleanW = w.replace(/[^a-zA-Z]/g, "");
      const match = findClosestWord(cleanW, COLOR_KEYWORDS);
      if (match) {
        hasCorrection = true;
        return match;
      }
      return w;
    });

    if (hasCorrection) {
      return correctedWords.join(" ");
    }
  } else if (fieldName === "make") {
    for (const make of POPULAR_MAKES) {
      if (raw.toLowerCase() === make.toLowerCase()) return null;
      const dist = levenshteinDistance(raw.toLowerCase(), make.toLowerCase());
      if (dist > 0 && dist <= (raw.length > 5 ? 2 : 1)) {
        return make;
      }
    }
  } else if (fieldName === "fuel") {
    for (const fuel of FUEL_TYPES) {
      if (raw.toLowerCase() === fuel.toLowerCase()) return null;
      const dist = levenshteinDistance(raw.toLowerCase(), fuel.toLowerCase());
      if (dist > 0 && dist <= 2) {
        return fuel;
      }
    }
  } else if (fieldName === "drive") {
    for (const drive of DRIVE_TYPES) {
      if (raw.toLowerCase() === drive.toLowerCase()) return null;
      const dist = levenshteinDistance(raw.toLowerCase(), drive.toLowerCase());
      if (dist > 0 && dist <= 1) {
        return drive;
      }
    }
  }

  return null;
}

/**
 * Attaches the spell-checker and suggestion UI to the target vehicle form fields.
 */
export function initAutomotiveSpellChecker() {
  const fieldsToCheck = [
    { id: "v-ext-color", name: "exteriorColor", listId: "datalist-ext-colors", suggestions: OEM_COLORS },
    { id: "v-int-color", name: "interiorColor", listId: "datalist-int-colors", suggestions: INTERIOR_COLORS },
    { id: "v-make", name: "make", listId: "datalist-makes", suggestions: POPULAR_MAKES },
    { id: "v-fuel", name: "fuel", listId: "datalist-fuels", suggestions: FUEL_TYPES },
    { id: "v-drive", name: "drive", listId: "datalist-drives", suggestions: DRIVE_TYPES }
  ];

  fieldsToCheck.forEach(cfg => {
    const input = document.getElementById(cfg.id);
    if (!input) return;

    // 1. Inject HTML5 Datalist for autocomplete if not already present
    if (cfg.listId && !document.getElementById(cfg.listId)) {
      const datalist = document.createElement("datalist");
      datalist.id = cfg.listId;
      cfg.suggestions.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item;
        datalist.appendChild(opt);
      });
      document.body.appendChild(datalist);
      input.setAttribute("list", cfg.listId);
    }

    // 2. Prepare container for suggestion pill
    let suggestionBox = input.parentNode.querySelector(`.spell-suggestion-box[data-for="${cfg.id}"]`);
    if (!suggestionBox) {
      suggestionBox = document.createElement("div");
      suggestionBox.className = "spell-suggestion-box";
      suggestionBox.setAttribute("data-for", cfg.id);
      suggestionBox.style.cssText = `
        display: none;
        margin-top: 6px;
        font-size: 0.8rem;
        background: rgba(30, 144, 255, 0.08);
        border: 1px solid rgba(30, 144, 255, 0.25);
        border-radius: var(--radius-sm, 6px);
        padding: 6px 10px;
        color: #1e3a8a;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        animation: fadeIn 0.2s ease-in-out;
      `;
      input.parentNode.appendChild(suggestionBox);
    }

    // Handler to run spellcheck
    const runCheck = () => {
      const val = input.value;
      const suggestion = checkAutomotiveSpell(cfg.name, val);

      if (suggestion && suggestion.toLowerCase() !== val.trim().toLowerCase()) {
        suggestionBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary-blue, #1e90ff); flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span>Did you mean <strong>${escapeHtml(suggestion)}</strong>?</span>
          </div>
          <div style="display: flex; gap: 4px; flex-shrink: 0;">
            <button type="button" class="btn-accept-spell" style="background: var(--primary-blue, #1e90ff); color: #ffffff; border: none; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 2px;">
              Accept
            </button>
            <button type="button" class="btn-dismiss-spell" style="background: transparent; color: #64748b; border: none; padding: 2px 4px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;" title="Dismiss">
              ✕
            </button>
          </div>
        `;
        suggestionBox.style.display = "flex";

        const btnAccept = suggestionBox.querySelector(".btn-accept-spell");
        const btnDismiss = suggestionBox.querySelector(".btn-dismiss-spell");

        if (btnAccept) {
          btnAccept.onclick = (e) => {
            e.preventDefault();
            input.value = suggestion;
            suggestionBox.style.display = "none";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          };
        }
        if (btnDismiss) {
          btnDismiss.onclick = (e) => {
            e.preventDefault();
            suggestionBox.style.display = "none";
          };
        }
      } else {
        suggestionBox.style.display = "none";
      }
    };

    // Attach listeners
    input.addEventListener("blur", runCheck);
    // Debounced input check so it helps as the user types without being disruptive
    let debounceTimer;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      if (!input.value || input.value.trim().length === 0) {
        suggestionBox.style.display = "none";
        return;
      }
      debounceTimer = setTimeout(runCheck, 500);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Resets all active spell suggestion banners (used when opening/resetting modals).
 */
export function resetAutomotiveSpellSuggestions() {
  document.querySelectorAll(".spell-suggestion-box").forEach(box => {
    box.style.display = "none";
  });
}

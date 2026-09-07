/**
 * Roadlink Automobiles - Automotive Spell Checking, Make-Aware Models & Quick Feature Chips
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

// Make-Aware Models Dictionary
const MAKE_MODELS_MAP = {
  "Toyota": [
    "Prius", "Premio", "Allion", "Corolla", "Corolla Cross", "Axio", "Fielder",
    "Harrier", "Noah", "Voxy", "Esquire", "Alphard", "Vellfire", "Land Cruiser",
    "Land Cruiser Prado", "RAV4", "Raize", "Yaris", "Yaris Cross", "Aqua", "C-HR",
    "Crown", "Camry", "Hilux", "HiAce", "Sienta", "Roomy", "Tank", "Passo", "Rush"
  ],
  "Honda": [
    "Vezel", "Civic", "CR-V", "Accord", "Grace", "Fit", "Shuttle", "StepWGN",
    "Freed", "Insight", "HR-V", "ZR-V", "Odyssey", "City"
  ],
  "Nissan": [
    "X-Trail", "Note", "Serena", "Juke", "Qashqai", "Kicks", "Leaf",
    "Patrol", "Navara", "Ariya", "Sylphy", "Dayz"
  ],
  "Mazda": [
    "CX-5", "CX-3", "CX-30", "CX-8", "CX-9", "CX-60", "Mazda3", "Mazda6", "Mazda2", "Axela", "Atenza"
  ],
  "Mitsubishi": [
    "Outlander", "Pajero", "Eclipse Cross", "Xpander", "Delica", "Attrage", "L200"
  ],
  "Subaru": [
    "Forester", "XV", "Crosstrek", "Outback", "Levorg", "Impreza", "Legacy"
  ],
  "Lexus": [
    "RX350", "RX450h", "NX200t", "NX300h", "NX350h", "LX570", "LX600", "GX460", "ES300h", "ES350", "UX250h", "LS500h"
  ],
  "Suzuki": [
    "Swift", "Jimny", "Vitara", "Grand Vitara", "Hustler", "Spacia", "Wagon R", "Every"
  ],
  "Daihatsu": [
    "Rocky", "Tanto", "Mira", "Move", "Hijet", "Cast", "Thor"
  ],
  "BMW": [
    "3 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X6", "X7", "4 Series", "iX", "i4"
  ],
  "Mercedes-Benz": [
    "C-Class", "E-Class", "S-Class", "GLA", "GLB", "GLC", "GLE", "GLS", "A-Class", "CLA"
  ],
  "Audi": [
    "A3", "A4", "A5", "A6", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron"
  ],
  "Hyundai": [
    "Tucson", "Santa Fe", "Creta", "Elantra", "Sonata", "Kona", "Ioniq 5", "Palisade"
  ],
  "Kia": [
    "Sportage", "Sorento", "Seltos", "Carnival", "EV6", "Stinger", "Cerato"
  ],
  "Land Rover": [
    "Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque", "Defender", "Discovery"
  ]
};

// Popular Quick-Add Feature Chips
export const POPULAR_FEATURE_CHIPS = [
  "Push Start",
  "Smart Key",
  "Pre-Crash Safety",
  "Lane Departure Alert",
  "360° Panoramic Camera",
  "Reverse Camera",
  "Leather Seats",
  "Power Seats",
  "Seat Heaters",
  "Sunroof / Moonroof",
  "LED Headlights",
  "Adaptive Cruise Control",
  "Parking Sensors",
  "Apple CarPlay / Android Auto",
  "Dual Zone Climate Control",
  "Power Back Door",
  "Modellista Bodykit",
  "EV Mode",
  "Wireless Charger",
  "Alloy Wheels"
];

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
 * Checks a full phrase against automotive vocabulary.
 * Returns suggested correction or null.
 */
export function checkAutomotiveSpell(fieldName, text, context = {}) {
  const raw = (text || "").trim();
  if (!raw || raw.length < 3) return null;

  if (fieldName === "exteriorColor" || fieldName === "interiorColor") {
    const dict = fieldName === "exteriorColor" ? OEM_COLORS : INTERIOR_COLORS;

    // 1. Full phrase check against OEM colors
    for (const oem of dict) {
      if (raw.toLowerCase() === oem.toLowerCase()) {
        return null; // Perfect match
      }
      const dist = levenshteinDistance(raw.toLowerCase(), oem.toLowerCase());
      const allowed = raw.length > 8 ? 2 : 1;
      if (dist > 0 && dist <= allowed) {
        return oem;
      }
    }

    // 2. Word-by-word check against color keywords
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
  } else if (fieldName === "model") {
    // Model Option A: Make-Aware check
    const currentMake = (context.make || "").trim();
    let modelCandidates = [];
    if (currentMake && MAKE_MODELS_MAP[currentMake]) {
      modelCandidates = MAKE_MODELS_MAP[currentMake];
    } else {
      // Look up across all models if make not specifically matched
      for (const key of Object.keys(MAKE_MODELS_MAP)) {
        modelCandidates.push(...MAKE_MODELS_MAP[key]);
      }
    }

    for (const model of modelCandidates) {
      if (raw.toLowerCase() === model.toLowerCase()) return null;
      const dist = levenshteinDistance(raw.toLowerCase(), model.toLowerCase());
      // For model typos e.g. "Prus" (dist 1), "Pruis" (dist 1), "Harer" (dist 2)
      const allowed = raw.length <= 4 ? 1 : 2;
      if (dist > 0 && dist <= allowed) {
        return model;
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
 * Updates the Model datalist suggestions according to the selected Make.
 */
export function updateModelDatalist(makeValue) {
  const modelDatalist = document.getElementById("datalist-models");
  if (!modelDatalist) return;

  modelDatalist.innerHTML = "";
  const make = (makeValue || "").trim();
  let models = [];
  if (make && MAKE_MODELS_MAP[make]) {
    models = MAKE_MODELS_MAP[make];
  } else {
    // If make is empty or custom, populate popular top models
    for (const key of Object.keys(MAKE_MODELS_MAP)) {
      models.push(...MAKE_MODELS_MAP[key]);
    }
  }

  // Deduplicate and append
  const uniqueModels = Array.from(new Set(models));
  uniqueModels.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    modelDatalist.appendChild(opt);
  });
}

/**
 * Initializes Quick-Add Feature Chips (Option 2 for Features)
 */
function initFeaturesQuickChips() {
  const featuresInput = document.getElementById("v-features");
  if (!featuresInput) return;

  const parent = featuresInput.parentNode;
  if (parent.querySelector(".features-quick-chips-wrapper")) return; // Already initialized

  const wrapper = document.createElement("div");
  wrapper.className = "features-quick-chips-wrapper";
  wrapper.style.cssText = `
    margin-top: 10px;
    padding: 12px;
    background: var(--bg-light, #f8fafc);
    border: 1px dashed var(--border-color, #cbd5e1);
    border-radius: var(--radius-sm, 6px);
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  `;
  header.innerHTML = `
    <span style="font-size: 0.78rem; font-weight: 700; color: var(--primary-blue, #1e90ff); text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; gap: 4px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
      Quick-Add Popular Features (Click to toggle)
    </span>
    <span style="font-size: 0.75rem; color: var(--text-muted, #64748b);">Clicking automatically appends to input</span>
  `;
  wrapper.appendChild(header);

  const chipsContainer = document.createElement("div");
  chipsContainer.className = "features-chips-container";
  chipsContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `;

  // Function to sync chip selected state with current features text
  const syncChipsState = () => {
    const currentTokens = (featuresInput.value || "")
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    chipsContainer.querySelectorAll(".feature-chip-btn").forEach(btn => {
      const featureName = btn.getAttribute("data-feature");
      const isSelected = currentTokens.includes(featureName.toLowerCase());
      if (isSelected) {
        btn.style.background = "var(--primary-blue, #1e90ff)";
        btn.style.color = "#ffffff";
        btn.style.borderColor = "var(--primary-blue, #1e90ff)";
        btn.classList.add("selected");
      } else {
        btn.style.background = "#ffffff";
        btn.style.color = "var(--text-body, #334155)";
        btn.style.borderColor = "var(--border-color, #cbd5e1)";
        btn.classList.remove("selected");
      }
    });
  };

  POPULAR_FEATURE_CHIPS.forEach(feature => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "feature-chip-btn";
    chip.setAttribute("data-feature", feature);
    chip.style.cssText = `
      padding: 4px 10px;
      font-size: 0.78rem;
      font-weight: 500;
      background: #ffffff;
      border: 1px solid var(--border-color, #cbd5e1);
      border-radius: 20px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
      white-space: nowrap;
    `;
    chip.textContent = `+ ${feature}`;

    chip.addEventListener("click", (e) => {
      e.preventDefault();
      const currentList = (featuresInput.value || "")
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);

      const existingIndex = currentList.findIndex(t => t.toLowerCase() === feature.toLowerCase());

      if (existingIndex >= 0) {
        // Remove feature
        currentList.splice(existingIndex, 1);
      } else {
        // Add feature
        currentList.push(feature);
      }

      featuresInput.value = currentList.join(", ");
      featuresInput.dispatchEvent(new Event("input", { bubbles: true }));
      featuresInput.dispatchEvent(new Event("change", { bubbles: true }));
      syncChipsState();
    });

    chipsContainer.appendChild(chip);
  });

  wrapper.appendChild(chipsContainer);
  parent.appendChild(wrapper);

  // Sync chips state whenever features input changes
  featuresInput.addEventListener("input", syncChipsState);
  featuresInput.addEventListener("change", syncChipsState);
}

/**
 * Attaches the spell-checker and suggestion UI to the target vehicle form fields.
 */
export function initAutomotiveSpellChecker() {
  const fieldsToCheck = [
    { id: "v-ext-color", name: "exteriorColor", listId: "datalist-ext-colors", suggestions: OEM_COLORS },
    { id: "v-int-color", name: "interiorColor", listId: "datalist-int-colors", suggestions: INTERIOR_COLORS },
    { id: "v-make", name: "make", listId: "datalist-makes", suggestions: POPULAR_MAKES },
    { id: "v-model", name: "model", listId: "datalist-models", suggestions: [] },
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
      const makeInput = document.getElementById("v-make");
      const context = {
        make: makeInput ? makeInput.value : ""
      };
      const suggestion = checkAutomotiveSpell(cfg.name, val, context);

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

  // Make change listener: dynamically updates the model datalist when Make changes
  const makeInput = document.getElementById("v-make");
  if (makeInput) {
    makeInput.addEventListener("input", () => {
      updateModelDatalist(makeInput.value);
    });
    makeInput.addEventListener("change", () => {
      updateModelDatalist(makeInput.value);
    });
    // Initial call
    updateModelDatalist(makeInput.value);
  }

  // Initialize Option 2: Quick-Add Feature Chips
  initFeaturesQuickChips();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Resets all active spell suggestion banners and syncs quick chips (used when opening/resetting modals).
 */
export function resetAutomotiveSpellSuggestions() {
  document.querySelectorAll(".spell-suggestion-box").forEach(box => {
    box.style.display = "none";
  });

  // Re-sync Make-aware model datalist
  const makeInput = document.getElementById("v-make");
  if (makeInput) {
    updateModelDatalist(makeInput.value);
  }

  // Re-sync feature chips
  const featuresInput = document.getElementById("v-features");
  if (featuresInput) {
    featuresInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

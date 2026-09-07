/**
 * Roadlink Automobiles - Automotive Spell Checking, Make-Aware Models & Quick Feature Chips
 * Robust, confidence-ranked automotive typo detection engine.
 * Philosophy: Obvious Typo -> Help the User. Uncertain / Custom Value -> Leave it alone.
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
  "Silver Metallic", "Metallic Silver", "Celestial Silver Metallic", "Atomic Silver", "Sonic Silver",
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

// Drive types (canonical)
const DRIVE_TYPES = ["2WD", "4WD", "AWD", "FWD", "RHD", "LHD"];

// Fuel types (canonical)
const FUEL_TYPES = [
  "Hybrid", "Petrol", "Octane", "Diesel", "Electric",
  "Plug-in Hybrid (PHEV)", "CNG", "LPG"
];

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
 * Lightweight string normalization for comparison.
 * Collapses whitespace, strips surrounding punctuation, and lowercases.
 * Normalization is for comparison only; does NOT alter user input.
 */
export function normalizeForCompare(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[\-_]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Damerau-Levenshtein Distance.
 * Counts insertions, deletions, substitutions, and adjacent transpositions (e.g. "Pruis" <-> "Prius" is 1 edit).
 */
export function damerauLevenshteinDistance(s1, s2) {
  const a = String(s1 || "").toLowerCase();
  const b = String(s2 || "").toLowerCase();
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  // Initialize matrix
  const d = [];
  for (let i = 0; i <= lenA; i++) {
    d[i] = new Array(lenB + 1).fill(0);
    d[i][0] = i;
  }
  for (let j = 0; j <= lenB; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition check
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[lenA][lenB];
}

/**
 * Resolves a make string (case-insensitive, normalized) to a canonical Make name.
 */
export function resolveCanonicalMake(makeInput) {
  const norm = normalizeForCompare(makeInput);
  if (!norm) return null;
  for (const make of POPULAR_MAKES) {
    if (normalizeForCompare(make) === norm) {
      return make;
    }
  }
  return null;
}

/**
 * Evaluates a list of dictionary candidates against an input string.
 * Ranks all candidates by distance and similarity, enforces minimum confidence,
 * and performs an ambiguity separation check (separation >= 1 between best and 2nd best).
 *
 * @param {string} input - User input string
 * @param {string[]} candidates - Array of canonical candidate strings
 * @param {object} options - Policy thresholds
 * @returns {string|null} - Best candidate or null if ambiguous / low confidence / identical
 */
function rankAndSelectCandidate(input, candidates, options = {}) {
  const raw = String(input || "").trim();
  const normInput = normalizeForCompare(raw);
  if (!normInput || normInput.length < (options.minInputLen || 3)) {
    return null;
  }

  // Exact match (case-insensitive / normalized) -> No suggestion needed
  for (const cand of candidates) {
    if (normalizeForCompare(cand) === normInput) {
      return null;
    }
  }

  const scored = [];

  for (const cand of candidates) {
    const normCand = normalizeForCompare(cand);
    const dist = damerauLevenshteinDistance(normInput, normCand);
    const maxLen = Math.max(normInput.length, normCand.length);
    const similarity = 1 - (dist / maxLen);

    // Length-adaptive maximum distance ceiling (based on either input or candidate length)
    const effectiveLen = Math.max(normInput.length, normCand.length);
    let maxAllowedDist = 1;
    if (options.field === "drive") {
      maxAllowedDist = 1;
    } else if (effectiveLen >= 10) {
      maxAllowedDist = options.maxDist10Plus || 2;
    } else if (effectiveLen >= 6) {
      maxAllowedDist = options.maxDist6Plus || 2;
    } else if (effectiveLen >= 4) {
      maxAllowedDist = options.maxDist4Plus || 1;
    } else {
      maxAllowedDist = 1;
    }

    // Min similarity floor
    const minSimFloor = options.minSimilarity || 0.65;

    if (dist <= maxAllowedDist && similarity >= minSimFloor) {
      scored.push({
        candidate: cand,
        dist,
        similarity,
        lenDiff: Math.abs(normInput.length - normCand.length)
      });
    }
  }

  if (scored.length === 0) {
    return null;
  }

  // Sort: lowest distance first, then highest similarity, then minimal length difference
  scored.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    return a.lenDiff - b.lenDiff;
  });

  const best = scored[0];

  // Ambiguity check: If 2nd candidate has identical distance or is nearly equally close,
  // do NOT guess. A suggestion requires clear separation.
  if (scored.length > 1) {
    const second = scored[1];
    const distGap = second.dist - best.dist;
    const simGap = best.similarity - second.similarity;

    // Zero distance gap means identical edit distance to two different candidates (e.g. "Cat" -> "Car" or "Cap")
    if (distGap === 0) {
      return null;
    }
    // For short inputs (<= 5 chars), require at least 0.15 similarity gap if distance difference is 1
    if (normInput.length <= 5 && distGap < 2 && simGap < 0.15) {
      return null;
    }
  }

  return best.candidate;
}

/**
 * Checks a single word against COLOR_KEYWORDS using conservative ranking.
 */
function rankColorKeyword(word) {
  const norm = normalizeForCompare(word);
  if (!norm || norm.length < 4) return null;

  for (const kw of COLOR_KEYWORDS) {
    if (normalizeForCompare(kw) === norm) return null; // already correct
  }

  // Find best candidate from COLOR_KEYWORDS
  return rankAndSelectCandidate(word, COLOR_KEYWORDS, {
    field: "colorKeyword",
    minInputLen: 4,
    maxDist4Plus: 1,
    maxDist6Plus: 1,
    maxDist10Plus: 2,
    minSimilarity: 0.72
  });
}

/**
 * Checks a full phrase against automotive vocabulary.
 * Returns suggested correction or null.
 *
 * @param {string} fieldName - Field identifier e.g. "make", "model", "exteriorColor"
 * @param {string} text - The input text to check
 * @param {object} context - Additional form context e.g. { make: "Toyota" }
 * @returns {string|null} - Canonical suggestion or null
 */
export function checkAutomotiveSpell(fieldName, text, context = {}) {
  const raw = String(text || "").trim();
  const norm = normalizeForCompare(raw);
  if (!norm || norm.length < 2) return null;

  // 1. MAKE
  if (fieldName === "make") {
    return rankAndSelectCandidate(raw, POPULAR_MAKES, {
      field: "make",
      minInputLen: 4,
      maxDist4Plus: 1,
      maxDist6Plus: 2,
      maxDist10Plus: 2,
      minSimilarity: 0.72
    });
  }

  // 2. MODEL (Make-Aware)
  if (fieldName === "model") {
    const canonicalMake = resolveCanonicalMake(context.make);

    let candidates = [];
    if (canonicalMake && MAKE_MODELS_MAP[canonicalMake]) {
      // STRICT MAKE-AWARE: Only evaluate models of the selected make
      candidates = MAKE_MODELS_MAP[canonicalMake];
    } else if (!context.make || context.make.trim().length === 0) {
      // If no make is provided, evaluate across all known models
      const all = [];
      for (const key of Object.keys(MAKE_MODELS_MAP)) {
        all.push(...MAKE_MODELS_MAP[key]);
      }
      candidates = Array.from(new Set(all));
    } else {
      // An unknown / custom Make was entered (e.g. "Lucid", "Rivian", or custom brand).
      // DO NOT search unrelated Toyota/Honda models! Leave the user's input alone.
      return null;
    }

    return rankAndSelectCandidate(raw, candidates, {
      field: "model",
      minInputLen: 3,
      maxDist4Plus: 1,
      maxDist6Plus: 2,
      maxDist10Plus: 2,
      minSimilarity: 0.68
    });
  }

  // 3. EXTERIOR / INTERIOR COLOR
  if (fieldName === "exteriorColor" || fieldName === "interiorColor") {
    const dict = fieldName === "exteriorColor" ? OEM_COLORS : INTERIOR_COLORS;

    // A. First evaluate full-phrase against OEM colors (ranks all candidates)
    const oemMatch = rankAndSelectCandidate(raw, dict, {
      field: "colorFull",
      minInputLen: 4,
      maxDist4Plus: 1,
      maxDist6Plus: 2,
      maxDist10Plus: 2,
      minSimilarity: 0.75
    });

    if (oemMatch) {
      return oemMatch;
    }

    // B. Word-by-word conservative check on color keywords
    // Only corrects clear single-word typos in multi-word custom colors
    // e.g. "Sonic Blue Pear" -> "Sonic Blue Pearl", "Metalic Black" -> "Metallic Black"
    // Leaves unknown phrases like "Custom Pearl" or "Special Edition" intact!
    const words = raw.split(/\s+/);
    if (words.length >= 1) {
      let correctedAny = false;
      const correctedWords = words.map(w => {
        const kwMatch = rankColorKeyword(w);
        if (kwMatch) {
          correctedAny = true;
          return kwMatch;
        }
        return w;
      });

      if (correctedAny) {
        return correctedWords.join(" ");
      }
    }

    return null;
  }

  // 4. FUEL
  if (fieldName === "fuel") {
    return rankAndSelectCandidate(raw, FUEL_TYPES, {
      field: "fuel",
      minInputLen: 3,
      maxDist4Plus: 1,
      maxDist6Plus: 1,
      maxDist10Plus: 2,
      minSimilarity: 0.72
    });
  }

  // 5. DRIVE
  if (fieldName === "drive") {
    // Very short acronyms (2WD, 4WD, AWD, etc.):
    // Input must be at least 3 characters. For drive acronyms, length difference cannot exceed 1.
    // e.g. "4WDD" -> "4WD", but incomplete "2W" -> null
    return rankAndSelectCandidate(raw, DRIVE_TYPES, {
      field: "drive",
      minInputLen: 3,
      maxDist4Plus: 1,
      maxDist6Plus: 1,
      maxDist10Plus: 1,
      minSimilarity: 0.75
    });
  }

  return null;
}

/**
 * Updates the Model datalist suggestions according to the selected Make.
 * Resolves Make case-insensitively and avoids unrelated models.
 */
export function updateModelDatalist(makeValue) {
  const modelDatalist = document.getElementById("datalist-models");
  if (!modelDatalist) return;

  modelDatalist.innerHTML = "";
  const canonicalMake = resolveCanonicalMake(makeValue);

  let models = [];
  if (canonicalMake && MAKE_MODELS_MAP[canonicalMake]) {
    models = MAKE_MODELS_MAP[canonicalMake];
  } else if (!makeValue || makeValue.trim().length === 0) {
    // Top models across all makes when empty
    for (const key of Object.keys(MAKE_MODELS_MAP)) {
      models.push(...MAKE_MODELS_MAP[key]);
    }
  } else {
    // User entered an unrecognized or custom Make - do not pollute with unrelated models
    models = [];
  }

  const uniqueModels = Array.from(new Set(models));
  uniqueModels.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    modelDatalist.appendChild(opt);
  });
}

/**
 * Initializes Quick-Add Feature Chips (Option 2 for Features)
 * Guarded against duplicate initialization.
 */
function initFeaturesQuickChips() {
  const featuresInput = document.getElementById("v-features");
  if (!featuresInput) return;

  const parent = featuresInput.parentNode;
  if (parent.querySelector(".features-quick-chips-wrapper")) {
    return; // Already initialized, guard against duplicate wrappers
  }

  const wrapper = document.createElement("div");
  wrapper.className = "features-quick-chips-wrapper";

  const header = document.createElement("div");
  header.className = "features-quick-chips-header";
  header.innerHTML = `
    <span class="features-quick-chips-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
      Quick-Add Popular Features (Click to toggle)
    </span>
    <span class="features-quick-chips-sub">Clicking automatically appends to input</span>
  `;
  wrapper.appendChild(header);

  const chipsContainer = document.createElement("div");
  chipsContainer.className = "features-chips-container";

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
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });
  };

  POPULAR_FEATURE_CHIPS.forEach(feature => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "feature-chip-btn";
    chip.setAttribute("data-feature", feature);
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

// Global flag to guard against multiple calls to initAutomotiveSpellChecker()
let spellCheckerInitialized = false;

/**
 * Attaches the spell-checker and suggestion UI to the target vehicle form fields.
 * Safe against repeated execution in modal / navigation lifecycles.
 */
export function initAutomotiveSpellChecker() {
  if (spellCheckerInitialized) {
    return;
  }
  spellCheckerInitialized = true;

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

    // 2. Prepare container for suggestion pill (re-use existing if present)
    let suggestionBox = input.parentNode.querySelector(`.spell-suggestion-box[data-for="${cfg.id}"]`);
    if (!suggestionBox) {
      suggestionBox = document.createElement("div");
      suggestionBox.className = "spell-suggestion-box";
      suggestionBox.setAttribute("data-for", cfg.id);
      input.parentNode.appendChild(suggestionBox);
    }

    // Per-input state: track dismissed values and active debounce token to eliminate stale results
    let dismissedValue = null;
    let latestCheckToken = 0;
    let debounceTimer = null;

    const runCheck = () => {
      const currentVal = input.value;
      const currentToken = ++latestCheckToken;

      // Stale check: if input is empty or has changed, hide suggestion
      if (!currentVal || currentVal.trim().length === 0) {
        suggestionBox.style.display = "none";
        return;
      }

      // Dismiss check: if user dismissed suggestion for this exact input string, do not show again
      if (dismissedValue && dismissedValue === currentVal.trim()) {
        suggestionBox.style.display = "none";
        return;
      }

      const makeInput = document.getElementById("v-make");
      const context = {
        make: makeInput ? makeInput.value : ""
      };

      const suggestion = checkAutomotiveSpell(cfg.name, currentVal, context);

      // Verify token hasn't become stale during execution
      if (currentToken !== latestCheckToken) {
        return;
      }

      // Verify input hasn't changed since check was requested
      if (input.value !== currentVal) {
        return;
      }

      if (suggestion && normalizeForCompare(suggestion) !== normalizeForCompare(currentVal)) {
        // Safe DOM insertion: escape text to prevent any XSS vulnerability
        suggestionBox.innerHTML = `
          <div class="spell-suggestion-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spell-icon"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span>Did you mean <strong>${escapeHtml(suggestion)}</strong>?</span>
          </div>
          <div class="spell-actions">
            <button type="button" class="btn-accept-spell">
              Accept
            </button>
            <button type="button" class="btn-dismiss-spell" title="Dismiss suggestion">
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
            dismissedValue = null; // Clear dismissal for newly accepted value
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          };
        }

        if (btnDismiss) {
          btnDismiss.onclick = (e) => {
            e.preventDefault();
            dismissedValue = currentVal.trim();
            suggestionBox.style.display = "none";
          };
        }
      } else {
        suggestionBox.style.display = "none";
      }
    };

    // Blur listener: triggers immediately when user finishes editing field
    input.addEventListener("blur", runCheck);

    // Input listener: debounced typing check
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      // Reset dismissal state if input text changed away from dismissed string
      if (dismissedValue && dismissedValue !== input.value.trim()) {
        dismissedValue = null;
      }

      if (!input.value || input.value.trim().length === 0) {
        latestCheckToken++;
        suggestionBox.style.display = "none";
        return;
      }

      debounceTimer = setTimeout(runCheck, 400);
    });
  });

  // Make change listener: dynamically updates the model datalist when Make changes
  const makeInput = document.getElementById("v-make");
  if (makeInput) {
    const onMakeChange = () => {
      updateModelDatalist(makeInput.value);
      // Re-evaluate model if model already has text
      const modelInput = document.getElementById("v-model");
      if (modelInput && modelInput.value) {
        modelInput.dispatchEvent(new Event("blur"));
      }
    };

    makeInput.addEventListener("input", onMakeChange);
    makeInput.addEventListener("change", onMakeChange);
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

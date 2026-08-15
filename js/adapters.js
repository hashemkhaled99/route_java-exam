// ============================================================
// adapters.js — normalize NutriPlan API responses
// Shapes verified against live API + OpenAPI (api-docs).
// ============================================================

/** Return the first defined value among several possible object paths. */
function pick(obj, paths, fallback = undefined) {
  for (const p of paths) {
    const val = p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return fallback;
}

/** Unwrap {results:[...]}, {data:[...]}, {meals:[...]} or a bare array. */
function unwrapList(raw, keys = ["results", "meals", "data", "items", "products"]) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  for (const k of keys) if (Array.isArray(raw[k])) return raw[k];
  return [];
}

function unwrapPagination(raw) {
  const p = raw?.pagination || raw?.meta || {};
  return {
    page: pick(p, ["currentPage", "page"], 1),
    limit: pick(p, ["limit", "pageSize"], 25),
    total: pick(p, ["total", "totalItems", "count"], undefined),
    totalPages: pick(p, ["totalPages", "pages"], undefined),
  };
}

function normalizeInstructions(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("\n\n");
  return value || "";
}

// ---------------- Meals ----------------

/** Normalize one raw meal object (list item or full detail). */
export function adaptMeal(raw) {
  if (!raw) return null;
  // Single-meal endpoints wrap as { result: Meal }
  if (raw.result && typeof raw.result === "object" && !Array.isArray(raw.result)) {
    raw = raw.result;
  } else if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) && (raw.data.id || raw.data.name)) {
    raw = raw.data;
  } else if (raw.meal && typeof raw.meal === "object") {
    raw = raw.meal;
  }

  let ingredients = pick(raw, ["ingredients"]);
  if (!Array.isArray(ingredients)) {
    ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const name = raw[`strIngredient${i}`];
      const measure = raw[`strMeasure${i}`];
      if (name && String(name).trim()) {
        ingredients.push({ name: String(name).trim(), measure: String(measure || "").trim() });
      }
    }
  } else {
    ingredients = ingredients.map((ing) => ({
      name: pick(ing, ["name", "ingredient", "strIngredient"], ""),
      measure: pick(ing, ["measure", "quantity", "strMeasure"], ""),
    }));
  }

  return {
    id: String(pick(raw, ["id", "idMeal", "_id"], "")),
    name: pick(raw, ["name", "strMeal", "title"], "Untitled meal"),
    category: pick(raw, ["category", "strCategory"], ""),
    area: pick(raw, ["area", "strArea", "cuisine"], ""),
    thumbnail: pick(raw, ["thumbnail", "strMealThumb", "image", "thumb"], ""),
    instructions: normalizeInstructions(pick(raw, ["instructions", "strInstructions"], "")),
    video: pick(raw, ["youtube", "video", "strYoutube"], ""),
    tags: pick(raw, ["tags", "strTags"], "") || "",
    ingredients,
  };
}

export function adaptMealList(raw) {
  const list = unwrapList(raw, ["results", "meals", "data"]).map(adaptMeal).filter((m) => m && m.id);
  return { meals: list, pagination: unwrapPagination(raw) };
}

/** categories / areas — array of strings or { name } objects */
export function adaptStringList(raw, key) {
  const list = unwrapList(raw, [key, "results", "data", "categories", "areas"]);
  return list
    .map((item) => (typeof item === "string" ? item : pick(item, ["name", "strCategory", "strArea", "category", "area"], "")))
    .filter(Boolean);
}

/** Product categories need both id (API path) and display name */
export function adaptCategoryList(raw) {
  const list = unwrapList(raw, ["results", "categories", "data"]);
  return list
    .map((item) => {
      if (typeof item === "string") return { id: item, name: item };
      const id = String(pick(item, ["id", "slug"], "") || "");
      const name = pick(item, ["name", "label"], "") || id;
      return id ? { id, name } : null;
    })
    .filter(Boolean);
}

// ---------------- Nutrition ----------------

export function adaptNutrition(raw) {
  const data = raw?.data && typeof raw.data === "object" ? raw.data : raw;
  // Prefer recipe totals; fall back to per-serving if totals are missing/zero
  const totals = pick(data, ["totals", "nutritionTotals", "nutrition", "total"], null);
  const perServing = pick(data, ["perServing", "per_serving"], null);
  const source =
    totals && hasMacroValues(totals) ? totals : perServing && hasMacroValues(perServing) ? perServing : totals || perServing || data || {};

  return {
    calories: Number(pick(source, ["calories", "kcal", "energy"], 0)) || 0,
    protein: Number(pick(source, ["protein", "proteins", "protein_g"], 0)) || 0,
    carbs: Number(pick(source, ["carbs", "carbohydrates", "carbohydrate", "carbs_g"], 0)) || 0,
    fat: Number(pick(source, ["fat", "fats", "totalFat", "fat_g"], 0)) || 0,
  };
}

function hasMacroValues(obj) {
  if (!obj || typeof obj !== "object") return false;
  return ["calories", "kcal", "protein", "carbs", "carbohydrates", "fat"].some((k) => Number(obj[k]) > 0);
}

// ---------------- Products ----------------

export function adaptProduct(raw) {
  if (!raw) return null;
  if (raw.result && typeof raw.result === "object" && !Array.isArray(raw.result)) raw = raw.result;
  else if (raw.product && typeof raw.product === "object") raw = raw.product;

  const nutriments = pick(raw, ["nutrients", "nutriments", "nutrition"], {}) || {};
  const grade = String(
    pick(raw, ["nutritionGrade", "nutriScore", "nutrition_grade", "nutriscore_grade", "grade"], "") || ""
  ).toUpperCase();
  const nutriScore = /^[A-E]$/.test(grade) ? grade : "";

  return {
    code: String(pick(raw, ["barcode", "code", "id", "_id"], "")),
    name: pick(raw, ["name", "product_name", "title"], "Unknown product"),
    brand: pick(raw, ["brand", "brands"], ""),
    image: pick(raw, ["image", "image_url", "imageUrl", "photo"], ""),
    category: pick(raw, ["category", "categories"], ""),
    nutriScore,
    nutrition: {
      calories: Number(pick(nutriments, ["calories", "energy_kcal_100g", "energy-kcal_100g", "kcal"], 0)) || 0,
      protein: Number(pick(nutriments, ["protein", "proteins_100g"], 0)) || 0,
      carbs: Number(pick(nutriments, ["carbs", "carbohydrates_100g"], 0)) || 0,
      fat: Number(pick(nutriments, ["fat", "fat_100g"], 0)) || 0,
    },
  };
}

export function adaptProductList(raw) {
  const list = unwrapList(raw, ["results", "products", "data"]).map(adaptProduct).filter((p) => p && p.code);
  return { products: list, pagination: unwrapPagination(raw) };
}

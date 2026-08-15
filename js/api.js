// ============================================================
// api.js — NutriPlan API client
// Base + endpoints aligned with Swagger:
//   https://nutriplan-api.vercel.app/api-docs/
//
// Meals:     GET /meals/search|filter|random|categories|areas|/{id}
// Nutrition: POST /nutrition/analyze  (header: x-api-key)
// Products:  GET /products/search|categories|category/{cat}|barcode/{code}
// ============================================================

const BASE_URL = "https://nutriplan-api.vercel.app/api";

// USDA key for POST /nutrition/analyze (Swagger security: ApiKeyAuth / x-api-key)
// Free key: https://fdc.nal.usda.gov/api-key-signup.html
const USDA_API_KEY = "2YrKHH3cGwYkDtzuAq7SNdKiiBLetAImjp2cMh6q";
const USDA_KEY_STORAGE = "nutriplan_usda_key";

export function getUsdaApiKey() {
  try {
    const stored = localStorage.getItem(USDA_KEY_STORAGE);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    /* ignore */
  }
  return USDA_API_KEY;
}

export function setUsdaApiKey(key) {
  const value = String(key || "").trim();
  if (!value) {
    localStorage.removeItem(USDA_KEY_STORAGE);
    return;
  }
  localStorage.setItem(USDA_KEY_STORAGE, value);
}

export function hasUsdaApiKey() {
  const key = getUsdaApiKey();
  return Boolean(key) && key !== "YOUR_USDA_API_KEY";
}

let lastRequestAt = 0;
const MIN_GAP_MS = 150;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, { method = "GET", params, body, headers } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const usp = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );
    const qs = usp.toString();
    if (qs) url += `?${qs}`;
  }

  // Soft throttle + retry: upstream wraps OpenFoodFacts/MealDB 429 as HTTP 500
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const gap = MIN_GAP_MS - (Date.now() - lastRequestAt);
    if (gap > 0) await sleep(gap);
    lastRequestAt = Date.now();

    const res = await fetch(url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }

    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }

    const rateLimited = res.status === 429 || /"status code 429"|too many requests/i.test(detail);
    lastError = new Error(`API ${res.status} on ${path} ${detail}`);
    if (rateLimited && attempt < 2) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

// ---------------- Meals (Swagger: Meals tag) ----------------
export const MealsAPI = {
  /** GET /meals/search?q= */
  search: (q, { limit = 25 } = {}) => request("/meals/search", { params: { q, limit } }),

  /** GET /meals/filter?category=&area=&ingredient=&limit= */
  filter: ({ category, area, ingredient, limit = 25 } = {}) =>
    request("/meals/filter", { params: { category, area, ingredient, limit } }),

  /** GET /meals/{id} → { result: Meal } */
  getById: (id) => request(`/meals/${id}`),

  /** GET /meals/random?count=  (used for home "All Cuisines" — bare filter returns 500) */
  random: ({ count = 1 } = {}) => request("/meals/random", { params: { count } }),

  /** GET /meals/categories */
  categories: () => request("/meals/categories"),

  /** GET /meals/areas */
  areas: () => request("/meals/areas"),
};

// ---------------- Nutrition (Swagger: Nutrition tag) ----------------
export const NutritionAPI = {
  /**
   * POST /nutrition/analyze
   * Body: { recipeName?, ingredients: string[] }  (AnalyzeRequest)
   * Header: x-api-key
   */
  analyze: (recipeName, ingredients) =>
    request("/nutrition/analyze", {
      method: "POST",
      headers: { "x-api-key": getUsdaApiKey() },
      body: { recipeName, ingredients },
    }),
};

// ---------------- Products (Swagger: Products tag) ----------------
export const ProductsAPI = {
  /** GET /products/search?q= */
  search: (q, { limit = 20 } = {}) => request("/products/search", { params: { q, limit } }),

  /** GET /products/barcode/{code} → { result: Product } */
  byBarcode: (code) => request(`/products/barcode/${encodeURIComponent(code)}`),

  /** GET /products/categories?page=&limit= */
  categories: ({ page = 1, limit = 50 } = {}) =>
    request("/products/categories", { params: { page, limit } }),

  /** GET /products/category/{category}?page=&limit= */
  byCategory: (category, { page = 1, limit = 20 } = {}) =>
    request(`/products/category/${encodeURIComponent(category)}`, { params: { page, limit } }),
};

export { BASE_URL };

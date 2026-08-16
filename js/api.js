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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Serialize all calls — parallel clicks were stacking into upstream 429s
let queue = Promise.resolve();
let lastRequestAt = 0;
const MIN_GAP_MS = 450;
const MAX_ATTEMPTS = 5;

/** Short-lived GET cache so re-clicking a cuisine doesn't re-hit the API. */
const getCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(method, url) {
  return `${method}:${url}`;
}

function getCached(key) {
  const hit = getCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    getCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key, data) {
  getCache.set(key, { at: Date.now(), data });
}

function isRateLimited(status, detail) {
  return status === 429 || /"status code 429"|too many requests/i.test(detail || "");
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

  const key = cacheKey(method, url);
  if (method === "GET") {
    const cached = getCached(key);
    if (cached !== null) return cached;
  }

  const run = async () => {
    let lastError;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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
        const data = text ? JSON.parse(text) : null;
        if (method === "GET") setCached(key, data);
        return data;
      }

      let detail = "";
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        /* ignore */
      }

      lastError = new Error(`API ${res.status} on ${path} ${detail}`);
      // Upstream wraps MealDB/OFF 429 as HTTP 500 with "status code 429" in body
      if (isRateLimited(res.status, detail) && attempt < MAX_ATTEMPTS - 1) {
        await sleep(800 * 2 ** attempt); // 0.8s, 1.6s, 3.2s, 6.4s
        continue;
      }
      throw lastError;
    }
    throw lastError;
  };

  // Chain onto the queue so only one in-flight request at a time
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
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

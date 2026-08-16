import { ProductsAPI } from "../api.js";
import { adaptProduct, adaptProductList } from "../adapters.js";
import { qs, escapeHtml, fmt, nutriScoreColor, showToast } from "../utils.js";
import { FoodLog } from "../storage.js";

let state = {
  scoreFilter: "",
  products: [],
  loading: false,
  searched: false,
  error: null,
  nameQuery: "",
  barcodeQuery: "",
  activeCategory: "",
};

/** Curated category chips matching the design mockup */
const BROWSE_CATEGORIES = [
  { id: "breakfast-cereals", name: "Breakfast Cereals", icon: "fa-wheat-awn", color: "#f97316" },
  { id: "beverages", name: "Beverages", icon: "fa-bottle-water", color: "#06b6d4" },
  { id: "snacks", name: "Snacks", icon: "fa-cookie", color: "#ec4899" },
  { id: "dairies", name: "Dairy Products", icon: "fa-cheese", color: "#3b82f6" },
  { id: "fruits", name: "Fruits", icon: "fa-apple-whole", color: "#ef4444" },
  { id: "vegetables", name: "Vegetables", icon: "fa-carrot", color: "#22c55e" },
  { id: "breads", name: "Breads", icon: "fa-bread-slice", color: "#ca8a04" },
  { id: "meats", name: "Meats", icon: "fa-drumstick-bite", color: "#b91c1c" },
];

/** Categories that usually include Nutri-Score A / B products */
const SCORE_BROWSE = {
  A: "fruits",
  B: "yogurts",
  C: "snacks",
  D: "snacks",
  E: "sodas",
};

const SCORE_COLORS = {
  A: "#16a34a",
  B: "#65a30d",
  C: "#eab308",
  D: "#f97316",
  E: "#ef4444",
};

export async function renderProductScanner(container) {
  state = { ...state, products: [], searched: false, error: null, activeCategory: "" };
  paint(container);
}

function paint(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Product Scanner</h1>
      <p>Search packaged foods by name or barcode</p>
    </div>

    <div class="scanner-panel">
      <h2><i class="fa-solid fa-barcode"></i> Product Search &amp; Barcode Scanner</h2>
      <p>Search for packaged food products to view nutrition information</p>

      <div class="scanner-input-row">
        <div class="scanner-field">
          <input id="productNameInput" type="text" placeholder="Search by product name (e.g., Cheerios, Nutella, Coca-Cola…)" value="${escapeHtml(state.nameQuery)}" />
          <i class="fa-solid fa-magnifying-glass field-icon"></i>
        </div>
        <button id="searchProductBtn" class="btn-scanner-search">Search</button>
      </div>
      <div class="scanner-or">or</div>
      <div class="scanner-input-row">
        <div class="scanner-field">
          <input id="barcodeInput" type="text" placeholder="Enter barcode number (e.g., 7613034626844)" inputmode="numeric" value="${escapeHtml(state.barcodeQuery)}" />
          <i class="fa-solid fa-barcode field-icon"></i>
        </div>
        <button id="lookupBarcodeBtn" class="btn-orange"><i class="fa-solid fa-magnifying-glass"></i> Lookup</button>
      </div>
    </div>

    <div class="scanner-filters">
      <div class="filter-label">Filter by Nutri-Score:</div>
      <div class="chip-row score-row" id="scoreChips">
        ${["All", "A", "B", "C", "D", "E"]
          .map((s) => {
            const val = s === "All" ? "" : s;
            const active = state.scoreFilter === val;
            const bg = val ? SCORE_COLORS[val] : "#6b7280";
            const allClass = s === "All" ? " all-chip" : "";
            return `<button type="button" class="score-chip${allClass}${active ? " active" : ""}" data-score="${val}"
                      style="background:${bg};color:#fff;border-color:transparent;${active ? "box-shadow:0 0 0 3px rgba(0,0,0,.12);transform:scale(1.06);" : "opacity:.85;"}">${s}</button>`;
          })
          .join("")}
      </div>
    </div>

    <div class="section-head"><h2 style="margin:0;">Browse by Category</h2></div>
    <div class="chip-row cat-browse-row" id="catChips">
      ${BROWSE_CATEGORIES.map(
        (c) => `
        <button type="button" class="cat-pill${state.activeCategory === c.id ? " active" : ""}" data-cat="${escapeHtml(c.id)}" style="background:${c.color}">
          <i class="fa-solid ${c.icon}"></i> ${escapeHtml(c.name)}
        </button>`
      ).join("")}
    </div>

    ${!state.searched && !state.loading ? `<p class="scanner-hint">Search for products to see results</p>` : ""}

    <div id="productResults">${renderResults()}</div>
  `;

  bindEvents(container);
}

function filteredProducts() {
  if (!state.scoreFilter) return state.products;
  return state.products.filter((p) => p.nutriScore === state.scoreFilter);
}

function renderResults() {
  if (state.loading) {
    return `<div class="spinner"></div>`;
  }
  if (state.error) {
    return `<div class="state-box"><div class="state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h4>Something went wrong</h4><p>${escapeHtml(state.error)}</p></div>`;
  }
  if (!state.searched) {
    return `<div class="state-box"><div class="state-icon"><i class="fa-solid fa-box-open"></i></div><h4>No products to display</h4><p>Search for a product or browse by category</p></div>`;
  }
  const filtered = filteredProducts();

  if (!filtered.length) {
    const scoreHint = state.scoreFilter
      ? `No Nutri-Score ${escapeHtml(state.scoreFilter)} products in these results. Try another search or category.`
      : "Try another name, barcode, or Nutri-Score filter.";
    return `<div class="state-box"><div class="state-icon"><i class="fa-solid fa-box-open"></i></div><h4>No products found</h4><p>${scoreHint}</p></div>`;
  }
  return `<div class="product-results">${filtered.map(productCard).join("")}</div>`;
}

function productCard(p) {
  return `
    <div class="product-card" data-code="${escapeHtml(p.code)}">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.src='https://placehold.co/120x120/e8eaed/9ca3af?text=No+Img'"/>
      <div style="flex:1;min-width:0;">
        <div class="pname">${escapeHtml(p.name)}</div>
        <div class="pbrand">${escapeHtml(p.brand || "Unknown brand")}</div>
        <div class="pmacros">
          <span><i class="fa-solid fa-fire" style="color:var(--brand)"></i> ${fmt(p.nutrition.calories)} kcal</span>
          <span>P ${fmt(p.nutrition.protein)}g</span>
          <span>C ${fmt(p.nutrition.carbs)}g</span>
          <span>F ${fmt(p.nutrition.fat)}g</span>
        </div>
      </div>
      ${p.nutriScore ? `<div class="score-chip active" style="background:${nutriScoreColor(p.nutriScore)};color:#fff;border:none">${escapeHtml(p.nutriScore)}</div>` : ""}
      <button class="btn-brand log-product-btn" style="flex-shrink:0;"><i class="fa-solid fa-plus"></i> Log</button>
    </div>`;
}

async function runSearch(container, fn) {
  state.loading = true;
  state.error = null;
  paint(container);
  try {
    const raw = await fn();
    let products;
    if (Array.isArray(raw) || raw?.products || raw?.data || raw?.results) {
      products = adaptProductList(raw).products;
      const withMacros = products.filter(hasMacroData);
      products = withMacros.length ? withMacros : products;
    } else {
      const single = adaptProduct(raw);
      products = single?.code ? [single] : [];
    }
    state.products = products;
    state.searched = true;
  } catch (err) {
    console.error(err);
    state.error = "Couldn't fetch that product. Please check the name/barcode and try again.";
    state.products = [];
    state.searched = true;
  } finally {
    state.loading = false;
    paint(container);
  }
}

function hasMacroData(p) {
  const n = p.nutrition || {};
  return Number(n.calories) > 0 || Number(n.protein) > 0 || Number(n.carbs) > 0 || Number(n.fat) > 0;
}

async function onScoreChip(container, score) {
  state.scoreFilter = score;
  state.activeCategory = "";

  if (!score) {
    paint(container);
    return;
  }

  if (state.searched && filteredProducts().length) {
    paint(container);
    return;
  }

  const category = SCORE_BROWSE[score] || "fruits";
  await runSearch(container, () => ProductsAPI.byCategory(category, { limit: 40 }));
}

function bindEvents(container) {
  qs("#searchProductBtn", container).addEventListener("click", () => {
    const q = qs("#productNameInput", container).value.trim();
    if (!q) return showToast("Type a product name first", "error");
    state.nameQuery = q;
    state.activeCategory = "";
    runSearch(container, () => ProductsAPI.search(q, { limit: 40 }));
  });
  qs("#productNameInput", container).addEventListener("keydown", (e) => {
    if (e.key === "Enter") qs("#searchProductBtn", container).click();
  });

  qs("#lookupBarcodeBtn", container).addEventListener("click", () => {
    const code = qs("#barcodeInput", container).value.trim();
    if (!code) return showToast("Enter a barcode number first", "error");
    state.barcodeQuery = code;
    state.activeCategory = "";
    runSearch(container, () => ProductsAPI.byBarcode(code));
  });
  qs("#barcodeInput", container).addEventListener("keydown", (e) => {
    if (e.key === "Enter") qs("#lookupBarcodeBtn", container).click();
  });

  qs("#scoreChips", container)?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-score]");
    if (!btn) return;
    onScoreChip(container, btn.getAttribute("data-score") || "");
  });

  qs("#catChips", container)?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    const cat = btn.getAttribute("data-cat");
    state.activeCategory = cat;
    state.scoreFilter = "";
    runSearch(container, () => ProductsAPI.byCategory(cat, { limit: 40 }));
  });

  const results = qs("#productResults", container);
  if (results) {
    results.onclick = (e) => {
      const btn = e.target.closest(".log-product-btn");
      if (!btn) return;
      const card = btn.closest("[data-code]");
      if (!card) return;
      const code = card.getAttribute("data-code");
      const product = state.products.find((p) => p.code === code);
      if (!product) return;
      FoodLog.add({
        type: "product",
        refId: product.code,
        name: product.name,
        image: product.image,
        subLabel: product.brand,
        nutrition: product.nutrition,
      });
      showToast(`${product.name} logged for today`, "success");
    };
  }
}

import { MealsAPI } from "../api.js";
import { adaptMealList, adaptStringList } from "../adapters.js";
import { qs, debounce, escapeHtml, colorForCategory, iconForCategory } from "../utils.js";
import { navigate } from "../router.js";

let state = {
  query: "",
  area: "",
  category: "",
  meals: [],
  categories: [],
  areas: [],
  loading: true,
  error: null,
};

/** Ignores stale meal responses when the user clicks cuisines quickly. */
let loadSeq = 0;
let enrichSeq = 0;

export async function renderHome(container) {
  state = { ...state, loading: true, error: null };
  paint(container);

  const catsPromise = MealsAPI.categories()
    .then((catRaw) => {
      state.categories = adaptStringList(catRaw, "categories");
    })
    .catch((err) => console.warn("Could not load categories", err));

  await loadMeals(container);

  mergeAreasFromMeals(state.meals);
  await catsPromise;
  renderAreaChips(container);

  // One light extra random sample (NOT one request per category) — avoids API 429s
  enrichAreasLightly(container).catch(() => {});
}

function mergeAreasFromMeals(meals) {
  const set = new Set(state.areas);
  meals.forEach((m) => {
    if (m.area) set.add(m.area);
  });
  state.areas = [...set].sort((a, b) => a.localeCompare(b));
}

/** Grow cuisine chips with one extra random batch — no category flood. */
async function enrichAreasLightly(container) {
  const seq = ++enrichSeq;
  try {
    await new Promise((r) => setTimeout(r, 500));
    if (seq !== enrichSeq) return;
    const raw = await MealsAPI.random({ count: 25 });
    if (seq !== enrichSeq) return;
    const before = state.areas.length;
    mergeAreasFromMeals(adaptMealList(raw).meals);
    if (state.areas.length !== before) renderAreaChips(container);
  } catch {
    /* rate-limit or network — chips from current meals are enough */
  }
}

async function loadMeals(container) {
  const seq = ++loadSeq;
  state.loading = true;
  state.error = null;
  paint(container);

  try {
    let meals;
    if (state.query) {
      const raw = await MealsAPI.search(state.query, { limit: 25 });
      meals = adaptMealList(raw).meals;
    } else if (state.category && state.area) {
      const raw = await MealsAPI.filter({ area: state.area, limit: 100 });
      meals = adaptMealList(raw).meals.filter(
        (m) => (m.category || "").toLowerCase() === state.category.toLowerCase()
      );
    } else if (state.category || state.area) {
      const raw = await MealsAPI.filter({
        category: state.category,
        area: state.area,
        limit: 25,
      });
      meals = adaptMealList(raw).meals;
    } else {
      const raw = await MealsAPI.random({ count: 25 });
      meals = adaptMealList(raw).meals;
    }

    // A newer click already started — drop this stale response
    if (seq !== loadSeq) return;

    state.meals = meals;
    state.error = null;
    mergeAreasFromMeals(meals);
  } catch (err) {
    if (seq !== loadSeq) return;
    console.error(err);
    state.error = "Couldn't load recipes right now. Please try again.";
    state.meals = [];
  } finally {
    if (seq !== loadSeq) return;
    state.loading = false;
    paint(container);
  }
}

function areaChipsHtml() {
  return `
    ${chip("", "All Cuisines", state.area === "")}
    ${state.areas.map((a) => chip(a, a, state.area === a)).join("")}
  `;
}

function renderAreaChips(container) {
  const row = qs("#areaChips", container);
  if (!row) return;
  row.innerHTML = areaChipsHtml();
}

function paint(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Meals &amp; Recipes</h1>
      <p>Discover delicious and nutritious recipes tailored for you</p>
    </div>

    <div class="search-box">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input id="mealSearch" type="text" placeholder="Search recipes by name, ingredient, or cuisine…" value="${escapeHtml(state.query)}" />
    </div>

    <div class="chip-row" id="areaChips">
      ${areaChipsHtml()}
    </div>

    <div class="section-head">
      <div>
        <h2>Browse by Meal Type</h2>
        <p>Find the perfect recipe for any time of day</p>
      </div>
    </div>
    <div class="tile-grid" id="typeTiles">
      ${state.categories
        .map(
          (c) => `
        <div class="tile ${state.category === c ? "active" : ""}" data-category="${escapeHtml(c)}">
          <div class="tile-icon" style="background:${colorForCategory(c)}"><i class="fa-solid ${iconForCategory(c)}"></i></div>
          ${escapeHtml(c)}
        </div>`
        )
        .join("")}
    </div>

    <div class="section-head">
      <div>
        <h2>All Recipes</h2>
        <p>${state.loading ? "Loading…" : `Showing ${state.meals.length} recipes`}</p>
      </div>
    </div>

    <div id="mealResults">${renderResults()}</div>
  `;

  bindEvents(container);
}

function chip(value, label, active) {
  return `<button type="button" class="chip ${active ? "active" : ""}" data-area="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function renderResults() {
  if (state.loading) {
    return `<div class="meal-grid">${Array.from({ length: 8 }).map(() => `<div class="skeleton" style="height:280px"></div>`).join("")}</div>`;
  }
  if (state.error) {
    return `<div class="state-box"><div class="state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h4>Something went wrong</h4><p>${escapeHtml(state.error)}</p></div>`;
  }
  if (!state.meals.length) {
    return `<div class="state-box"><div class="state-icon"><i class="fa-solid fa-bowl-food"></i></div><h4>No recipes found</h4><p>Try a different search term or filter.</p></div>`;
  }
  return `<div class="meal-grid">${state.meals.map(mealCard).join("")}</div>`;
}

function mealCard(meal) {
  return `
    <div class="meal-card" data-id="${escapeHtml(meal.id)}">
      <div class="meal-card-img">
        <img src="${escapeHtml(meal.thumbnail)}" alt="${escapeHtml(meal.name)}" loading="lazy"
             onerror="this.src='https://placehold.co/400x300/e8eaed/9ca3af?text=No+Image'"/>
        <div class="meal-card-badges">
          ${meal.category ? `<span class="badge-pill" style="background:${colorForCategory(meal.category)}"><i class="fa-solid ${iconForCategory(meal.category)}"></i> ${escapeHtml(meal.category)}</span>` : ""}
          ${meal.area ? `<span class="badge-pill" style="background:rgba(0,0,0,.55)"><i class="fa-solid fa-earth-americas"></i> ${escapeHtml(meal.area)}</span>` : ""}
        </div>
      </div>
      <div class="meal-card-body">
        <h3>${escapeHtml(meal.name)}</h3>
        <div class="desc">${escapeHtml(meal.instructions || "")}</div>
        <div class="meal-card-meta">
          <span><i class="fa-solid fa-utensils"></i> ${escapeHtml(meal.category || "—")}</span>
          <span><i class="fa-solid fa-earth-americas"></i> ${escapeHtml(meal.area || "—")}</span>
        </div>
      </div>
    </div>`;
}

function bindEvents(container) {
  const searchInput = qs("#mealSearch", container);
  searchInput?.addEventListener(
    "input",
    debounce((e) => {
      state.query = e.target.value.trim();
      state.category = "";
      state.area = "";
      loadMeals(container);
    }, 400)
  );

  qs("#areaChips", container)?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-area]");
    if (!btn) return;
    state.area = btn.getAttribute("data-area");
    state.query = "";
    loadMeals(container);
  });

  qs("#typeTiles", container)?.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-category]");
    if (!tile) return;
    const next = tile.getAttribute("data-category");
    state.category = state.category === next ? "" : next;
    state.query = "";
    loadMeals(container);
  });

  qs("#mealResults", container)?.addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    navigate(`/meal/${card.getAttribute("data-id")}`);
  });
}

import { MealsAPI, NutritionAPI, hasUsdaApiKey, setUsdaApiKey } from "../api.js";
import { adaptMeal, adaptNutrition } from "../adapters.js";
import { qs, escapeHtml, colorForCategory, fmt, showToast } from "../utils.js";
import { FoodLog } from "../storage.js";

function youtubeEmbed(url = "") {
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : "";
}

function ingredientStrings(meal) {
  return meal.ingredients.map((i) => `${i.measure} ${i.name}`.trim()).filter(Boolean);
}

function hasNutrition(n) {
  return Boolean(n && (n.calories > 0 || n.protein > 0 || n.carbs > 0 || n.fat > 0));
}

export async function renderMealDetails(container, { id }) {
  container.innerHTML = spinnerHtml();

  let meal;
  try {
    const raw = await MealsAPI.getById(id);
    meal = adaptMeal(raw);
    if (!meal || !meal.id) throw new Error("Meal not found");
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml("This recipe couldn't be loaded.");
    return;
  }

  container.innerHTML = layout(meal);
  bindEvents(container, meal);
  loadNutrition(container, meal);
}

function spinnerHtml() {
  return `<div class="spinner"></div>`;
}
function errorHtml(msg) {
  return `<div class="state-box"><div class="state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h4>Oops</h4><p>${escapeHtml(
    msg
  )}</p><a href="/" data-link class="btn-outline-soft" style="display:inline-block;margin-top:10px;">Back to Meals</a></div>`;
}

function layout(meal) {
  const embed = youtubeEmbed(meal.video);
  return `
    <a href="/" data-link class="back-link"><i class="fa-solid fa-arrow-left"></i> Back to Meals &amp; Recipes</a>

    <div class="details-hero">
      <img src="${escapeHtml(meal.thumbnail)}" alt="${escapeHtml(meal.name)}"
           onerror="this.src='https://placehold.co/900x400/e8eaed/9ca3af?text=No+Image'"/>
      <div class="hero-overlay">
        <div>
          ${meal.category ? `<span class="badge-pill" style="background:${colorForCategory(meal.category)}">${escapeHtml(meal.category)}</span>` : ""}
          ${meal.area ? `<span class="badge-pill" style="background:rgba(255,255,255,.25)">${escapeHtml(meal.area)}</span>` : ""}
        </div>
        <h1>${escapeHtml(meal.name)}</h1>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-lg-8">

        <div class="detail-card" id="nutritionCard">
          <h3><i class="fa-solid fa-fire"></i> Nutrition Facts</h3>
          <div id="nutritionBody">
            <div class="spinner" style="margin:20px auto;"></div>
          </div>
        </div>

        <div class="detail-card">
          <h3><i class="fa-solid fa-carrot"></i> Ingredients</h3>
          <ul class="ingredient-list">
            ${meal.ingredients
              .map(
                (i) => `<li><span class="dot"></span> ${escapeHtml(i.name)} <span class="measure">${escapeHtml(i.measure)}</span></li>`
              )
              .join("")}
          </ul>
        </div>

        <div class="detail-card">
          <h3><i class="fa-solid fa-list-ol"></i> Preparation Steps</h3>
          <div class="instructions-text">${escapeHtml(meal.instructions || "No instructions available.")}</div>
        </div>

        ${
          embed
            ? `<div class="detail-card">
                <h3><i class="fa-brands fa-youtube"></i> Video Tutorial</h3>
                <div class="video-embed"><iframe src="${embed}" title="Recipe video" allowfullscreen></iframe></div>
              </div>`
            : ""
        }
      </div>

      <div class="col-lg-4">
        <div class="detail-card sticky-action">
          <h3><i class="fa-solid fa-clipboard-check"></i> Track this meal</h3>
          <p style="color:var(--text-muted);font-size:13.5px;margin-bottom:16px;">
            Add this recipe to today's Food Log to count it toward your daily goals.
          </p>
          <button id="logMealBtn" class="btn-brand" style="width:100%;">
            <i class="fa-solid fa-plus"></i> Log This Meal
          </button>
        </div>
      </div>
    </div>
  `;
}

async function fetchNutrition(meal) {
  const raw = await NutritionAPI.analyze(meal.name, ingredientStrings(meal));
  const nutrition = adaptNutrition(raw);
  if (!hasNutrition(nutrition)) {
    throw new Error("Nutrition analyze returned empty macros");
  }
  meal._nutrition = nutrition;
  return nutrition;
}

async function loadNutrition(container, meal) {
  const body = qs("#nutritionBody", container);
  if (!body) return;

  if (!hasUsdaApiKey()) {
    body.innerHTML = keySetupHtml("A free USDA API key is required to calculate nutrition for recipes.");
    bindKeySetup(container, meal);
    return;
  }

  body.innerHTML = `<div class="spinner" style="margin:20px auto;"></div>`;
  try {
    const nutrition = await fetchNutrition(meal);
    body.innerHTML = nutritionGrid(nutrition);
  } catch (err) {
    console.warn("Nutrition analyze failed", err);
    const needsKey = /API 401|API 403|YOUR_USDA_API_KEY/i.test(String(err?.message || ""));
    body.innerHTML = needsKey
      ? keySetupHtml("That USDA key was rejected. Paste a valid key to load nutrition.")
      : `<p style="color:var(--text-muted);font-size:13.5px;margin:0 0 12px;">
          Nutrition data isn't available right now. You can retry or update your API key.
        </p>
        ${keySetupHtml("")}
        <button type="button" id="retryNutritionBtn" class="btn-outline-soft" style="margin-top:10px;">Retry</button>`;
    bindKeySetup(container, meal);
    qs("#retryNutritionBtn", container)?.addEventListener("click", () => loadNutrition(container, meal));
  }
}

function keySetupHtml(message) {
  return `
    <div class="usda-key-box">
      ${message ? `<p>${escapeHtml(message)}</p>` : ""}
      <p style="margin-top:${message ? "8px" : "0"};">
        Get a free key at
        <a href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank" rel="noopener">fdc.nal.usda.gov</a>,
        then paste it here:
      </p>
      <div class="usda-key-row">
        <input id="usdaKeyInput" type="password" placeholder="Paste USDA API key" autocomplete="off" />
        <button type="button" id="saveUsdaKeyBtn" class="btn-brand">Save &amp; Load</button>
      </div>
    </div>`;
}

function bindKeySetup(container, meal) {
  qs("#saveUsdaKeyBtn", container)?.addEventListener("click", () => {
    const value = qs("#usdaKeyInput", container)?.value?.trim();
    if (!value) return showToast("Paste your USDA API key first", "error");
    setUsdaApiKey(value);
    showToast("API key saved", "success");
    loadNutrition(container, meal);
  });
}

function nutritionGrid(n) {
  return `
    <div class="nutrition-grid">
      <div class="nutrition-stat calories"><div class="val">${fmt(n.calories)}</div><div class="lbl">Calories</div></div>
      <div class="nutrition-stat protein"><div class="val">${fmt(n.protein)}g</div><div class="lbl">Protein</div></div>
      <div class="nutrition-stat carbs"><div class="val">${fmt(n.carbs)}g</div><div class="lbl">Carbs</div></div>
      <div class="nutrition-stat fat"><div class="val">${fmt(n.fat)}g</div><div class="lbl">Fat</div></div>
    </div>`;
}

function bindEvents(container, meal) {
  qs("#logMealBtn", container)?.addEventListener("click", async () => {
    const btn = qs("#logMealBtn", container);
    btn.disabled = true;
    const previous = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Getting nutrition…`;

    try {
      if (!hasNutrition(meal._nutrition)) {
        if (!hasUsdaApiKey()) {
          showToast("Add your USDA API key in Nutrition Facts first", "error");
          qs("#nutritionBody", container)?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        await fetchNutrition(meal);
        const body = qs("#nutritionBody", container);
        if (body) body.innerHTML = nutritionGrid(meal._nutrition);
      }

      FoodLog.add({
        type: "meal",
        refId: meal.id,
        name: meal.name,
        image: meal.thumbnail,
        subLabel: [meal.category, meal.area].filter(Boolean).join(" · "),
        nutrition: meal._nutrition,
      });
      showToast(`${meal.name} logged for today`, "success");
    } catch (err) {
      console.error(err);
      showToast("Couldn't get nutrition — check your USDA API key", "error");
      loadNutrition(container, meal);
    } finally {
      btn.disabled = false;
      btn.innerHTML = previous;
    }
  });
}

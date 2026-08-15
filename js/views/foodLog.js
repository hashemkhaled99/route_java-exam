import { FoodLog, Goals } from "../storage.js";
import { qs, escapeHtml, fmt, round, prettyDate, showToast } from "../utils.js";

export function renderFoodLog(container) {
  const removed = FoodLog.purgeEmptyMealNutrition();
  if (removed) {
    showToast(`Removed ${removed} meal${removed === 1 ? "" : "s"} with missing nutrition`, "info");
  }
  paint(container);
}

function paint(container) {
  const items = FoodLog.getDay();
  const totals = FoodLog.totals();
  const goals = Goals.get();

  container.innerHTML = `
    <div class="page-header">
      <h1>Food Log</h1>
      <p>Track your daily nutrition and food intake</p>
    </div>

    <div class="foodlog-banner">
      <div>
        <h2><i class="fa-solid fa-clipboard-list"></i> Daily Food Log</h2>
        <p>Track and monitor your daily nutrition intake</p>
      </div>
      <div class="date-badge">
        <div class="sub">Today</div>
        <div class="main">${prettyDate()}</div>
      </div>
    </div>

    <div class="nutrition-summary-card">
      <h3><i class="fa-solid fa-fire" style="color:var(--orange)"></i> Today's Nutrition</h3>
      <div class="summary-grid">
        ${statBlock("Calories", totals.calories, goals.calories, "kcal", "stat-calories")}
        ${statBlock("Protein", totals.protein, goals.protein, "g", "stat-protein")}
        ${statBlock("Carbs", totals.carbs, goals.carbs, "g", "stat-carbs")}
        ${statBlock("Fat", totals.fat, goals.fat, "g", "stat-fat")}
      </div>
    </div>

    <div class="nutrition-summary-card">
      <div class="section-head" style="margin-bottom:8px;">
        <h2 style="margin:0;">Logged Items (${items.length})</h2>
      </div>
      <div id="loggedItemsList">
        ${items.length ? items.map(itemRow).join("") : emptyState()}
      </div>
    </div>
  `;

  bindEvents(container);
}

function statBlock(label, value, goal, unit, extraClass) {
  const rawPct = goal ? round((value / goal) * 100) : 0;
  const over = value > goal;
  const barPct = Math.min(100, rawPct);
  return `
    <div class="summary-stat ${extraClass}${over ? " is-over" : ""}">
      <div class="stat-top">
        <span>${label}</span>
        <span class="pct">${fmt(rawPct)}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${barPct}%"></div>
      </div>
      <div class="stat-bottom">
        <span class="${over ? "warn" : ""}">${fmt(value)} ${unit}</span>
        <span>/ ${fmt(goal)} ${unit}</span>
      </div>
    </div>`;
}

function itemRow(item) {
  const n = item.nutrition || {};
  const time = new Date(item.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `
    <div class="logged-item" data-id="${escapeHtml(item.id)}">
      <img src="${escapeHtml(item.image || "")}" onerror="this.src='https://placehold.co/100x100/e8eaed/9ca3af?text=%F0%9F%8D%BD'"/>
      <div>
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="meta">${escapeHtml(item.subLabel || "")}${item.subLabel ? " · " : ""}${item.type === "product" ? "Product" : "Meal"} · Logged ${time}</div>
      </div>
      <div class="macros">
        ${fmt(n.calories)} kcal<br/>
        P${fmt(n.protein)} · C${fmt(n.carbs)} · F${fmt(n.fat)}
      </div>
      <button class="btn-sm-icon remove-item-btn" title="Remove" aria-label="Remove"><i class="fa-solid fa-trash"></i></button>
    </div>`;
}

function emptyState() {
  return `
    <div class="state-box">
      <div class="state-icon"><i class="fa-solid fa-utensils"></i></div>
      <h4>No food logged today</h4>
      <p>Start tracking your nutrition by logging meals or scanning products</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;">
        <a href="/" data-link class="btn-brand"><i class="fa-solid fa-plus"></i> Browse Recipes</a>
        <a href="/productscanner" data-link class="btn-blue"><i class="fa-solid fa-barcode"></i> Scan Product</a>
      </div>
    </div>`;
}

function bindEvents(container) {
  qs("#loggedItemsList", container)?.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-item-btn");
    if (!btn) return;
    const row = btn.closest("[data-id]");
    FoodLog.remove(row.getAttribute("data-id"));
    showToast("Item removed from log", "success");
    paint(container);
  });
}

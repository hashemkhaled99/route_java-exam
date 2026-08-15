// ============================================================
// utils.js — small shared helpers used across views
// ============================================================

export const qs = (sel, el = document) => el.querySelector(sel);
export const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function debounce(fn, delay = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Toast notifications ------------------------------------------------
let toastTimer;
export function showToast(message, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return;
  const icon = type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-exclamation" : "fa-circle-info";
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHtml(message)}`;
  el.className = `app-toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// Number formatting ----------------------------------------------------
export function round(n, d = 0) {
  const f = Math.pow(10, d);
  return Math.round((Number(n) || 0) * f) / f;
}
export function fmt(n) {
  return round(n).toLocaleString();
}

// Date helpers -----------------------------------------------------------
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function prettyDate(date = new Date()) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// Category / area color mapping (visual only, mirrors the design chips) ----
const CATEGORY_COLORS = {
  beef: "#ef4444", chicken: "#f59e0b", dessert: "#ec4899", lamb: "#f97316",
  miscellaneous: "#6b7280", pasta: "#eab308", pork: "#dc2626", seafood: "#3b82f6",
  side: "#06b6d4", starter: "#0ea5e9", vegan: "#22c55e", vegetarian: "#16a34a",
  goat: "#a16207", breakfast: "#f59e0b",
};
export function colorForCategory(name = "") {
  return CATEGORY_COLORS[name.toLowerCase()] || "#10b981";
}

const CATEGORY_ICONS = {
  beef: "fa-drumstick-bite", chicken: "fa-drumstick-bite", dessert: "fa-ice-cream",
  lamb: "fa-drumstick-bite", miscellaneous: "fa-bowl-food", pasta: "fa-bowl-rice",
  pork: "fa-bacon", seafood: "fa-fish", side: "fa-utensils", starter: "fa-utensils",
  vegan: "fa-seedling", vegetarian: "fa-leaf", breakfast: "fa-mug-hot",
};
export function iconForCategory(name = "") {
  return CATEGORY_ICONS[name.toLowerCase()] || "fa-utensils";
}

export function nutriScoreColor(letter = "") {
  const map = { a: "#16a34a", b: "#65a30d", c: "#eab308", d: "#f97316", e: "#ef4444" };
  return map[String(letter).toLowerCase()] || "#9ca3af";
}

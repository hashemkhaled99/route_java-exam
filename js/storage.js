// ============================================================
// storage.js — Food Log persistence via localStorage only
// (per the exam spec: "Food Log part uses LocalStorage, no endpoints")
// ============================================================

import { todayKey } from "./utils.js";

const LOG_KEY = "nutriplan_foodlog_v1";
const GOALS_KEY = "nutriplan_goals_v1";

const DEFAULT_GOALS = { calories: 2000, protein: 50, carbs: 250, fat: 65 };

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY)) || {};
  } catch {
    return {};
  }
}
function writeAll(data) {
  localStorage.setItem(LOG_KEY, JSON.stringify(data));
}

export const FoodLog = {
  /** Every entry for a given day (defaults to today). */
  getDay(dateKey = todayKey()) {
    const all = readAll();
    return all[dateKey] || [];
  },

  /**
   * Add a logged item.
   * entry: { type: 'meal'|'product', refId, name, image, subLabel, nutrition:{calories,protein,carbs,fat} }
   */
  add(entry, dateKey = todayKey()) {
    const all = readAll();
    const day = all[dateKey] || [];
    day.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      loggedAt: new Date().toISOString(),
      ...entry,
    });
    all[dateKey] = day;
    writeAll(all);
    return day;
  },

  remove(entryId, dateKey = todayKey()) {
    const all = readAll();
    const day = (all[dateKey] || []).filter((e) => e.id !== entryId);
    all[dateKey] = day;
    writeAll(all);
    return day;
  },

  totals(dateKey = todayKey()) {
    const day = this.getDay(dateKey);
    return day.reduce(
      (acc, e) => {
        acc.calories += Number(e.nutrition?.calories) || 0;
        acc.protein += Number(e.nutrition?.protein) || 0;
        acc.carbs += Number(e.nutrition?.carbs) || 0;
        acc.fat += Number(e.nutrition?.fat) || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  },

  /**
   * Remove meal entries that were logged with empty macros (e.g. before USDA key).
   * Products are left alone — some legitimately have 0 kcal.
   */
  purgeEmptyMealNutrition(dateKey = todayKey()) {
    const all = readAll();
    const day = all[dateKey] || [];
    const next = day.filter((e) => {
      if (e.type !== "meal") return true;
      const n = e.nutrition || {};
      return Number(n.calories) || Number(n.protein) || Number(n.carbs) || Number(n.fat);
    });
    const removed = day.length - next.length;
    if (removed) {
      all[dateKey] = next;
      writeAll(all);
    }
    return removed;
  },
};

export const Goals = {
  get() {
    try {
      return { ...DEFAULT_GOALS, ...(JSON.parse(localStorage.getItem(GOALS_KEY)) || {}) };
    } catch {
      return { ...DEFAULT_GOALS };
    }
  },
  set(goals) {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  },
};

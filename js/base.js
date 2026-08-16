// ============================================================
// base.js — support hosting under a subpath (GitHub Pages:
// https://user.github.io/repo-name/...) while keeping "/" locally.
// ============================================================

const APP_ROOT_ROUTES = new Set(["productscanner", "foodlog", "meal"]);

function detectBasePath() {
  if (typeof window !== "undefined" && typeof window.__NP_BASE__ === "string") {
    return window.__NP_BASE__;
  }
  if (!/\.github\.io$/i.test(location.hostname)) return "";
  const seg = location.pathname.split("/").filter(Boolean)[0];
  if (!seg || APP_ROOT_ROUTES.has(seg)) return "";
  return `/${seg}`;
}

export const BASE_PATH = detectBasePath();

/** Prefix an app path with the deploy base (`/` → `/repo` or `/`). */
export function withBase(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return BASE_PATH || "/";
  return `${BASE_PATH}${normalized}`;
}

/** Strip the deploy base so the router matches `/foodlog`, not `/repo/foodlog`. */
export function stripBase(pathname = "/") {
  if (!BASE_PATH) return pathname || "/";
  if (pathname === BASE_PATH || pathname === `${BASE_PATH}/`) return "/";
  if (pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length) || "/";
  }
  return pathname || "/";
}

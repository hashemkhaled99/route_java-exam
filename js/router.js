// ============================================================
// router.js — minimal History API router (BONUS requirement:
// the URL bar updates per tab: /, /productscanner, /foodlog, /meal/:id)
// ============================================================

const routes = []; // { pattern: RegExp, keys: string[], handler: fn }

function compile(path) {
  const keys = [];
  const pattern = path
    .replace(/\/+$/, "")
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        keys.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${pattern || "/"}$`), keys };
}

export function addRoute(path, handler) {
  const { regex, keys } = compile(path);
  routes.push({ regex, keys, handler });
}

function matchRoute(pathname) {
  // "/" with trailing slashes stripped becomes "" — keep it as "/" so home matches
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
  }
  return null;
}

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  render();
}

export function render() {
  const pathname = window.location.pathname || "/";
  const match = matchRoute(pathname) || matchRoute("/404");
  if (match) {
    match.handler(match.params);
  }
  updateActiveNav(pathname);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  closeMobileSidebar();
}

function updateActiveNav(pathname) {
  document.querySelectorAll(".nav-link[data-route]").forEach((a) => {
    const route = a.getAttribute("data-route");
    const isHome = route === "/" && pathname === "/";
    const isMatch = route !== "/" && pathname.startsWith(route);
    a.classList.toggle("active", isHome || isMatch);
  });
}

function closeMobileSidebar() {
  document.querySelector(".sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("show");
}

export function initRouter() {
  // Intercept clicks on any [data-link] anchor to avoid full page reloads
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-link]");
    if (!link) return;
    e.preventDefault();
    navigate(link.getAttribute("href"));
  });

  window.addEventListener("popstate", render);
  render();
}

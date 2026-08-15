import { addRoute, initRouter } from "./router.js";
import { renderHome } from "./views/home.js";
import { renderMealDetails } from "./views/mealDetails.js";
import { renderProductScanner } from "./views/productScanner.js";
import { renderFoodLog } from "./views/foodLog.js";

const app = document.getElementById("app");

addRoute("/", () => renderHome(app));
addRoute("/productscanner", () => renderProductScanner(app));
addRoute("/foodlog", () => renderFoodLog(app));
addRoute("/meal/:id", (params) => renderMealDetails(app, params));
addRoute("/404", () => {
  app.innerHTML = `<div class="state-box"><div class="state-icon"><i class="fa-solid fa-compass"></i></div><h4>Page not found</h4><p>That page doesn't exist.</p><a href="/" data-link class="btn-brand" style="display:inline-flex;margin-top:12px;">Go home</a></div>`;
});

// Mobile sidebar toggle
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("sidebarOverlay");
document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
  sidebar.classList.add("open");
  overlay.classList.add("show");
});
overlay?.addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
});

initRouter();

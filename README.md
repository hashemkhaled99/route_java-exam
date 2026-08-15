# NutriPlan

Vanilla HTML/CSS/JavaScript exam app for meal browsing, nutrition tracking, product scanning, and a daily food log.

**Features**
- **Home** — ~25 meals, search, filter by cuisine (area) and meal type (category)
- **Meal details** — ingredients, steps, YouTube video, USDA nutrition, **Log This Meal**
- **Food Log** — daily calories / protein / carbs / fat vs goals (**localStorage only**, no API)
- **Product Scanner** — search by name or barcode, then log to the Food Log
- **Bonus routing** — URL updates per tab (`/`, `/productscanner`, `/foodlog`, `/meal/:id`)

API base: `https://nutriplan-api.vercel.app/api`

---

## Run locally

You need a local server (ES modules do not work via `file://`).

```bash
cd nutriplan
python serve.py
```

Open **http://127.0.0.1:5500**

`serve.py` is an SPA server: refreshing `/foodlog` or `/meal/123` still loads the app.

### USDA API key (meal nutrition)

A USDA key is already set in `js/api.js`, so meal nutrition works after you pull and run.

To use your own key later: https://fdc.nal.usda.gov/api-key-signup.html — paste it in `js/api.js` or on the meal details page.

---

## Deploy (static hosting)

This is a static front-end. Deploy the project **root** (the folder that contains `index.html`, `css/`, `js/`).

### Option A — Vercel (recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Settings:
   - **Framework Preset:** Other
   - **Root Directory:** `.` (or `nutriplan` if the app lives in a subfolder)
   - **Build Command:** leave empty
   - **Output Directory:** `.` (or leave default for static)
4. Deploy.

`vercel.json` already rewrites client routes to `index.html` so `/foodlog` and `/meal/:id` work after refresh.

CLI alternative:

```bash
npm i -g vercel
vercel
```

### Option B — Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → import from Git  
   **or** drag-and-drop the project folder onto Netlify Drop.
2. Build settings:
   - **Build command:** *(empty)*
   - **Publish directory:** `.` (folder with `index.html`)
3. `netlify.toml` / `_redirects` handle SPA fallback.

### Option C — GitHub Pages

1. Repo **Settings → Pages** → deploy from `main` / root (or `/docs`).
2. History-API routes need a `404.html` copy of `index.html`, **or** use hash routing.  
   Prefer **Vercel/Netlify** for this app’s `/foodlog`-style URLs.

### After deploy

1. Open the live URL.
2. Add your USDA key when you open a meal (or set it in `js/api.js` before building/deploying a private fork).
3. Smoke-test: Home → meal → Log → Food Log → Product Scanner → Log product.

---

## Project structure

```
index.html          shell: sidebar + #app
serve.py            local SPA static server
vercel.json         Vercel SPA rewrites
netlify.toml        Netlify SPA redirects
css/styles.css
js/
  api.js            NutriPlan API helpers
  adapters.js       normalize API JSON for the UI
  storage.js        Food Log + goals (localStorage)
  router.js         History API router (bonus)
  utils.js
  main.js
  views/
    home.js
    mealDetails.js
    productScanner.js
    foodLog.js
```

---

## Exam checklist

| Requirement | Status |
|-------------|--------|
| Home: ~25 meals + category/area filters | ✅ |
| Meal details: ingredients, steps, video, nutrition, Log | ✅ |
| Food Log via localStorage | ✅ |
| Product Scanner → Food Log | ✅ |
| Bonus: URL changes per tab | ✅ |

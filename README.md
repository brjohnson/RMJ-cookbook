# The Johnson Cookbook — Setup Guide

Your cookbook site is built as plain HTML/CSS/JS files. The backend is a Google Sheet. No server required — configure two things in `config.js` and you're live.

---

## Step 1: Import your recipes into Google Sheets

1. Open [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Go to **File → Import → Upload** and drag in your CSV file.
3. On the import options, select **"Replace spreadsheet"** and **"Detect automatically"** for separator. Click **Import data**.
4. Make sure the sheet tab at the bottom is named `Sheet1` (or update `SHEET_NAME` in `apps-script.gs` to match).

---

## Step 2: Publish the sheet as CSV

1. In your Google Sheet, go to **File → Share → Publish to web**.
2. In the first dropdown, choose your sheet tab.
3. In the second dropdown, choose **Comma-separated values (.csv)**.
4. Click **Publish** and confirm.
5. Copy the URL — it looks like:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID/pub?gid=12345&single=true&output=csv
   ```
6. Open `config.js` and paste it as `SHEET_CSV_URL`.

Changes appear on the site within a few minutes of editing the sheet.

---

## Step 3: Set up Google Apps Script (for the admin form)

The admin form submits new recipes and edits directly to your Google Sheet via Apps Script. Without this, submissions won't work.

1. In your Google Sheet, go to **Extensions → Apps Script**.
2. Delete any existing code and paste in the full contents of `apps-script.gs` (in this folder — it's gitignored so it won't be committed).
3. Click **Deploy → New deployment**.
4. Set type to **Web app**.
5. Set "Execute as" → **Me**, and "Who has access" → **Anyone**.
6. Click **Deploy** and authorize permissions.
7. Copy the **Web app URL**.
8. Open `config.js` and paste it as `APPS_SCRIPT_URL`.

The Apps Script handles both **adding** new recipes (appends a row) and **editing** existing ones (finds the row by slug and updates it in place).

> **To update the script later:** Go to script.google.com → open your project → paste updated code → Deploy → Manage deployments → edit the existing deployment → set Version to "New version" → Deploy. Your URL stays the same.

---

## Step 4: Host the website

### Option A — GitHub + Netlify (recommended)

1. Push this folder to a GitHub repository (`git add . && git commit -m "initial" && git push`).
2. Go to [netlify.com](https://www.netlify.com), sign up, and click **"Add new site → Import from Git"**.
3. Connect GitHub and select your repository.
4. Leave build settings blank (no build step needed). Click **Deploy**.
5. Your site is live. Every `git push` automatically redeploys it.
6. Optional: add a custom domain in Netlify → Domain settings.

### Option B — Netlify drag-and-drop (simplest)

1. Go to [netlify.com](https://www.netlify.com) and sign up.
2. Drag the entire project folder onto the Netlify drop zone.
3. Live instantly. To update, drag again or switch to Git deployment.

### Option C — GitHub Pages

1. Push to GitHub.
2. Go to **Settings → Pages → Source** → select `main` branch.
3. Live at `https://your-username.github.io/repo-name`.

### Option D — Run locally

Open `index.html` in Chrome or Firefox. Note: the admin form requires an internet connection to reach Apps Script.

---

## File overview

| File | What it does |
|------|-------------|
| `index.html` | Homepage — recipe grid with search, filter, sort, and grouped view |
| `recipe.html` | Individual recipe detail page |
| `favorites.html` | Personal favorites — recipes starred by the current user (localStorage) |
| `admin.html` | Admin page — add new recipes or edit existing ones |
| `style.css` | All shared styles |
| `config.js` | Google Sheet CSV URL and Apps Script URL |
| `apps-script.gs` | Google Apps Script source (gitignored — deploy via script.google.com) |
| `migrate_images.py` | One-time script to migrate images to Cloudinary (gitignored) |
| `.gitignore` | Excludes credentials and migration artifacts from git |
| `README.md` | This file |

---

## Admin page

Navigate to `/admin.html` (password-protected). It has two modes:

**Add mode** — Fill in the form to add a brand-new recipe. Supports:
- Photo URL or OCR scan of a printed recipe image (powered by Tesseract.js)
- Rich text fields for ingredients and instructions
- Category assignment, quantity, author, and chef's notes

**Edit mode** — Search for any existing recipe, click to pre-fill the form, make changes, and save. The Apps Script finds the original row by slug and updates it in place.

---

## Favorites

Each visitor can star recipes they like. Stars are saved to that device's `localStorage` — they're personal and private, not stored in the sheet. Starred recipes appear on the **My Favorites** page (`favorites.html`). Un-starring a recipe on that page immediately removes it from the list.

---

## Image hosting

Recipe images are served from external URLs stored in the sheet. Good hosting options:

- **Cloudinary** — recommended. Use `migrate_images.py` to bulk-migrate existing images to your Cloudinary account as optimized WebP files. The script reads your sheet, re-uploads each image, and outputs an `updated_recipes.csv` with new URLs ready to paste back into the sheet.
- **Google Drive** — share publicly and copy the direct link.
- **Imgur** — simple, get a direct `.jpg` URL.

---

## Deployment workflow

The site is hosted on GitHub Pages. To push changes live:

```bash
git add . && git commit -m "describe your changes" && git push
```

That's it — GitHub Pages serves the updated files automatically within a minute or so.

---

## Adding recipes manually (without the form)

Add a row directly to the Google Sheet. Required columns:

- **Name** — recipe title
- **Slug** — URL-friendly version (e.g. `roast-chicken`). Must be unique.
- **Category** — semicolon-separated slugs (e.g. `poultry;easy-weeknight-meals`)
- **Ingredients** — ingredient list
- **Instructions** — steps

Optional columns: `Author`, `Quantity`, `Brief description`, `Main image`, `Chef's notes`, `Related recipes`, `Draft`, `Archived`.

Set **Draft** or **Archived** to `true` to hide a recipe from the site without deleting it.

---

## Customization

**Cookbook name:** Edit `config.js` → `COOKBOOK_TITLE`.

**Categories:** Add the slug and display name to the `CATEGORIES` object in `index.html`, `recipe.html`, and `favorites.html`. Add a hue value to `CATEGORY_HUES` for a color-coded pill (0–360, any hue on the color wheel).

**Accent color:** Open `style.css` and change the `--accent` CSS variable.

---

*Built with plain HTML, CSS, and JavaScript. No frameworks, no build step.*

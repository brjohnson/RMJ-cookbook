# The Johnson Cookbook — Setup Guide

Your cookbook site is built as plain HTML/CSS/JS files. The backend is a Google Sheet. No server required — just configure two things and you're live.

---

## Step 1: Import your recipes into Google Sheets

1. Open [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Go to **File → Import → Upload** and drag in the CSV file (`rmjcooking - Recipes - ....csv`).
3. On the import options, select **"Replace spreadsheet"** and **"Detect automatically"** for separator. Click **Import data**.
4. Rename the sheet tab (bottom) to something simple, like `Recipes`.

---

## Step 2: Publish the sheet as CSV (so the website can read it)

1. In your Google Sheet, go to **File → Share → Publish to web**.
2. In the first dropdown, choose your sheet tab (`Recipes`).
3. In the second dropdown, choose **Comma-separated values (.csv)**.
4. Click **Publish** and confirm.
5. Copy the URL it shows you. It will look like:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID/pub?gid=12345&single=true&output=csv
   ```
6. Open `config.js` in this folder and paste the URL as the value of `SHEET_CSV_URL`.

The website will now read directly from your live Google Sheet. To update a recipe, just edit the sheet — changes appear on the site within a few minutes.

---

## Step 3: Set up Google Apps Script (to add new recipes from the form)

This is optional — without it, the "Add Recipe" form will download a CSV row you can paste into the sheet manually. But if you want the form to auto-submit:

1. In your Google Sheet, go to **Extensions → Apps Script**.
2. Delete any existing code and paste in the following:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Recipes");
  const data = JSON.parse(e.postData.contents);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => data[h] || "");
  sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({status:"ok"}))
                       .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **Deploy → New deployment**.
4. Set type to **Web app**.
5. Set "Execute as" → **Me**, and "Who has access" → **Anyone** (or "Anyone with link" for more privacy).
6. Click **Deploy** and authorize the permissions.
7. Copy the **Web app URL** it gives you.
8. Open `config.js` and paste it as `APPS_SCRIPT_URL`.

---

## Step 4: Host the website

### Option A — Netlify (free, easiest)
1. Go to [netlify.com](https://www.netlify.com) and sign up (free).
2. Drag the entire `Cookbook website rebuild` folder onto the Netlify drop zone.
3. Your site is live in seconds at a URL like `https://festive-johnson-cookbook.netlify.app`.
4. Optional: add a custom domain in Netlify settings.

### Option B — GitHub Pages (free)
1. Create a GitHub repository.
2. Upload all the files in this folder to the repo.
3. Go to **Settings → Pages → Source** and select `main` branch.
4. Your site will be live at `https://your-username.github.io/repo-name`.

### Option C — Run locally
Just open `index.html` in Chrome or Firefox. The CSV is bundled alongside the HTML files, so it works offline too.

---

## File overview

| File | What it does |
|------|-------------|
| `index.html` | Homepage — recipe grid with search & filter |
| `recipe.html` | Individual recipe detail view |
| `admin.html` | Add a new recipe (with photo OCR & voice input) |
| `style.css` | All shared styles |
| `config.js` | Your Google Sheet URL and other settings |
| `README.md` | This file |

---

## Customization

### Change the cookbook name or subtitle
Open `config.js` and edit `COOKBOOK_TITLE` and `COOKBOOK_SUBTITLE`.

### Change the accent color
Open `style.css` and change the `--accent` CSS variable (currently a deep red `#c0392b`).

### Add new categories
In `admin.html`, add a new `<option>` to the category `<select>`. In `index.html`, add the slug and label to the `CATEGORIES` object in the `<script>` section.

### Photo storage
The admin form accepts a photo upload for preview, but you need a hosting solution for permanent URLs. Good free options:
- **Google Drive** — share the file publicly and copy the direct link
- **Cloudinary** — free tier with a simple upload widget
- **Imgur** — simple image hosting, get a direct `.jpg` URL

---

## Adding recipes manually (without the form)

Just add a new row to the bottom of your Google Sheet. The required columns are:
- **Name** — recipe title
- **Slug** — URL-friendly version of the name (e.g. `my-roast-chicken`)
- **Category** — one of the category slugs (e.g. `poultry`, `desserts`)
- **Ingredients** — ingredient list (plain text or HTML)
- **Instructions** — steps (plain text or HTML)

All other columns are optional.

---

*Built with plain HTML, CSS, and JavaScript. No frameworks, no build step.*

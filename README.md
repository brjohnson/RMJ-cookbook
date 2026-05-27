# The Johnson Cookbook

A family recipe site backed by Google Sheets. No server, no framework — just HTML, CSS, and JavaScript.

---

## How it works

The site reads recipes from a published Google Sheet CSV on every page load. To add or change a recipe, you either use the admin page or edit the sheet directly — the site reflects changes within a few minutes.

The admin page posts to a Google Apps Script, which writes to the sheet. No database, no backend server.

---

## Files

| File | What it does |
|------|-------------|
| `index.html` | Homepage — recipe grid with search, filter, sort, and grouped view |
| `recipe.html` | Individual recipe page |
| `favorites.html` | Personal favorites (saved to the viewer's device, not the sheet) |
| `admin.html` | Add or edit recipes |
| `style.css` | All styles |
| `config.js` | Google Sheet CSV URL and Apps Script URL |
| `apps-script.gs` | Apps Script source — gitignored, deploy via script.google.com |
| `migrate_images.py` | One-time Cloudinary image migration script — gitignored |

---

## Adding or editing recipes

Go to `/admin.html`. There are two modes:

**Add** — fill in the form and submit. The recipe is appended as a new row in the sheet.

**Edit** — search for an existing recipe, click it to pre-fill the form, make changes, and save. The Apps Script finds the row by its slug and updates it in place. The original publish date is preserved so edited recipes don't resurface in "Recently Added."

You can also edit the Google Sheet directly — just be careful not to change the Slug column on an existing recipe, as that's how the site identifies it.

---

## Recipe fields

| Field | Notes |
|-------|-------|
| Name | Recipe title |
| Slug | URL-safe ID, e.g. `roast-chicken`. Must be unique. Don't change after publishing. |
| Author | Who contributed it |
| Quantity | Serving size or yield |
| Brief description | Short blurb shown on the card |
| Category | Semicolon-separated slugs, e.g. `poultry;easy-weeknight-meals` |
| Main image | URL to the recipe photo |
| Ingredients | Text or HTML |
| Instructions | Text or HTML |
| Related recipes | Semicolon-separated slugs of other recipes |
| Chef's notes | Extra tips or context |
| Published On | Date added — don't edit this, it controls "Recently Added" |
| Draft | Set to `true` to hide from the site without deleting |
| Archived | Set to `true` to hide older recipes |

---

## Favorites

Stars are per-device and stored in the browser's `localStorage`. They're not in the sheet. Each visitor has their own favorites and they persist across visits on the same device.

---

## Deploying changes

The site is hosted on GitHub Pages. To push changes live:

```bash
git add . && git commit -m "describe your changes" && git push
```

GitHub Pages updates within about a minute.

---

## Updating the Apps Script

If you change `apps-script.gs`, you need to redeploy it manually:

1. Go to [script.google.com](https://script.google.com) and open the project
2. Paste in the updated code
3. Deploy → Manage deployments → edit the active deployment → set Version to "New version" → Deploy

The URL stays the same — no need to update `config.js`.

---

## Adding a new category

1. Add the slug and display name to the `CATEGORIES` object in `index.html`, `recipe.html`, and `favorites.html`
2. Add a hue value (0–360) to `CATEGORY_HUES` in those same files for a color-coded pill
3. Use the slug in the sheet's Category column

---

*Plain HTML/CSS/JS. No build step.*

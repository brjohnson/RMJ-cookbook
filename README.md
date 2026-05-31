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

If you're logged into the admin page, an **Edit recipe** link also appears on individual recipe pages — it opens `admin.html?edit=slug` and pre-fills the form automatically.

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
| Ingredients | HTML (edited via rich-text editor in admin; supports bold, italic, lists, links) |
| Instructions | HTML (edited via rich-text editor in admin; supports bold, italic, lists, links) |
| Related recipes | Semicolon-separated slugs of other recipes (chosen via multi-select dropdown in admin) |
| Chef's notes | Extra tips or context |
| Published On | Date added — don't edit this, it controls "Recently Added" |
| Draft | Set to `true` to hide from the site without deleting |
| Archived | Set to `true` to hide older recipes |

---

## Favorites

Stars are per-device and stored in the browser's `localStorage`. They're not in the sheet. Each visitor has their own favorites and they persist across visits on the same device.

---

## Deploying changes

The site is hosted on GitHub Pages. Changes go live when you push to the GitHub repository — GitHub Pages picks them up automatically within about a minute.

If you haven't set up the repo on your computer yet, see [One-time setup](#one-time-setup) below first.

Once you're set up, open Terminal, navigate to the project folder, and run:

```bash
git add .
git commit -m "describe your changes"
git push
```

To navigate to the folder in Terminal, type `cd ` (with a space), then drag the project folder from Finder into the Terminal window and press Enter.

If you're a collaborator rather than the owner, see [Contributing](#contributing-for-collaborators) below for a slightly different workflow using pull requests.

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

## One-time setup

If you haven't worked with this repo on your computer before, you need to clone it first. Cloning creates a local copy of the project on your computer, linked to GitHub so you can push changes back later.

1. Install [Git](https://git-scm.com/download/mac) if you don't have it (run `git --version` in Terminal to check — if it prints a version number, you're good)
2. In Terminal, navigate to where you want the folder to live (e.g. your Desktop):
   ```bash
   cd ~/Desktop
   ```
3. Clone the repo — this creates a local copy of the project on your computer, linked to GitHub so you can push changes back later (replace the URL with your actual GitHub repo URL):
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   ```
4. Move into the project folder:
   ```bash
   cd your-repo-name
   ```

You only need to do this once. After cloning, the folder is already linked to GitHub.

To verify the link is correct at any time:
```bash
git remote -v
```
It should show your GitHub repo URL next to `origin`.

---

## Contributing (for collaborators)

If you've been added as a collaborator and want to make changes, follow these steps. Changes go through a pull request so the owner can review before anything goes live.

Start by cloning the repo if you haven't already — see [One-time setup](#one-time-setup) above.

### Every time you make changes

**1. Pull the latest version first**

Before editing anything, make sure your local copy is up to date:

```bash
git pull
```

**2. Create a branch for your changes**

Don't edit directly on `main`. Create a new branch named after what you're changing:

```bash
git checkout -b your-branch-name
```

For example: `git checkout -b add-moms-lasagna`

**3. Make your edits**

Open the project folder in [Claude Cowork](https://claude.ai) and make your changes there. Cowork has the full context of the project and can help you edit recipes, update the site, or fix anything that looks off.

**4. Stage and commit your changes**

When you're happy with your edits, go back to Terminal and run:

```bash
git add .
git commit -m "brief description of what you changed"
```

**5. Push your branch to GitHub**

```bash
git push origin your-branch-name
```

**6. Open a pull request**

Go to the repo on GitHub.com. You'll see a prompt to open a pull request for your branch — click it, add a short description of what you changed and why, and submit. The owner will review and merge it when ready.

---

*Plain HTML/CSS/JS. No build step.*

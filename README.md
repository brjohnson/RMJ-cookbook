# The Johnson Cookbook

Live at [thejohnsoncookbook.com](https://thejohnsoncookbook.com)

A family recipe site backed by Google Sheets. No server, no framework - just HTML, CSS, and JavaScript.

---

## How it works

Recipes live in a Google Sheet, which acts as the database. The site reads the sheet's published CSV on every page load, so any change to the sheet shows up on the site within a few minutes.

There's no backend server. A Google Apps Script handles writes to the sheet from the site's admin page.

---

## Features

- **Homepage** - recipe grid with search, filter, sort, and grouped view
- **Recipe pages** - ingredients, instructions, chef's notes, and related recipes
- **Favorites** - anyone can star recipes. Favorites are stored in the browser's localStorage, so they're per-device and never touch the sheet.

---

## Files

| File | What it does |
|------|-------------|
| `index.html` | Homepage - recipe grid with search, filter, sort, and grouped view |
| `recipe.html` | Individual recipe page |
| `favorites.html` | Personal favorites (saved to the viewer's device, not the sheet) |
| `admin.html` | Admin page for managing recipes |
| `style.css` | All styles |
| `config.js` | Google Sheet CSV URL and Apps Script URL |
| `apps-script.gs` | Apps Script source - gitignored, deploy via script.google.com |
| `migrate_images.py` | One-time Cloudinary image migration script - gitignored |

---

## Hosting

Hosted on GitHub Pages. Pushes to the repo go live automatically within about a minute.

---

*Plain HTML/CSS/JS. No build step.*

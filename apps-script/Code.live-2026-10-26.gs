/**
 * The Johnson Cookbook — Google Apps Script
 * ==========================================
 * Handles adding/updating both RECIPES and ARTICLES.
 *
 * Recipes  → the "Sheet1" tab (SHEET_NAME below).
 * Articles → the "articles" tab (ARTICLES_SHEET_NAME below, matched
 *            case-insensitively). Requests from the admin page carry
 *            `type: "article"` so this script knows which tab to write.
 *
 * HOW TO UPDATE YOUR APPS SCRIPT:
 * 1. Go to script.google.com and open your existing project
 * 2. Replace ALL the code with this file's contents
 * 3. Click Save (Cmd+S / Ctrl+S)
 * 4. Click Deploy → Manage deployments → click the pencil (edit) on your deployment
 * 5. Change "Version" to "New version"
 * 6. Click Deploy
 * Your existing Apps Script URL stays the same — no need to update config.js.
 */

const SHEET_NAME          = "recipes";  // recipes tab (matched case-insensitively)
const ARTICLES_SHEET_NAME = "articles"; // articles tab (matched case-insensitively)

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === "article") {
      const sheet = getSheetByNameCI(ss, ARTICLES_SHEET_NAME) || ss.getActiveSheet();
      if (data.action === "update" && data.originalSlug) {
        updateArticle(sheet, data);
      } else {
        addArticle(sheet, data);
      }
    } else {
      const sheet = getSheetByNameCI(ss, SHEET_NAME) || ss.getActiveSheet();
      if (data.action === "delete") {
        deleteRecipe(sheet, data);
      } else if (data.action === "update" && data.originalSlug) {
        updateRecipe(sheet, data);
      } else {
        addRecipe(sheet, data);
      }
    }

    return jsonOut({ status: "ok" });
  } catch (err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  RECIPES
// ══════════════════════════════════════════════════════════════════════════════

// ── Add a new row ─────────────────────────────────────────────────────────────
function addRecipe(sheet, data) {
  const headers = getHeaders(sheet);
  const row = buildRow(headers, data);
  sheet.appendRow(row);
}

// ── Update an existing row matched by Slug ────────────────────────────────────
function updateRecipe(sheet, data) {
  const headers   = getHeaders(sheet);
  const slugCol   = headers.indexOf("Slug");
  if (slugCol === -1) throw new Error("No 'Slug' column found in sheet");

  const lastRow   = sheet.getLastRow();
  const slugRange = sheet.getRange(2, slugCol + 1, lastRow - 1, 1);
  const slugValues = slugRange.getValues();

  let targetRow = -1;
  for (let i = 0; i < slugValues.length; i++) {
    if (slugValues[i][0] === data.originalSlug) {
      targetRow = i + 2; // +2: 1-indexed + header row
      break;
    }
  }

  if (targetRow === -1) {
    // Slug not found — append as new recipe instead
    addRecipe(sheet, data);
    return;
  }

  // Preserve the original Published On date so edits don't resurface in "Recently Added"
  const pubOnCol = headers.indexOf("Published On");
  if (pubOnCol !== -1) {
    const existingDate = sheet.getRange(targetRow, pubOnCol + 1).getValue();
    if (existingDate) data["_preservedPublishedOn"] = existingDate;
  }

  const row = buildRow(headers, data);
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
}


// ── Delete an existing row matched by Slug ────────────────────────────────────
function deleteRecipe(sheet, data) {
  const headers = getHeaders(sheet);
  const slugCol = headers.indexOf("Slug");
  if (slugCol === -1) throw new Error("No 'Slug' column found in sheet");

  const delSlug = String(data.originalSlug || data.Slug || "").trim();
  if (!delSlug) throw new Error("No slug provided for delete");

  const lastRow    = sheet.getLastRow();
  const slugValues = sheet.getRange(2, slugCol + 1, Math.max(lastRow - 1, 1), 1).getValues();

  for (let i = 0; i < slugValues.length; i++) {
    if (String(slugValues[i][0]).trim() === delSlug) {
      sheet.deleteRow(i + 2); // +2: 1-indexed + header row
      return;
    }
  }

  throw new Error("Recipe not found for slug: " + delSlug);
}

// ── Build a recipe row array ordered by sheet headers ─────────────────────────
function buildRow(headers, data) {
  const fieldMap = {
    "Name":              data["Name"]              || "",
    "Slug":              data["Slug"]              || "",
    "Author":            data["Author"]            || "",
    "Quantity":          data["Quantity"]          || "",
    "Brief description": data["Brief description"] || "",
    "Category":          data["Category"]          || "",
    "Main image":        data["Main image"]        || "",
    "Ingredients":       data["Ingredients"]       || "",
    "Instructions":      data["Instructions"]      || "",
    "Related recipes":       data["Related recipes"]       || "",
    "Principal ingredients": data["Principal ingredients"] || "",
    "Chef's notes":          data["Chef's notes"]          || "",
    "Published On":      data["_preservedPublishedOn"] || data["Created On"] || "",
    "Draft":             data["Draft"]             || "false",
    "Archived":          data["Archived"]          || "false",
  };

  return headers.map(h => fieldMap.hasOwnProperty(h) ? fieldMap[h] : "");
}

// ══════════════════════════════════════════════════════════════════════════════
//  ARTICLES
// ══════════════════════════════════════════════════════════════════════════════

// ── Add a new article row ─────────────────────────────────────────────────────
function addArticle(sheet, data) {
  const headers = getHeaders(sheet);
  const map = articleFieldMap(data, {});
  const row = headers.map(h => map.hasOwnProperty(h) ? map[h] : "");
  sheet.appendRow(row);
}

// ── Update an existing article row matched by Slug ────────────────────────────
// Only the columns we manage are overwritten; any other columns on the row
// (e.g. Webflow's Collection ID / Item ID) are preserved as-is.
function updateArticle(sheet, data) {
  const headers = getHeaders(sheet);
  const slugCol = headers.indexOf("Slug");
  if (slugCol === -1) throw new Error("No 'Slug' column found in articles sheet");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { addArticle(sheet, data); return; }

  const slugValues = sheet.getRange(2, slugCol + 1, lastRow - 1, 1).getValues();
  let targetRow = -1;
  for (let i = 0; i < slugValues.length; i++) {
    if (slugValues[i][0] === data.originalSlug) { targetRow = i + 2; break; }
  }

  if (targetRow === -1) { addArticle(sheet, data); return; }

  const existingRow = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
  const existing = {};
  headers.forEach((h, i) => { existing[h] = existingRow[i]; });

  const map = articleFieldMap(data, existing);
  const row = headers.map((h, i) => map.hasOwnProperty(h) ? map[h] : existingRow[i]);
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
}

// ── Build the managed article fields ──────────────────────────────────────────
// `existing` holds the current row values (empty object for new rows) so we can
// preserve the original Created On / Published On dates when editing.
function articleFieldMap(data, existing) {
  const now = new Date().toUTCString();
  return {
    "Name":         data["Name"]   || "",
    "Slug":         data["Slug"]   || "",
    "Author":       data["Author"] || "",
    "Body":         data["Body"]   || "",
    "Created On":   existing["Created On"]   || data["Created On"] || now,
    "Updated On":   now,
    "Published On": existing["Published On"] || data["Published On"] || now,
    "Draft":        data["Draft"]    || "false",
    "Archived":     data["Archived"] || "false",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

// Read header row
function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

// Find a sheet/tab by name, ignoring case
function getSheetByNameCI(ss, name) {
  const lower = String(name).toLowerCase();
  const match = ss.getSheets().filter(s => s.getName().toLowerCase() === lower);
  return match.length ? match[0] : null;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}



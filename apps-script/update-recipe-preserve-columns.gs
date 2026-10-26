/**
 * PROPOSED Apps Script change (not applied; the Apps Script is not in this repo).
 * Paste over the existing updateRecipe() in the Apps Script project, then
 * Deploy > Manage deployments > edit > New version.
 *
 * Problem it fixes: the current updateRecipe() rewrites the whole row from
 * buildRow(), which writes "" into every column the admin form doesn't manage
 * (Collection ID, Locale ID, Item ID, Created On, Updated On, Favorite?,
 * Needs edits?, Show related recipes?). Every admin edit erased those on that row.
 *
 * This version changes only the columns the form manages and leaves all others
 * exactly as they are, the same approach updateArticle() already uses.
 * Draft/Archived come from the form (admin.html now sends the loaded recipe's values).
 */
function updateRecipe(sheet, data) {
  const headers = getHeaders(sheet);
  const slugCol = headers.indexOf("Slug");
  if (slugCol === -1) throw new Error("No 'Slug' column found in sheet");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { addRecipe(sheet, data); return; }
  const slugValues = sheet.getRange(2, slugCol + 1, lastRow - 1, 1).getValues();

  let targetRow = -1;
  for (let i = 0; i < slugValues.length; i++) {
    if (slugValues[i][0] === data.originalSlug) { targetRow = i + 2; break; }
  }
  if (targetRow === -1) throw new Error("Recipe not found for slug: " + data.originalSlug + " (not saved)");

  const existingRow = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
  const existing = {};
  headers.forEach((h, i) => { existing[h] = existingRow[i]; });

  // Keep the original Published On date so edits don't resurface in "Recently Added".
  if (existing["Published On"]) data["_preservedPublishedOn"] = existing["Published On"];

  const managed = buildRow(headers, data);          // values for managed columns
  const MANAGED = ["Name","Slug","Author","Quantity","Brief description","Category","Main image",
    "Ingredients","Instructions","Related recipes","Principal ingredients","Chef's notes",
    "Published On","Draft","Archived"];
  const row = headers.map((h, i) => MANAGED.indexOf(h) !== -1 ? managed[i] : existingRow[i]);
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
}

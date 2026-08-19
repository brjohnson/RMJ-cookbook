/**
 * ONE-TIME MIGRATION — consolidate overlapping Principal ingredient slugs
 * =======================================================================
 * Three ingredient slugs overlapped with broader ones already in use:
 *
 *   squid       → squid-octopus
 *   cod         → halibut-cod-bass
 *   vegetables  → other-vegetables
 *
 * The admin page's ingredient picker now only offers the broader slug, so this
 * brings the existing rows in line. Duplicates created by the merge are removed
 * (two calamari recipes already carried both squid and squid-octopus).
 *
 * HOW TO RUN:
 * 1. Go to script.google.com and open the cookbook project
 * 2. File → New → Script file, name it "migrate-ingredient-slugs", paste this in
 * 3. Run `previewIngredientSlugMigration` first — it writes nothing, it just
 *    logs every row it would change (View → Logs)
 * 4. If the log looks right, run `migrateIngredientSlugs`
 * 5. Delete this file from the project afterwards — it's a one-shot
 *
 * Only the "Principal ingredients" cell of affected rows is written. No other
 * column is read back or rewritten, so Collection ID, Item ID, Published On,
 * and everything else are untouched.
 */

const SLUG_MERGES = {
  "squid": "squid-octopus",
  "cod": "halibut-cod-bass",
  "vegetables": "other-vegetables",
};

// Log what would change, without writing.
function previewIngredientSlugMigration() {
  runIngredientSlugMigration(true);
}

// Apply the changes.
function migrateIngredientSlugs() {
  runIngredientSlugMigration(false);
}

function runIngredientSlugMigration(dryRun) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetByNameCI(ss, SHEET_NAME) || ss.getActiveSheet();

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const ingCol  = headers.indexOf("Principal ingredients");
  const slugCol = headers.indexOf("Slug");
  if (ingCol === -1) throw new Error("No 'Principal ingredients' column found");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log("Sheet is empty — nothing to do."); return; }

  const values = sheet.getRange(2, ingCol + 1, lastRow - 1, 1).getValues();
  const slugs  = slugCol === -1
    ? null
    : sheet.getRange(2, slugCol + 1, lastRow - 1, 1).getValues();

  let changed = 0;

  for (let i = 0; i < values.length; i++) {
    const before = String(values[i][0] || "");
    const parts  = before.split(";").map(function (s) { return s.trim(); })
                         .filter(function (s) { return s; });

    // Merge, then drop duplicates the merge may have introduced.
    const after = [];
    parts.forEach(function (p) {
      const mapped = SLUG_MERGES.hasOwnProperty(p) ? SLUG_MERGES[p] : p;
      if (after.indexOf(mapped) === -1) after.push(mapped);
    });

    const joined = after.join(";");
    if (joined === before) continue;

    changed++;
    const rowNum = i + 2;
    const label  = slugs ? slugs[i][0] : "row " + rowNum;
    Logger.log((dryRun ? "[preview] " : "[updated] ") + label + "\n    " + before + "\n → " + joined);

    if (!dryRun) sheet.getRange(rowNum, ingCol + 1).setValue(joined);
  }

  Logger.log(dryRun
    ? changed + " row(s) would change. Run migrateIngredientSlugs to apply."
    : changed + " row(s) updated.");
}

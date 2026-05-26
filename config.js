// ============================================================
//  COOKBOOK CONFIGURATION
//  Edit these values to connect your Google Sheet
// ============================================================

const CONFIG = {
  // STEP 1: Publish your Google Sheet as CSV and paste the URL here.
  // In Google Sheets: File → Share → Publish to web → select your sheet
  // → select "Comma-separated values (.csv)" → Publish → copy the link.
  //
  // The URL will look like:
  // https://docs.google.com/spreadsheets/d/SHEET_ID/pub?gid=SHEET_GID&single=true&output=csv
  //
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQK4UUmFRqF2v4zqHFcDopyHzzVRTiN72y-ybP61kV21y_C8bubDIgz2uU58SoaNzAI63Uy0QEpB5rl/pub?gid=1427526970&single=true&output=csv",

  // STEP 2: Paste your Google Apps Script Web App URL here (for adding recipes).
  // See README.md for instructions on setting up the Apps Script.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbx84qpC0PGUelGNgzxV8_rQSDqn3MlnDBnkBcyb42GMwX1ZoJ8IbIV2CX_xHQKQNEH6/exec",

  // Cookbook name shown in header
  COOKBOOK_TITLE: "The Johnson Cookbook",

  // Subtitle shown on homepage
  COOKBOOK_SUBTITLE: "Recipes passed down, shared, and loved",

  // Number of recipes to show per page (0 = show all)
  RECIPES_PER_PAGE: 0,

  // Password required to access the Add Recipe page.
  // Not cryptographically secure — just keeps casual visitors out.
  // Change this to whatever word you want your family to use.
  ADMIN_PASSWORD: "johnsons",

  // Fallback placeholder image when a recipe has no photo
  PLACEHOLDER_IMAGE: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
};

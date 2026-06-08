/**
 * הגדרות ZFR Estates
 */
window.ZFR_CONFIG = {
  /** הצגת כלי דיבוג בקונסול — false בפרודקשן */
  debug: false,

  /** קובץ נכסים מקומי (גיבוי בלבד — לא צריך לערוך ידנית) */
  listingsJsonUrl: "data/listings.json",

  /**
   * Google Sheets — מקור הנכסים (אוטומטי).
   * הגיליון: שיתוף → "כל מי שיש לו הקישור" → צופה.
   */
  listingsSheetUrl:
    "https://docs.google.com/spreadsheets/d/1G1geujcGx-PgJUILQRewO7sig4IBwLQdkIlEVi7sC4U/edit?usp=sharing",

  /** gid של הטאב (0 = הראשון). נגזר אוטומטית מה-URL אם יש #gid= */
  listingsSheetGid: "0",

  /** מפתח localStorage — שינוי מאפס cache */
  listingsCacheKey: "zfr_listings_v4",

  /** cache לגיליון — שעה */
  listingsSheetCacheTtlMs: 60 * 60 * 1000,

  /** cache לגיבוי מקומי — 24 שעות */
  listingsCacheTtlMs: 24 * 60 * 60 * 1000,

  /** דוא״ל ציבורי */
  contactEmail: "shlomo0632@gmail.com",

  /** Make — לידים מהבוט בלבד (→ וואטסאפ). לא קשור לנכסים. */
  makeLeadWebhook: "https://hook.eu1.make.com/gsmo9h6e2hfruc5hshw9e0x35oejeexv",
};

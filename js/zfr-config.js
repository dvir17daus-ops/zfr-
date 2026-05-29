/**
 * הגדרות ZFR Estates — ערכו כאן אחרי חיבור Make + Google Sheets
 */
window.ZFR_CONFIG = {
  /** הצגת כלי דיבוג בקונסול (zfrDebugSendMake וכו') — false בפרודקשן */
  debug: false,

  /** קובץ נכסים מקומי (גיבוי) */
  listingsJsonUrl: "data/listings.json",

  /**
   * Webhook Make מסוג Custom (GET) שמחזיר JSON של נכסים מהגיליון.
   * חובה ב-Webhook Response ב-Make: Access-Control-Allow-Origin (* או דומיין האתר)
   * אם CORS נכשל — האתר עובר אוטומטית ל-listingsJsonUrl
   */
  listingsLiveUrl:
    "https://yn0b1zpowfk4mh15lpogmflnfawohsxr@hook.eu1.make.com",

  /** שליחת לידים מהבוט */
  makeLeadWebhook: "https://hook.eu1.make.com/gsmo9h6e2hfruc5hshw9e0x35oejeexv",
};

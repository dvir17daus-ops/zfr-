/**
 * הגדרות ZFR Estates — ערכו כאן אחרי חיבור Make + Google Sheets
 */
window.ZFR_CONFIG = {
  /** הצגת כלי דיבוג בקונסול (zfrDebugSendMake וכו') — false בפרודקשן */
  debug: false,

  /** קובץ נכסים מקומי (גיבוי) */
  listingsJsonUrl: "data/listings.json",

  /**
   * Make GET — נכסים מ-Google Sheets (תרחיש נפרד מלידים/WhatsApp).
   * חובה: Webhook response עם JSON { "listings": [ ... ] } + CORS header.
   * בדיקה: פתחו את ה-URL בדפדפן — JSON תקין, לא "Accepted" / gibberish.
   */
  listingsLiveUrl: "https://hook.eu1.make.com/iznyfdparmxkv38sdlz4eyih3qgnygc0",

  /** דוא״ל ציבורי — דורש MX records על הדומיין (ראו data/DEPLOY-AND-EMAIL.md) */
  contactEmail: "shlomo0632@gmail.com",

  /** Webhook Make — שליחת לידים. לפרודקשן מומלץ proxy בצד שרver (ה-URL חשוף בקליינט). */
  makeLeadWebhook: "https://hook.eu1.make.com/gsmo9h6e2hfruc5hshw9e0x35oejeexv",
};

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

  /**
   * כפתור WhatsApp הצף — מציג שאלת שכנוע לפני מעבר ישיר.
   * sessionStorage: אם בחרו "WhatsApp ישיר" — לא מציגים שוב באותה סשן.
   */
  whatsappFab: {
    url:
      "https://wa.me/972547532972?text=%D7%94%D7%99%D7%99%2C%20%D7%90%D7%A9%D7%9E%D7%97%20%D7%9C%D7%A9%D7%99%D7%97%D7%94%20%D7%A2%D7%9D%20%D7%99%D7%95%D7%A2%D7%A5%20ZFR",
    rememberDirectKey: "zfr_whatsapp_direct",
  },

  /** קרדיט יוצר האתר — מוצג בתחתית העמוד */
  siteCredit: {
    label: "עיצוב ופיתוח",
    name: "דביר דאוס",
    email: "dvir17daus@gmail.com",
  },
};

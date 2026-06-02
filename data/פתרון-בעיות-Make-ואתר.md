# למה הנכסים לא מופיעים מ-Google Sheets?

## הבעיה שלך (נמצאה בבדיקה — יוני 2026)

Make **כן עובד**, אבל מחזיר JSON בפורmat שגוי:

```json
{ "listings": [{ "0": "", "1": "פנטהאוז...", "2": "תיאור...", "7": "availabl" }] }
```

במקום:

```json
{ "listings": [{ "id": "...", "title": "פנטהאוז...", "status": "available" }] }
```

**מה זה אומר:** ב-Make לא מיפית שמות עמודות — האתר קיבל מספרים במקום שמות.

**תיקון באתר:** `zfr-listings.js` יודע עכשיו לתרגם את הפורmat הזה אוטומטית (כולל `availabl` → `available`).

**תיקון ב-Make (מומלץ לטווח ארוך):** ראו למטה "Array Aggregator — מיפוי נכון".

---

## הבעיה הכי נפוצה (כללי)

כשפותחים את כתובת ה-Webhook בדפדפן ורואים:

**"There is no scenario listening for this webhook"**

זה אומר:
- התרחיש ב-Make **כבוי (OFF)**, או
- הכתובת ב-`js/zfr-config.js` **לא תואמת** ל-Webhook במודול הראשון

---

## מה לעשות — צעד אחר צעד

### 1. Make — תרחיש נכון (לא "כל 15 דקות" בלבד)

האתר צריך תשובה **מיידית** כשהדפדפן פונה ל-URL.

מבנה נכון:

```
[Webhooks: Custom webhook]  →  [Google Sheets: Search Rows]  →  [Webhooks: Webhook response]
```

- מודול 1: **Custom webhook** (Instant) — העתיקו את ה-URL המלא
- מודול 2: **Search Rows** — כל השורות מהגיליון
- מודול 3: **Webhook response** — מחזיר JSON + כותרות CORS

**לא מספיק** רק "Every 15 minutes" בלי שרשרת Webhook response — האתר לא יקבל JSON בזמן אמת.

### 2. הפעילו את התרחיש

למטה ב-Make: המתג חייב להיות **ON** (ירוק).

לחצו **Run once** ובדקו שאין שגיאה אדומה על Google Sheets.

### 3. העתיקו את ה-URL הנכון לאתר

ב-Make → מודול Webhooks הראשון → העתיקו את **כל** ה-URL  
(בצילום שלך הוא מתחיל ב-`https://hook.eu1.make.com/iznyfdpa...` — שונה מהישן!)

הדביקו ב-`js/zfr-config.js`:

```javascript
listingsLiveUrl: "https://hook.eu1.make.com/XXXXXXXXXXXXXXXX",
```

שמרו והעלו מחדש ל-GitHub Pages.

### 4. בדיקה בדפדפן (לפני האתר)

פתחו: https://hook.eu1.make.com/iznyfdparmxkv38sdlz4eyih3qgnygc0

**צריך לראות JSON תקין** (נקודתיים `:` אחרי כל שם שדה), למשל:

```json
{
  "updatedAt": "...",
  "listings": [ { "title": "...", "price": "..." } ]
}
```

אם רואים "no scenario listening" — חזרו לשלב 2.

### 5. Google Sheets — עמודות

שורה 1 = כותרות (באנגלית, **בדיוק** כך):

`id | title | description | area | type | rooms | priceLabel | status | image | featured | sortOrder`

- **status** = `available` (לא `availabl` — עם e בסוף!)
- **featured** = `yes` / `no`
- **id** — מזהה ייחודי (אפשר להשאיר ריק, האתר ייצור אוטומטית)

### 5ב. Array Aggregator — מיפוי נכון (לתקן את 0,1,2)

במודול **Array aggregator** → לחצו **Add item** לכל שדה:

| שם בשדה | מקור (מ-Google Sheets) |
|---------|-------------------------|
| id | id |
| title | title |
| description | description |
| area | area |
| type | type |
| rooms | rooms |
| priceLabel | priceLabel |
| status | status |
| image | image |
| featured | featured |
| sortOrder | sortOrder |

**לא** לבחור "Whole row" / "Row as array" — זה גורם ל-0,1,2.

### 5ג. עמודות (ישן)

### 6. CORS (חובה)

במודול **Webhook response** → Custom headers:

| Key | Value |
|-----|--------|
| Access-Control-Allow-Origin | `*` |

בלי זה האתר ייפול ל-`data/listings.json` (גיבוי).

### 7. בדיקה באתר

אחרי העלאה ל-GitHub:

1. רענון קשיח (Ctrl+Shift+R)
2. סקשן "נכסים"
3. F12 → Console — אם יש "switching to local listings.json" = בעיית URL או CORS

---

## שני Webhooks שונים — אל תבלבלו

| שימוש | איפה ב-config |
|--------|----------------|
| **נכסים מהגיליון** | `listingsLiveUrl` |
| **לידים מהבוט** | `makeLeadWebhook` |

אלה שני תרחישים נפרדים ב-Make!

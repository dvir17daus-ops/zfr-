# ZFR Estates — Google Sheets + Make + אתר

## 1. צרו גיליון Google Sheets

שם מומלץ: **ZFR — נכסים**

שורת כותרות (שורה 1):

| id | title | description | area | type | rooms | priceLabel | status | image | featured | sortOrder |
|----|-------|-------------|------|------|-------|------------|--------|-------|----------|-----------|

- **status:** `available` | `sold` | `exclusive` | `hidden`
- **featured:** `yes` / `no` (או `כן` / `לא`)
- **image:** קישור מלא לתמונה (מומלץ) — Google Drive ציבורי, Imgur, CDN וכו'
  - דוגמה Drive: `https://drive.google.com/file/d/FILE_ID/view`
  - האתר ימיר אוטומטית לקישור תצוגה כשאפשר
  - אפשר גם נתיב יחסי: `assets/listings/photo1.jpg`

## 2. תרחיש Make — האתר קורא נכסים (GET)

1. ב-Make: **Create a new scenario**
2. מודול 1: **Webhooks → Custom webhook** → הגדירו **GET**
3. מודול 2: **Google Sheets → Search rows** (בחרו את הגיליון, ללא פילטר = כל השורות)
4. מודול 3: **Array aggregator** / **JSON** — בניית מערך `listings`
5. מודול 4: **Webhooks → Webhook response**
   - Status: `200`
   - Body type: `JSON`
   - Body:

```json
{
  "updatedAt": "{{formatDate(now; \"YYYY-MM-DDTHH:mm:ssZ\")}}",
  "listings": [ ... מערך מהגיליון ... ]
}
```

### CORS (קריטי — אחרת הדפדפן יחסום)

במודול **Webhook response**, הוסיפו **Custom headers**:

| Key | Value |
|-----|--------|
| `Access-Control-Allow-Origin` | `*` |
| `Access-Control-Allow-Methods` | `GET, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type` |

לאחר עלייה לאוויר, אפשר להחליף `*` בדומיין האתר, למשל: `https://www.zfr-estates.com`

> אם CORS עדיין נכשל — האתר **לא יישבר**: `zfr-listings.js` יעבור אוטומטית ל-`data/listings.json`.

6. שמרו, העתיקו את **כתובת ה-Webhook** והדביקו ב-`js/zfr-config.js`:

```javascript
listingsLiveUrl: "https://hook.eu1.make.com/XXXXXXXX",
```

7. הפעילו את התרחיש (ON).

## 3. סטטוסים באתר

| status בגיליון | התנהגות |
|----------------|---------|
| `hidden` | לא מוצג באתר |
| `sold` | מוצג + תג **נמכר!** על התמונה |
| `exclusive` | מוצג + תג **בבלעדיות!** על התמונה |
| `available` | מוצג + תג "למכירה" קטן בגוף הכרטיס |

## 4. תמונות (למתווך)

אין צורך להעלות קבצים לשרת. הדביקו בגיליון קישור ציבורי לתמונה:

1. Google Drive → שיתוף → "כל מי שיש לו הקישור"
2. העתיקו את הקישור לעמודת `image`

## 5. בדיקה

1. פתחו את כתובת ה-Webhook GET בדפדפן — אמור JSON תקין
2. פתחו את האתר דרך שרת (לא `file://`)
3. רעננו → סקשן "נכסים"
4. אם Make חסום — בקונסול: `switching to local listings.json`

## 6. לידים (קיים)

Webhook נפרד ללידים מהבוט: `makeLeadWebhook` ב-`js/zfr-config.js`.

## 7. סדר טעינה ב-index.html

```html
<script src="js/zfr-config.js"></script>
<script src="js/zfr-listings.js"></script>
```

מיד אחר כך סקריפט הבוט (משתמש ב-`ZFR_CONFIG`).

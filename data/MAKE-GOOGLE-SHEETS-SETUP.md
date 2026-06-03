# ZFR Estates — Google Sheets + Make + אתר

## 1. צרו גיליון Google Sheets

שם מומלץ: **ZFR — נכסים**

שורת כותרות (שורה 1):

| id | title | description | area | type | rooms | priceLabel | status | image | images | featured | sortOrder |
|----|-------|-------------|------|------|-------|------------|--------|-------|--------|----------|-----------|

- **status:** `available` | `sold` | `exclusive` | `hidden`
- **featured:** `yes` / `no` (או `כן` / `לא`)
- **image:** תמונה ראשונה (חובה להצגה) — קישור Google Drive / Imgur
- **images:** תמונות נוספות (אופציונלי) — באותו תא: `קישור1|קישור2` או שורה חדשה
  - אפשר גם עמודות `image2`, `image3` בגיליון (האתר מזהה אותן)
  - בכרטיס: תמונה ראשונה + תג "2 תמונות"; בלחיצה: גלריה עם מיני-תמונות למטה
  - דוגמה Drive: `https://drive.google.com/file/d/FILE_ID/view`

## 2. תרחיש Make — האתר קורא נכסים (GET)

1. ב-Make: **Create a new scenario**
2. מודול 1: **Webhooks → Custom webhook** → הגדירו **GET**
3. מודול 2: **Google Sheets → Search rows** (בחרו את הגיליון, ללא פילטר = כל השורות)
4. מודול 3: **Flow control → Array aggregator** (חייב **אחרי** Google Sheets — לא לפניו!)

> **סדר נכון:** Webhook → Google Sheets → Array Aggregator → Webhook response  
> **סדר שגוי:** Webhook → Array Aggregator → Google Sheets (האגרגטור לא יודע מה לאסוף)
   - Source: מודול Google Sheets
   - שדות: `id`, `title`, `description`, `area`, `type`, `rooms`, `priceLabel`, `status`, `image`, `images`, `featured`, `sortOrder`
   - אם יש עמודות `image2` / `sqm` וכו' — הוסיפו גם אותן ל-Aggregator

5. מודול 4: **Webhooks → Webhook response**
   - Status: `200`
   - Body type: **Raw**
   - Body (בחרו מהמיפוי את `array` של Aggregator):

```json
{
  "updatedAt": "{{formatDate(now; \"YYYY-MM-DDTHH:mm:ssZ\")}}",
  "listings": {{json(3.array)}}
}
```

(המספר `3` = מספר מודול Aggregator אצלכם — לא תמיד 3.)

**אם בדפדפן רואים `map(9.array` או נקודה-פסיק `;` בין שדות — זה לא JSON והאתר לא יציג נכסים מ-Make.** ראו `data/פתרון-בעיות-Make-ואתר.md`.

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

## 4. תמונות (למתווך) — כמה תמונות לנכס

1. Google Drive → שיתוף → "כל מי שיש לו הקישור"
2. תמונה ראשונה → עמודת `image`
3. תמונות נוספות — **אחת מהדרכים:**
   - עמודת `images`: `קישור2|קישור3` (מפריד | או פסיק או Enter)
   - עמודות `image2`, `image3` עם קישור בכל עמודה
4. ב-Make: וודאו ש-`images` (ו-`image2` אם יש) נכללים ב-Array Aggregator

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

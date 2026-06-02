# פריסה ודוא״ל — ZFR Estates

## סטטוס (נבדק: יוני 2026)

| בדיקה | תוצאה |
|--------|--------|
| `zfr-estates.com` DNS | **לא קיים (NXDOMAIN)** — הדומיין לא רשום / לא מחובר |
| אתר חי | **503 / לא זמין** |
| `hello@zfr-estates.com` | **לא ניתן לאימות** — בלי דומיין + MX records המייל לא יעבוד |

## מה צריך לעשות לפני מסירה ללקוח

### 1. דומיין
- רכישת / חיבור `zfr-estates.com` אצל רשם (GoDaddy, Cloudflare, וכו')
- הפניית DNS ל-hosting (A record / CNAME)

### 2. פריסת האתר
ה-repo: `https://github.com/dvir17daus-ops/zfr-.git`

**אפשרות א — GitHub Pages**
1. Settings → Pages → Source: branch `main` / folder `/ (root)`
2. Custom domain: `zfr-estates.com`
3. `git push origin main` אחרי כל עדכון

**אפשרות ב — Netlify / Cloudflare Pages**
- חיבור ל-repo + build command ריק (static site)

### 3. דוא״ל `hello@zfr-estates.com`
אחרי שהדומיין פעיל:
1. Google Workspace / Zoho / Microsoft 365 — יצירת תיבה
2. או forwarding מה-registrar ל-Gmail של שלמה
3. בדיקה: שליחת מייל test ל-`hello@zfr-estates.com`

### 4. אימות אחרי deploy
פתחו בדפדפן (Ctrl+Shift+R):
- [ ] מופיע "שלמה צפר" בסקשן צוות
- [ ] אין סקשן "ערכים" נפרד (מוזג ל"אודות")
- [ ] `privacy.html` נטען
- [ ] נכסים נטענים מ-Make
- [ ] שאלון שולח ליד

## פקודות deploy (GitHub)

```bash
git add -A
git commit -m "עדכון אתר ZFR — מיזוג סקשנים, SEO, avatar"
git push origin main
```

אם GitHub Pages מופעל — האתר יתעדכן תוך 1–3 דקות.

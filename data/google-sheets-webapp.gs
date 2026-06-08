/**
 * ZFR Estates — Google Apps Script (אופציונלי)
 *
 * אם gviz/CSV לא עובד (גיליון פרטי מדי):
 * 1. בגיליון: Extensions → Apps Script
 * 2. הדביקו את הקוד הזה
 * 3. Deploy → New deployment → Web app
 *    Execute as: Me | Who has access: Anyone
 * 4. העתיקו את כתובת ה-Web app ל-js/zfr-config.js → listingsSheetUrl
 */
function doGet() {
  var sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("נכסים") ||
    SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var values = sheet.getDataRange().getValues();
  if (!values.length) {
    return jsonResponse({ updatedAt: new Date().toISOString(), listings: [] });
  }

  var headers = values[0].map(function (h) {
    return String(h || "").trim();
  });
  var listings = [];

  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    var item = {};
    var hasData = false;
    headers.forEach(function (key, idx) {
      if (!key) return;
      var val = row[idx];
      if (val !== "" && val != null) hasData = true;
      item[key] = val;
    });
    if (hasData && String(item.title || item["כותרת"] || "").trim()) {
      listings.push(item);
    }
  }

  return jsonResponse({
    updatedAt: new Date().toISOString(),
    listings: listings,
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

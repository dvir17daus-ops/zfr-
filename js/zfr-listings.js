/**
 * משיכת נכסים מ-Make (GET) + גיבוי מקומי + תצוגת פרטי נכס.
 * מבנה JSON: { updatedAt, listings: [{ id, title, description, priceLabel, image, images, ... }] }
 */
(function initZfrListings() {
  var cfg = window.ZFR_CONFIG || {};
  var gridEl = document.getElementById("propertyGrid");
  var statusEl = document.getElementById("propertyGridStatus");
  var modalEl = document.getElementById("propertyModal");
  var listingsById = Object.create(null);
  var activeListing = null;
  var galleryState = { sources: [], index: 0, alt: "" };
  var lightboxState = { sources: [], index: 0, alt: "" };

  if (!gridEl) return;

  function normalizeWebhookUrl(url) {
    var u = String(url || "").trim();
    var match = u.match(/^https:\/\/([^/@]+)@hook\.(eu\d+)\.make\.com\/?$/i);
    if (match) {
      return "https://hook." + match[2] + ".make.com/" + match[1];
    }
    return u;
  }

  function getPriceLabel(item) {
    return item.priceLabel || item.price || "";
  }

  var MEDIA_BADGE_LABELS = {
    sold: "נמכר!",
    exclusive: "בבלעדיות!",
  };

  var BODY_STATUS_LABELS = {
    available: "למכירה",
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getDriveFileId(url) {
    var str = String(url || "");
    var fileIdMatch = str.match(/drive\.google\.com\/file\/d\/([^/?]+)/i);
    if (fileIdMatch) return fileIdMatch[1];
    var openIdMatch = str.match(/[?&]id=([^&]+)/i);
    if (/drive\.google\.com/i.test(str) && openIdMatch) return openIdMatch[1];
    return null;
  }

  var MIN_CARD_IMAGE_WIDTH = 720;

  function getLocalListingImageCandidates(item) {
    if (!item || !item.id) return [];
    var id = String(item.id).trim();
    return [
      "assets/listings/" + id + ".webp",
      "assets/listings/" + id + ".jpg",
      "assets/listings/" + id + ".jpeg",
      "assets/listings/" + id + ".png",
    ];
  }

  function getImageFallbacks(raw) {
    var url = String(raw || "").trim();
    if (!url) return [];

    var fileId = getDriveFileId(url);
    if (fileId) {
      return [
        "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1920",
        "https://lh3.googleusercontent.com/d/" + fileId + "=w1920",
        "https://drive.google.com/uc?export=view&id=" + fileId,
        "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1200",
        "https://drive.google.com/uc?export=download&id=" + fileId,
      ];
    }

    if (/^https?:\/\//i.test(url)) return [url];
    return [url];
  }

  function resolveImageUrl(raw) {
    var fallbacks = getImageFallbacks(raw);
    return fallbacks[0] || "";
  }

  function escapeJsonAttr(value) {
    return JSON.stringify(value).replace(/"/g, "&quot;");
  }

  function tuneImageSharpness(img) {
    var media = img.closest(".property-card-media, .property-modal-gallery");
    if (!media) return;

    function apply() {
      var naturalW = img.naturalWidth || 0;
      var displayW = media.clientWidth || 0;
      if (naturalW > 0 && displayW > 0 && naturalW < Math.min(displayW, MIN_CARD_IMAGE_WIDTH)) {
        media.classList.add("property-card-media--native-size");
      } else {
        media.classList.remove("property-card-media--native-size");
      }
    }

    if (img.complete) apply();
    else img.addEventListener("load", apply, { once: true });
  }

  function bindImageFallbacks(root) {
    if (!root) return;
    root.querySelectorAll("img[data-fallbacks]").forEach(function (img) {
      var list = [];
      try {
        list = JSON.parse(img.getAttribute("data-fallbacks") || "[]");
      } catch (e) {
        list = [];
      }
      if (!list.length) return;

      var idx = 0;
      img.addEventListener("load", function () {
        tuneImageSharpness(img);
      });
      img.addEventListener("error", function onErr() {
        idx += 1;
        if (idx < list.length) {
          img.src = list[idx];
        } else {
          img.removeEventListener("error", onErr);
          img.classList.add("property-image--failed");
        }
      });

      if (img.complete) tuneImageSharpness(img);
    });
  }

  function buildPropertyImageMarkupFromChain(chain, alt, opts) {
    opts = opts || {};
    if (!chain.length) return "";

    var attrs =
      ' src="' +
      escapeHtml(chain[0]) +
      '" alt="' +
      escapeHtml(alt || "נכס") +
      '" decoding="async" referrerpolicy="no-referrer" data-fallbacks="' +
      escapeJsonAttr(chain) +
      '"';

    if (opts.priority) {
      attrs += ' loading="eager" fetchpriority="high"';
    } else {
      attrs += ' loading="lazy"';
    }

    return "<img" + attrs + " />";
  }

  function buildPropertyImageMarkup(raw, alt, opts) {
    return buildPropertyImageMarkupFromChain(getImageFallbacks(raw), alt, opts);
  }

  function dedupeImageSources(sources) {
    var seen = Object.create(null);
    var out = [];
    sources.forEach(function (src) {
      var trimmed = String(src || "").trim();
      if (!trimmed) return;
      var key = getDriveFileId(trimmed) || trimmed;
      if (seen[key]) return;
      seen[key] = true;
      out.push(trimmed);
    });
    return out;
  }

  /** מחלץ כל קישורי http(s) מתא — כולל כמה קישורי Drive מופרדים ברווחים (כמו ב-Make) */
  function parseImageList(value) {
    if (value == null || value === "") return [];
    if (Array.isArray(value)) {
      var merged = [];
      value.forEach(function (entry) {
        parseImageList(entry).forEach(function (url) {
          merged.push(url);
        });
      });
      return merged;
    }

    var str = String(value).trim();
    if (!str) return [];

    var urlMatches = str.match(/https?:\/\/[^\s"'<>]+/gi);
    if (urlMatches && urlMatches.length) {
      return urlMatches
        .map(function (url) {
          return url.replace(/[.,;]+$/g, "").trim();
        })
        .filter(Boolean);
    }

    return str
      .split(/[\n\r]+|[,;|]+/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
  }

  var EXTRA_IMAGE_FIELD_KEYS = [
    "images",
    "image",
    "imageUrl",
    "Image",
    "תמונה",
    "תמונות",
    "image2",
    "image3",
    "image4",
    "Image2",
    "Image3",
    "Image4",
    "תמונה2",
    "תמונה3",
    "תמונה 2",
    "תמונה 3",
    "photo2",
    "photo3",
    "photos",
    "gallery",
  ];

  function collectListingImageSources(item) {
    if (!item) return [];
    var sources = [];
    EXTRA_IMAGE_FIELD_KEYS.forEach(function (key) {
      if (item[key] == null || item[key] === "") return;
      parseImageList(item[key]).forEach(function (url) {
        sources.push(url);
      });
    });
    return dedupeImageSources(sources);
  }

  function normalizeListingImages(item) {
    if (!item) return item;
    var all = collectListingImageSources(item);
    if (all.length) {
      item.images = all;
      item.image = all[0];
    } else {
      item.images = [];
    }
    return item;
  }

  /** תמונות מהגיליון / Make — לספירה, כרטיס וגלריה במודל */
  function getListingRemoteImageSources(item) {
    if (!item) return [];
    if (Array.isArray(item.images) && item.images.length) {
      return dedupeImageSources(
        item.images.map(function (src) {
          return String(src).trim();
        })
      );
    }
    return collectListingImageSources(item);
  }

  function getPhotoCountLabel(count) {
    if (count <= 0) return "";
    if (count === 1) return "תמונה אחת";
    return String(count) + " תמונות";
  }

  function buildPhotoCountBadge(item) {
    var count = getListingRemoteImageSources(item).length;
    if (count === 0) return "";
    return (
      '<span class="property-photo-count" aria-hidden="true">' +
      escapeHtml(getPhotoCountLabel(count)) +
      "</span>"
    );
  }

  function getListingImageSources(item) {
    if (!item) return [];

    var sources = getLocalListingImageCandidates(item).slice();

    getListingRemoteImageSources(item).forEach(function (src) {
      if (sources.indexOf(src) === -1) {
        sources.push(src);
      }
    });

    return sources;
  }

  function getListingImageFallbackChain(item) {
    var chain = [];
    getListingImageSources(item).forEach(function (source) {
      getImageFallbacks(source).forEach(function (url) {
        if (chain.indexOf(url) === -1) chain.push(url);
      });
    });
    return chain;
  }

  /**
   * שרשרת fallback נפרדת לכל תמונה אמיתית בנכס — לשימוש בקרוסלה בכרטיס.
   * התמונה הראשונה כוללת גם את מועמדי הקובץ המקומיים (id.webp/jpg…).
   */
  function getListingSlideChains(item) {
    var remote = getListingRemoteImageSources(item);
    var localCandidates = getLocalListingImageCandidates(item);
    var slides = [];

    if (remote.length) {
      remote.forEach(function (src, i) {
        var chain = i === 0 ? localCandidates.slice() : [];
        getImageFallbacks(src).forEach(function (url) {
          if (chain.indexOf(url) === -1) chain.push(url);
        });
        if (chain.length) slides.push(chain);
      });
    } else if (localCandidates.length) {
      slides.push(localCandidates.slice());
    }

    return slides;
  }

  function getListingImages(item) {
    return getListingImageSources(item).map(resolveImageUrl).filter(Boolean);
  }

  function isMakeNonJsonBody(text) {
    var t = String(text || "").trim();
    if (!t) return true;
    if (/^accepted$/i.test(t)) return true;
    if (/no scenario listening/i.test(t)) return true;
    if (/map\s*\(\s*\d+\.array/i.test(t)) return true;
    if (/\"[^\"]+\"\s*;\s*[^\"]/i.test(t)) return true;
    return false;
  }

  /** סדר עמודות ב-Google Sheets — כש-Make מחזיר 0,1,2 במקום id,title,... */
  var MAKE_SHEET_COLUMN_ORDER = [
    "id",
    "title",
    "description",
    "area",
    "type",
    "rooms",
    "priceLabel",
    "status",
    "image",
    "featured",
    "sortOrder",
    "sqm",
    "floor",
    "parking",
    "year",
    "images",
  ];

  var MAKE_STATUS_ALIASES = {
    availabl: "available",
    avaliable: "available",
    available: "available",
    sold: "sold",
    exclusive: "exclusive",
    hidden: "hidden",
    "זמין": "available",
    "נמכר": "sold",
    "בבלעדיות": "exclusive",
  };

  var HEBREW_FIELD_MAP = {
    "תמונה": "image",
    "תמונות": "images",
    "תמונה2": "image2",
    "תמונה 2": "image2",
    "תמונה3": "image3",
    "מחיר": "priceLabel",
    "כותרת": "title",
    "תיאור": "description",
    "אזור": "area",
    "סוג": "type",
    "חדרים": "rooms",
    "סטטוס": "status",
    "מודגש": "featured",
  };

  function slugifyId(text) {
    var base = String(text || "listing")
      .trim()
      .slice(0, 48)
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]/g, "");
    return base || "listing-" + Date.now();
  }

  function rowFromNumericKeys(raw) {
    if (!raw || typeof raw !== "object") return null;
    var hasNumeric = Object.keys(raw).some(function (k) {
      return /^\d+$/.test(k);
    });
    if (!hasNumeric) return null;

    var out = {};
    MAKE_SHEET_COLUMN_ORDER.forEach(function (field, idx) {
      var val = raw[String(idx)];
      if (val != null && String(val).trim() !== "") {
        out[field] = val;
      }
    });
    return out;
  }

  function normalizeListingItem(raw) {
    if (!raw || typeof raw !== "object") return raw;

    var item = Object.assign({}, raw);
    var fromNumeric = rowFromNumericKeys(raw);

    if (fromNumeric) {
      /* fromNumeric אחרון — שדות מ-Google Sheets דרך Make (0,1,2…) גוברים */
      item = Object.assign({}, raw, fromNumeric);
    }

    Object.keys(raw).forEach(function (key) {
      var mapped = HEBREW_FIELD_MAP[key];
      if (mapped && (item[mapped] == null || String(item[mapped]).trim() === "")) {
        item[mapped] = raw[key];
      }
    });

    if (!item.image && (item.imageUrl || item.Image || item["תמונה"])) {
      item.image = item.imageUrl || item.Image || item["תמונה"];
    }
    if (!item.priceLabel && (item.price || item["מחיר"])) {
      item.priceLabel = item.price || item["מחיר"];
    }

    if (!item.title && (item.name || item.Name)) {
      item.title = item.name || item.Name;
    }
    if (!item.priceLabel && item.price) {
      item.priceLabel = item.price;
    }
    if (!item.id || !String(item.id).trim()) {
      item.id = slugifyId(item.title);
    }

    var statusKey = String(item.status || "available")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "");
    item.status = MAKE_STATUS_ALIASES[statusKey] || statusKey || "available";

    if (item.rooms != null && item.rooms !== "") {
      var roomsNum = Number(item.rooms);
      if (!isNaN(roomsNum)) item.rooms = roomsNum;
    }

    var featuredRaw = String(item.featured || "").trim().toLowerCase();
    item.featured =
      item.featured === true ||
      featuredRaw === "yes" ||
      featuredRaw === "כן" ||
      featuredRaw === "true" ||
      featuredRaw === "1";

    /* גיבוי אחרון — מפתחות 0,1,2… ישירות מ-Make */
    MAKE_SHEET_COLUMN_ORDER.forEach(function (field, idx) {
      if (item[field] != null && String(item[field]).trim() !== "") return;
      var numericVal = raw[String(idx)];
      if (numericVal != null && String(numericVal).trim() !== "") {
        item[field] = numericVal;
      }
    });

    normalizeListingImages(item);

    return item;
  }

  function getPropertyDetailRows(item) {
    if (!item) return [];
    var rows = [];
    var priceText = getPriceLabel(item);

    if (priceText) rows.push({ label: "מחיר", value: priceText });
    if (item.rooms != null && item.rooms !== "") {
      rows.push({ label: "חדרים", value: String(item.rooms) });
    }
    if (item.type) rows.push({ label: "סוג", value: String(item.type) });
    if (item.sqm != null && item.sqm !== "") {
      rows.push({ label: "שטח", value: String(item.sqm) + ' מ"ר' });
    }
    if (item.floor != null && item.floor !== "") {
      rows.push({ label: "קומה", value: String(item.floor) });
    }
    if (item.parking != null && item.parking !== "") {
      rows.push({ label: "חניה", value: String(item.parking) });
    }
    if (item.year != null && item.year !== "") {
      rows.push({ label: "שנת בנייה", value: String(item.year) });
    }

    return rows;
  }

  function resolveListingItem(itemOrId) {
    if (!itemOrId) return null;
    if (typeof itemOrId === "string") return listingsById[itemOrId] || null;
    if (itemOrId.id && listingsById[itemOrId.id]) return listingsById[itemOrId.id];
    return itemOrId;
  }

  function normalizeListingsArray(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(normalizeListingItem)
      .filter(function (item) {
        return item && String(item.title || "").trim();
      });
  }

  function extractListingsArray(data, opts) {
    opts = opts || {};
    if (!data) {
      throw new Error("Empty listings payload");
    }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.listings)) return data.listings;
    if (data.body && Array.isArray(data.body.listings)) return data.body.listings;
    if (opts.requireListingsKey) {
      throw new Error('Make must return JSON: { "listings": [ ... ] }');
    }
    return [];
  }

  function parseListingsJson(text, opts) {
    opts = opts || {};
    var raw = String(text || "").trim();

    if (isMakeNonJsonBody(raw)) {
      throw new Error(
        "Make returned non-JSON (e.g. Accepted or template text) — fix Webhook response in Make"
      );
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      throw new Error(
        "Invalid JSON from Make — fix Webhook response body (see data/MAKE-GOOGLE-SHEETS-SETUP.md)"
      );
    }

    return normalizeListingsArray(extractListingsArray(parsed, opts));
  }

  function fetchJson(url, opts) {
    opts = opts || {};
    return fetch(url, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
      headers: {
        Accept: "application/json",
      },
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.text();
      })
      .then(function (text) {
        if (opts.asListingsArray) {
          return parseListingsJson(text, { requireListingsKey: !!opts.requireListingsKey });
        }
        var parsed = JSON.parse(text);
        return parsed;
      });
  }

  function loadLocalListings(reason) {
    var localUrl = String(cfg.listingsJsonUrl || "data/listings.json").trim();
    if (reason) {
      console.warn("ZFR — switching to local listings.json:", reason);
    }
    return fetchJson(localUrl, { asListingsArray: true, requireListingsKey: false }).catch(
      function () {
        return fetch(localUrl, { cache: "no-store" })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function (data) {
            return normalizeListingsArray(
              extractListingsArray(data, { requireListingsKey: false })
            );
          });
      }
    );
  }

  function fetchListingsFromWebhook(webhookUrl) {
    var url = normalizeWebhookUrl(webhookUrl);
    if (!url) {
      return Promise.reject(new Error("Missing webhook URL"));
    }
    return fetchJson(url, { asListingsArray: true, requireListingsKey: true });
  }

  window.ZFR_fetchListings = function () {
    var liveUrl = normalizeWebhookUrl(cfg.listingsLiveUrl);
    if (liveUrl) {
      return fetchListingsFromWebhook(liveUrl).catch(function (err) {
        return loadLocalListings(err && err.message);
      });
    }
    return loadLocalListings();
  };

  function showLoadingState() {
    if (statusEl) {
      statusEl.textContent = "טוען נכסים מהמערכת…";
      statusEl.hidden = false;
      statusEl.classList.add("is-loading");
    }
    gridEl.innerHTML =
      '<div class="property-grid-skeleton" aria-hidden="true">' +
      '<div class="property-skeleton-card"></div>'.repeat(2) +
      "</div>";
    applyGridLayout(0);
  }

  function clearLoadingState() {
    if (statusEl) statusEl.classList.remove("is-loading");
  }

  function loadListings() {
    var liveUrl = normalizeWebhookUrl(cfg.listingsLiveUrl);

    if (!liveUrl) {
      return loadLocalListings();
    }

    return fetchListingsFromWebhook(liveUrl).catch(function (err) {
      var msg =
        (err && err.message) ||
        (err && String(err)) ||
        "Live listings unavailable (CORS/network)";
      return loadLocalListings(msg);
    });
  }

  function sortListings(list) {
    return list.slice().sort(function (a, b) {
      var ao = Number(a.sortOrder) || 999;
      var bo = Number(b.sortOrder) || 999;
      return ao - bo;
    });
  }

  function isFeatured(item) {
    return item.featured === true;
  }

  function activateScrollEl(el, delayMs) {
    if (!el) return;
    if (delayMs) el.style.transitionDelay = delayMs + "ms";
    el.classList.add("active");
  }

  function activateListingCards() {
    if (typeof window.ZFR_activateScrollElements === "function") {
      window.ZFR_activateScrollElements(gridEl);
      return;
    }
    gridEl.querySelectorAll(".slide-up-scroll").forEach(function (el, idx) {
      activateScrollEl(el, idx * 80);
    });
  }

  function buildMediaBlock(item, status, isFeaturedCard) {
    var slideChains = getListingSlideChains(item);
    if (!slideChains.length) {
      var fallbackChain = getListingImageFallbackChain(item);
      if (fallbackChain.length) slideChains = [fallbackChain];
    }
    if (!slideChains.length) return "";

    var title = item.title || "נכס";
    var slideCount = slideChains.length;

    var slidesHtml = slideChains
      .map(function (chain, idx) {
        var imgMarkup = buildPropertyImageMarkupFromChain(chain, title, {
          priority: idx === 0 && !!isFeaturedCard,
        });
        return (
          '<div class="property-card-slide' +
          (idx === 0 ? " is-active" : "") +
          '">' +
          imgMarkup +
          "</div>"
        );
      })
      .join("");

    var dotsHtml = "";
    if (slideCount > 1) {
      var dots = "";
      for (var i = 0; i < slideCount; i += 1) {
        dots +=
          '<button type="button" class="property-card-dot' +
          (i === 0 ? " is-active" : "") +
          '" data-slide-index="' +
          i +
          '" aria-label="הצגת תמונה ' +
          (i + 1) +
          '"></button>';
      }
      dotsHtml = '<div class="property-card-dots" aria-hidden="false">' + dots + "</div>";
    }

    var overlayBadge = "";
    if (status === "sold" || status === "exclusive") {
      overlayBadge =
        '<span class="property-media-badge property-media-badge--' +
        escapeHtml(status) +
        '" aria-hidden="true">' +
        escapeHtml(MEDIA_BADGE_LABELS[status]) +
        "</span>";
    }

    var photoCount = buildPhotoCountBadge(item);

    return (
      '<div class="property-card-media" data-slide-count="' +
      slideCount +
      '">' +
      '<div class="property-card-slides">' +
      slidesHtml +
      "</div>" +
      overlayBadge +
      photoCount +
      dotsHtml +
      "</div>"
    );
  }

  function buildCardMetaHtml(item) {
    return getPropertyDetailRows(item)
      .filter(function (row) {
        return row.label === "מחיר" || row.label === "חדרים" || row.label === "סוג";
      })
      .map(function (row) {
        if (row.label === "מחיר") {
          return '<span class="property-price">' + escapeHtml(row.value) + "</span>";
        }
        if (row.label === "חדרים") {
          return '<span class="property-meta-item">' + escapeHtml(row.value) + " חדרים</span>";
        }
        return '<span class="property-meta-item">' + escapeHtml(row.value) + "</span>";
      })
      .join("");
  }

  function renderListing(item, index, isFeaturedCard) {
    var status = String(item.status || "available").toLowerCase().trim();
    if (status === "hidden") return null;

    var price = buildCardMetaHtml(item);

    var bodyStatusBadge = "";
    if (status === "available" && BODY_STATUS_LABELS.available) {
      bodyStatusBadge =
        '<span class="property-status-badge property-status-badge--available">' +
        escapeHtml(BODY_STATUS_LABELS.available) +
        "</span>";
    }

    var article = document.createElement("article");
    article.className =
      "property-card property-card--interactive property-card--visible" +
      (isFeaturedCard ? " property-card--featured" : "") +
      (status === "sold" ? " property-card--sold" : "") +
      (status === "exclusive" ? " property-card--exclusive" : "");
    article.setAttribute("data-scroll-delay", String((index % 3) * 120));
    article.setAttribute("data-listing-id", String(item.id || ""));
    article.setAttribute("tabindex", "0");
    article.setAttribute("role", "button");
    article.setAttribute(
      "aria-label",
      "צפייה בפרטים: " + (item.title || "נכס") + ", " + (item.area || "")
    );

    article.innerHTML =
      buildMediaBlock(item, status, isFeaturedCard) +
      '<div class="property-card-body">' +
      bodyStatusBadge +
      "<h3>" +
      escapeHtml(item.title) +
      "</h3>" +
      '<p class="property-card-desc">' +
      escapeHtml(item.description) +
      "</p>" +
      '<div class="property-meta">' +
      price +
      "</div>" +
      '<span class="property-tag">' +
      escapeHtml(item.area) +
      "</span>" +
      '<span class="property-card-cta">לפרטים והזמנת סיור ←</span>' +
      "</div>";

    article.addEventListener("click", function () {
      openPropertyModal(item.id || item);
    });
    article.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPropertyModal(item.id || item);
      }
    });

    return article;
  }

  var CAROUSEL_INTERVAL_MS = 3500;

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function setupCardCarousel(media) {
    var count = parseInt(media.getAttribute("data-slide-count"), 10) || 0;
    var slides = media.querySelectorAll(".property-card-slide");
    var dots = media.querySelectorAll(".property-card-dot");
    if (count <= 1 || slides.length <= 1) return;

    var index = 0;
    var timer = null;
    var isVisible = true;
    var isHovered = false;

    function goTo(next) {
      var total = slides.length;
      index = ((next % total) + total) % total;
      slides.forEach(function (slide, i) {
        slide.classList.toggle("is-active", i === index);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === index);
      });
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();
      if (prefersReducedMotion() || !isVisible || isHovered) return;
      timer = setInterval(function () {
        goTo(index + 1);
      }, CAROUSEL_INTERVAL_MS);
    }

    dots.forEach(function (dot) {
      function jump(e) {
        e.stopPropagation();
        e.preventDefault();
        var target = parseInt(dot.getAttribute("data-slide-index"), 10) || 0;
        goTo(target);
        start();
      }
      dot.addEventListener("click", jump);
      dot.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") jump(e);
      });
    });

    media.addEventListener("mouseenter", function () {
      isHovered = true;
      stop();
    });
    media.addEventListener("mouseleave", function () {
      isHovered = false;
      start();
    });

    /* החלקה במגע — מעבר בין תמונות בלי לפתוח את הכרטיס */
    var touchStartX = 0;
    var touchStartY = 0;
    var touchActive = false;
    var swiped = false;

    media.addEventListener(
      "touchstart",
      function (e) {
        if (!e.touches || e.touches.length !== 1) {
          touchActive = false;
          return;
        }
        touchActive = true;
        swiped = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        stop();
      },
      { passive: true }
    );

    media.addEventListener(
      "touchend",
      function (e) {
        if (!touchActive) return;
        touchActive = false;
        var touch = (e.changedTouches && e.changedTouches[0]) || null;
        start();
        if (!touch) return;
        var dx = touch.clientX - touchStartX;
        var dy = touch.clientY - touchStartY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        swiped = true;
        /* RTL: החלקה שמאלה = הבאה, ימינה = הקודמת */
        goTo(index + (dx < 0 ? 1 : -1));
        start();
      },
      { passive: true }
    );

    /* מניעת פתיחת המודל אם המשתמש החליק על התמונה */
    media.addEventListener(
      "click",
      function (e) {
        if (swiped) {
          e.stopPropagation();
          e.preventDefault();
          swiped = false;
        }
      },
      true
    );

    if (typeof window.IntersectionObserver === "function") {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            isVisible = entry.isIntersecting;
            if (isVisible) start();
            else stop();
          });
        },
        { threshold: 0.25 }
      );
      observer.observe(media);
    }

    start();
  }

  function initCardCarousels(root) {
    if (!root) return;
    root.querySelectorAll(".property-card-media[data-slide-count]").forEach(setupCardCarousel);
  }

  function indexListings(listings) {
    listingsById = Object.create(null);
    listings.forEach(function (item) {
      if (item && item.id) listingsById[item.id] = item;
    });
  }

  function applyGridLayout(count) {
    var showcase = gridEl.closest(".properties-showcase");
    if (!showcase) return;

    Array.prototype.forEach.call(showcase.classList, function (cls) {
      if (cls.indexOf("properties-showcase--count-") === 0) {
        showcase.classList.remove(cls);
      }
    });

    var bucket = count <= 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : count === 4 ? 4 : "many";
    showcase.classList.add("properties-showcase--count-" + bucket);
    showcase.dataset.propertyCount = String(count);
  }

  function render(listings) {
    indexListings(listings);

    var visible = sortListings(listings).filter(function (item) {
      return String(item.status || "").toLowerCase().trim() !== "hidden";
    });

    gridEl.innerHTML = "";

    if (!visible.length) {
      applyGridLayout(0);
      if (statusEl) {
        statusEl.textContent = "אין נכסים זמינים כרגע — נשמח להתאים הצעה אישית בשיחה.";
        statusEl.hidden = false;
      }
      return;
    }

    if (statusEl) {
      statusEl.textContent = "";
      statusEl.hidden = true;
    }

    visible.forEach(function (item, i) {
      var card = renderListing(item, i, isFeatured(item));
      if (card) gridEl.appendChild(card);
    });

    applyGridLayout(visible.length);

    bindImageFallbacks(gridEl);
    initCardCarousels(gridEl);
  }

  function showGracefulFailure() {
    gridEl.innerHTML = "";
    applyGridLayout(0);
    if (statusEl) {
      statusEl.innerHTML =
        'לא ניתן לטעון נכסים כרגע. <a href="#concierge">דברו איתנו</a> — נשמח לשלוח תיק נכסים מותאם.';
      statusEl.hidden = false;
    }
  }

  function setGalleryImage(galleryEl, rawSource, alt) {
    if (!galleryEl) return;
    var chain = [];
    if (rawSource && String(rawSource).trim()) {
      chain = getImageFallbacks(rawSource);
    }

    if (!chain.length) {
      galleryEl.innerHTML =
        '<div class="property-modal-no-image" aria-hidden="true">תמונה בקרוב</div>';
      return;
    }

    galleryEl.innerHTML =
      '<button type="button" class="property-modal-gallery-zoom" aria-label="הגדלת תמונה — ' +
      escapeHtml(alt || "נכס") +
      '">' +
      buildPropertyImageMarkupFromChain(chain, alt || "נכס", { priority: true }) +
      '<span class="property-modal-zoom-hint" aria-hidden="true">לחיצה להגדלה</span>' +
      "</button>";
    bindImageFallbacks(galleryEl);
    bindGalleryZoom(galleryEl);
  }

  function getImageLightboxEl() {
    return document.getElementById("propertyImageLightbox");
  }

  function updateLightboxControls() {
    var prevBtn = document.getElementById("propertyImageLightboxPrev");
    var nextBtn = document.getElementById("propertyImageLightboxNext");
    var counterEl = document.getElementById("propertyImageLightboxCounter");
    var total = lightboxState.sources.length;
    var hasMultiple = total > 1;

    if (prevBtn) prevBtn.hidden = !hasMultiple;
    if (nextBtn) nextBtn.hidden = !hasMultiple;
    if (counterEl) {
      counterEl.hidden = !hasMultiple;
      if (hasMultiple) {
        counterEl.textContent = String(lightboxState.index + 1) + " / " + String(total);
      }
    }
  }

  function renderLightboxImage() {
    var img = document.getElementById("propertyImageLightboxImg");
    if (!img) return;
    var raw = lightboxState.sources[lightboxState.index];
    var chain = getImageFallbacks(raw);
    var idx = 0;

    img.classList.remove("property-image--failed");
    img.alt = lightboxState.alt || "";
    img.onerror = function () {
      idx += 1;
      if (idx < chain.length) {
        img.src = chain[idx];
      } else {
        img.onerror = null;
        img.classList.add("property-image--failed");
      }
    };
    img.src = chain[0] || "";

    updateLightboxControls();
  }

  function stepLightbox(delta) {
    var total = lightboxState.sources.length;
    if (total <= 1) return;
    lightboxState.index = (lightboxState.index + delta + total) % total;
    renderLightboxImage();

    /* שמירה על סנכרון עם הגלריה במודל */
    galleryState.index = lightboxState.index;
    showGalleryImage(lightboxState.index, { skipLightboxSync: true });
  }

  function openImageLightbox(sources, index, alt) {
    var lb = getImageLightboxEl();
    var img = document.getElementById("propertyImageLightboxImg");
    if (!lb || !img || !sources || !sources.length) return;

    lightboxState.sources = sources.slice();
    lightboxState.index = Math.max(0, Math.min(index || 0, sources.length - 1));
    lightboxState.alt = alt || "";

    renderLightboxImage();
    lb.hidden = false;
    document.body.classList.add("property-lightbox-open");
  }

  function closeImageLightbox() {
    var lb = getImageLightboxEl();
    if (!lb) return;
    lb.hidden = true;
    document.body.classList.remove("property-lightbox-open");
    var img = document.getElementById("propertyImageLightboxImg");
    if (img) {
      img.onerror = null;
      img.removeAttribute("src");
    }
    lightboxState.sources = [];
  }

  function bindGalleryZoom(galleryEl) {
    if (!galleryEl) return;
    var btn = galleryEl.querySelector(".property-modal-gallery-zoom");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var img = btn.querySelector("img");
      if (!img || img.classList.contains("property-image--failed")) return;
      var sources = galleryState.sources.length
        ? galleryState.sources
        : [img.currentSrc || img.src];
      if (!sources.length) return;
      openImageLightbox(sources, galleryState.index, galleryState.alt || img.alt || "");
    });
  }

  function showGalleryImage(idx, opts) {
    opts = opts || {};
    var galleryEl = document.getElementById("propertyModalGallery");
    var thumbsEl = document.getElementById("propertyModalThumbs");
    var total = galleryState.sources.length;
    if (!galleryEl || !total) return;

    var safeIdx = ((idx % total) + total) % total;
    galleryState.index = safeIdx;

    setGalleryImage(galleryEl, galleryState.sources[safeIdx], galleryState.alt || "נכס");

    if (thumbsEl) {
      var thumbs = thumbsEl.querySelectorAll(".property-modal-thumb");
      thumbs.forEach(function (el, i) {
        el.classList.toggle("is-active", i === safeIdx);
      });
    }

    /* אם ה-lightbox פתוח — סנכרון התמונה המוגדלת */
    if (!opts.skipLightboxSync) {
      var lb = getImageLightboxEl();
      if (lb && !lb.hidden && lightboxState.sources.length) {
        lightboxState.index = safeIdx;
        renderLightboxImage();
      }
    }
  }

  function renderModalGallery(item) {
    var galleryEl = document.getElementById("propertyModalGallery");
    var thumbsEl = document.getElementById("propertyModalThumbs");
    if (!galleryEl || !thumbsEl) return;

    var sources = getListingRemoteImageSources(item);
    galleryEl.innerHTML = "";
    thumbsEl.innerHTML = "";
    galleryState = { sources: sources.slice(), index: 0, alt: item.title || "נכס" };

    if (!sources.length) {
      var fallbackChain = getListingImageFallbackChain(item);
      if (!fallbackChain.length) {
        galleryEl.innerHTML =
          '<div class="property-modal-no-image" aria-hidden="true">תמונה בקרוב</div>';
        thumbsEl.hidden = true;
        return;
      }
      setGalleryImage(galleryEl, getListingRemoteImageSources(item)[0], item.title || "נכס");
      thumbsEl.hidden = true;
      return;
    }

    setGalleryImage(galleryEl, sources[0], item.title || "נכס");

    if (sources.length <= 1) {
      thumbsEl.hidden = true;
      return;
    }

    thumbsEl.hidden = false;
    sources.forEach(function (rawSource, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "property-modal-thumb" + (idx === 0 ? " is-active" : "");
      btn.setAttribute("aria-label", "הצגת תמונה " + (idx + 1));
      btn.innerHTML = buildPropertyImageMarkup(rawSource, "תמונה " + (idx + 1));
      btn.addEventListener("click", function () {
        showGalleryImage(idx);
      });
      thumbsEl.appendChild(btn);
    });

    bindImageFallbacks(thumbsEl);
  }

  function renderModalSpecs(item) {
    var specsEl = document.getElementById("propertyModalSpecs");
    if (!specsEl) return;
    specsEl.innerHTML = "";

    getPropertyDetailRows(item).forEach(function (spec) {
      var dt = document.createElement("dt");
      dt.textContent = spec.label;
      var dd = document.createElement("dd");
      dd.textContent = spec.value;
      specsEl.appendChild(dt);
      specsEl.appendChild(dd);
    });
  }

  function renderModalBadges(item) {
    var badgesEl = document.getElementById("propertyModalBadges");
    if (!badgesEl) return;
    badgesEl.innerHTML = "";

    var status = String(item.status || "available").toLowerCase().trim();
    if (status === "sold" || status === "exclusive") {
      var badge = document.createElement("span");
      badge.className = "property-modal-badge property-modal-badge--" + status;
      badge.textContent = MEDIA_BADGE_LABELS[status] || status;
      badgesEl.appendChild(badge);
    } else if (status === "available") {
      var avail = document.createElement("span");
      avail.className = "property-modal-badge property-modal-badge--available";
      avail.textContent = BODY_STATUS_LABELS.available;
      badgesEl.appendChild(avail);
    }
  }

  function openPropertyModal(itemOrId) {
    var item = resolveListingItem(itemOrId);
    if (!modalEl || !item) return;
    activeListing = item;

    var titleEl = document.getElementById("propertyModalTitle");
    var areaEl = document.getElementById("propertyModalArea");
    var descEl = document.getElementById("propertyModalDesc");

    if (titleEl) titleEl.textContent = item.title || "נכס";
    if (areaEl) areaEl.textContent = item.area || "";
    if (descEl) descEl.textContent = item.description || "";

    renderModalBadges(item);
    renderModalGallery(item);
    renderModalSpecs(item);

    modalEl.hidden = false;
    document.body.classList.add("property-modal-open");

    var closeBtn = document.getElementById("propertyModalClose");
    if (closeBtn) closeBtn.focus();
  }

  function closePropertyModal() {
    closeImageLightbox();
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.classList.remove("property-modal-open");
    activeListing = null;
  }

  window.ZFR_openPropertyModal = openPropertyModal;
  window.ZFR_closePropertyModal = closePropertyModal;

  function initPropertyModal() {
    if (!modalEl) return;

    var backdrop = document.getElementById("propertyModalBackdrop");
    var closeBtn = document.getElementById("propertyModalClose");
    var ctaBtn = document.getElementById("propertyModalCta");
    var contactLink = document.getElementById("propertyModalContact");

    if (backdrop) backdrop.addEventListener("click", closePropertyModal);
    if (closeBtn) closeBtn.addEventListener("click", closePropertyModal);

    if (ctaBtn) {
      ctaBtn.addEventListener("click", function () {
        if (!activeListing) return;
        closePropertyModal();
        if (typeof window.zfrInquireAboutProperty === "function") {
          window.zfrInquireAboutProperty(activeListing);
        } else {
          window.location.hash = "#concierge";
        }
      });
    }

    if (contactLink) {
      contactLink.addEventListener("click", function () {
        closePropertyModal();
      });
    }

    var lightboxEl = getImageLightboxEl();
    var lightboxBackdrop = document.getElementById("propertyImageLightboxBackdrop");
    var lightboxClose = document.getElementById("propertyImageLightboxClose");
    var lightboxPrev = document.getElementById("propertyImageLightboxPrev");
    var lightboxNext = document.getElementById("propertyImageLightboxNext");

    if (lightboxBackdrop) lightboxBackdrop.addEventListener("click", closeImageLightbox);
    if (lightboxClose) lightboxClose.addEventListener("click", closeImageLightbox);

    /* בגלריה RTL: חץ שמאלי = הבאה, חץ ימני = הקודמת */
    if (lightboxPrev) {
      lightboxPrev.addEventListener("click", function () {
        stepLightbox(-1);
      });
    }
    if (lightboxNext) {
      lightboxNext.addEventListener("click", function () {
        stepLightbox(1);
      });
    }

    if (lightboxEl) {
      var touchStartX = 0;
      var touchStartY = 0;
      var touchActive = false;

      lightboxEl.addEventListener(
        "touchstart",
        function (e) {
          if (!e.touches || e.touches.length !== 1) {
            touchActive = false;
            return;
          }
          touchActive = true;
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        },
        { passive: true }
      );

      lightboxEl.addEventListener(
        "touchend",
        function (e) {
          if (!touchActive) return;
          touchActive = false;
          var touch = (e.changedTouches && e.changedTouches[0]) || null;
          if (!touch) return;
          var dx = touch.clientX - touchStartX;
          var dy = touch.clientY - touchStartY;
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
          /* החלקה שמאלה = התמונה הבאה, ימינה = הקודמת */
          stepLightbox(dx < 0 ? 1 : -1);
        },
        { passive: true }
      );
    }

    document.addEventListener("keydown", function (e) {
      if (lightboxEl && !lightboxEl.hidden) {
        if (e.key === "Escape") {
          closeImageLightbox();
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          stepLightbox(1);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          stepLightbox(-1);
          return;
        }
        return;
      }
      if (e.key === "Escape" && !modalEl.hidden) closePropertyModal();
    });
  }

  initPropertyModal();

  showLoadingState();

  loadListings()
    .then(function (listings) {
      clearLoadingState();
      if (!Array.isArray(listings)) {
        throw new Error("Listings payload is not a valid array");
      }
      render(listings);
    })
    .catch(function (err) {
      clearLoadingState();
      console.warn("ZFR — listings could not be loaded from any source:", err);
      showGracefulFailure();
    });
})();

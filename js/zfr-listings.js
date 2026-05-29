(function initZfrListings() {
  var cfg = window.ZFR_CONFIG || {};
  var gridEl = document.getElementById("propertyGrid");
  var featuredEl = document.getElementById("propertyFeatured");
  var statusEl = document.getElementById("propertyGridStatus");

  if (!gridEl) return;

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

  /**
   * תומך ב-URL מלא (Drive, Imgur, CDN) או בנתיב יחסי באתר.
   * קישורי Google Drive "שיתוף" מומרים לתצוגה ישירה כשאפשר.
   */
  function resolveImageUrl(raw) {
    var url = String(raw || "").trim();
    if (!url) return "";

    if (/^https?:\/\//i.test(url)) {
      var fileIdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
      if (fileIdMatch) {
        return "https://drive.google.com/uc?export=view&id=" + fileIdMatch[1];
      }
      var openIdMatch = url.match(/[?&]id=([^&]+)/i);
      if (/drive\.google\.com/i.test(url) && openIdMatch) {
        return "https://drive.google.com/uc?export=view&id=" + openIdMatch[1];
      }
      return url;
    }

    return url;
  }

  function normalizePayload(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.listings)) return data.listings;
    if (data.body && Array.isArray(data.body.listings)) return data.body.listings;
    return [];
  }

  function isValidListingsArray(list) {
    return Array.isArray(list);
  }

  function fetchJson(url) {
    return fetch(url, {
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.text();
      })
      .then(function (text) {
        var parsed;
        try {
          parsed = JSON.parse(text);
        } catch (parseErr) {
          throw new Error("Invalid JSON response");
        }
        return parsed;
      });
  }

  function loadLocalListings(reason) {
    var localUrl = String(cfg.listingsJsonUrl || "data/listings.json").trim();
    if (reason) {
      console.warn("ZFR — switching to local listings.json:", reason);
    }
    return fetchJson(localUrl);
  }

  function loadListings() {
    var liveUrl = String(cfg.listingsLiveUrl || "").trim();

    if (!liveUrl) {
      return loadLocalListings();
    }

    return fetchJson(liveUrl).catch(function (err) {
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
    return (
      item.featured === true ||
      String(item.featured).toLowerCase() === "yes" ||
      item.featured === "כן"
    );
  }

  function activateScrollEl(el, delayMs) {
    if (!el) return;
    if (delayMs) el.style.transitionDelay = delayMs + "ms";
    el.classList.add("active");
  }

  function buildMediaBlock(item, status) {
    var imgSrc = resolveImageUrl(item.image || item.imageUrl);
    if (!imgSrc) return "";

    var overlayBadge = "";
    if (status === "sold" || status === "exclusive") {
      overlayBadge =
        '<span class="property-media-badge property-media-badge--' +
        escapeHtml(status) +
        '" aria-hidden="true">' +
        escapeHtml(MEDIA_BADGE_LABELS[status]) +
        "</span>";
    }

    return (
      '<div class="property-card-media">' +
      '<img src="' +
      escapeHtml(imgSrc) +
      '" alt="' +
      escapeHtml(item.title || "נכס") +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
      overlayBadge +
      "</div>"
    );
  }

  function renderListing(item, index, isFeaturedCard) {
    var status = String(item.status || "available").toLowerCase().trim();
    if (status === "hidden") return null;

    var rooms =
      item.rooms != null && item.rooms !== ""
        ? '<span class="property-meta-item">' + escapeHtml(item.rooms) + " חדרים</span>"
        : "";
    var type = item.type
      ? '<span class="property-meta-item">' + escapeHtml(item.type) + "</span>"
      : "";
    var price = item.priceLabel
      ? '<span class="property-price">' + escapeHtml(item.priceLabel) + "</span>"
      : "";

    var bodyStatusBadge = "";
    if (status === "available" && BODY_STATUS_LABELS.available) {
      bodyStatusBadge =
        '<span class="property-status-badge property-status-badge--available">' +
        escapeHtml(BODY_STATUS_LABELS.available) +
        "</span>";
    }

    var article = document.createElement("article");
    article.className =
      "property-card slide-up-scroll" +
      (isFeaturedCard ? " property-card--featured" : "") +
      (status === "sold" ? " property-card--sold" : "") +
      (status === "exclusive" ? " property-card--exclusive" : "");
    article.setAttribute("data-scroll-delay", String((index % 3) * 120));

    article.innerHTML =
      buildMediaBlock(item, status) +
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
      rooms +
      type +
      "</div>" +
      '<span class="property-tag">' +
      escapeHtml(item.area) +
      "</span>" +
      "</div>";

    return article;
  }

  function render(listings) {
    var visible = sortListings(listings).filter(function (item) {
      return String(item.status || "").toLowerCase().trim() !== "hidden";
    });

    gridEl.innerHTML = "";
    if (featuredEl) featuredEl.innerHTML = "";

    if (!visible.length) {
      if (statusEl) {
        statusEl.textContent = "אין נכסים זמינים כרגע — נשמח להתאים הצעה אישית בשיחה.";
        statusEl.hidden = false;
      }
      return;
    }

    if (statusEl) statusEl.hidden = true;

    var featured = visible.filter(isFeatured);
    var regular = visible.filter(function (l) {
      return !isFeatured(l);
    });

    if (featured.length && featuredEl) {
      featured.forEach(function (item, i) {
        var card = renderListing(item, i, true);
        if (card) featuredEl.appendChild(card);
      });
    } else if (featured.length) {
      regular = visible;
    }

    regular.forEach(function (item, i) {
      var card = renderListing(item, i, false);
      if (card) gridEl.appendChild(card);
    });

    var toActivate = document.querySelectorAll(
      "#propertyFeatured .slide-up-scroll, #propertyGrid .slide-up-scroll"
    );
    toActivate.forEach(function (el, idx) {
      window.setTimeout(function () {
        activateScrollEl(el, idx * 80);
      }, 60);
    });
  }

  function showGracefulFailure() {
    gridEl.innerHTML = "";
    if (featuredEl) featuredEl.innerHTML = "";
    if (statusEl) {
      statusEl.innerHTML =
        'לא ניתן לטעון נכסים כרגע. <a href="#concierge">דברו עם היועץ</a> — נשמח לעזור.';
      statusEl.hidden = false;
    }
  }

  if (statusEl) {
    statusEl.textContent = "טוען נכסים…";
    statusEl.hidden = false;
  }

  loadListings()
    .then(function (data) {
      var listings = normalizePayload(data);
      if (!isValidListingsArray(listings)) {
        throw new Error("Listings payload is not a valid array");
      }
      render(listings);
    })
    .catch(function (err) {
      console.warn("ZFR — listings could not be loaded from any source:", err);
      showGracefulFailure();
    });
})();

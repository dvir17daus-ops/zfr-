(function initPageScroll() {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  var hash = window.location.hash;
  if (!hash || hash === "#home") {
    window.scrollTo(0, 0);
    window.addEventListener(
      "load",
      function () {
        if (!window.location.hash || window.location.hash === "#home") {
          window.scrollTo(0, 0);
        }
      },
      { once: true }
    );
  }
})();

(function initHeaderScroll() {
  var header = document.querySelector("header");
  if (!header) return;
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();

(function initScrollReveal() {
  var selector =
    ".fade-in-scroll, .slide-up-scroll, .slide-left-scroll, .slide-right-scroll";
  var elements = document.querySelectorAll(selector);
  if (!elements.length) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function activate(el) {
    var delay = el.getAttribute("data-scroll-delay");
    if (delay && !reducedMotion) {
      el.style.transitionDelay = delay + "ms";
    }
    el.classList.add("active");
  }

  if (reducedMotion) {
    elements.forEach(activate);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        activate(entry.target);
        observer.unobserve(entry.target);
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.12,
    }
  );

  elements.forEach(function (el) {
    observer.observe(el);
  });

  requestAnimationFrame(function () {
    var viewH = window.innerHeight || document.documentElement.clientHeight;
    elements.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < viewH * 0.92 && rect.bottom > viewH * 0.08) {
        activate(el);
        observer.unobserve(el);
      }
    });
  });
})();

(function initChatFocusLinks() {
  var chatInput = document.getElementById("chatInput");
  if (!chatInput) return;

  document.querySelectorAll('a[href="#concierge"]').forEach(function (link) {
    link.addEventListener("click", function () {
      if (window.zfrOpenChat && window.matchMedia("(max-width: 1024px)").matches) {
        window.zfrOpenChat();
      }
      window.setTimeout(function () {
        if (!chatInput.disabled) {
          chatInput.focus({ preventScroll: true });
        }
      }, 450);
    });
  });
})();

(function initMobileNav() {
  var toggle = document.getElementById("navToggle");
  var drawer = document.getElementById("navDrawer");
  var backdrop = document.getElementById("navBackdrop");
  if (!toggle || !drawer || !backdrop) return;

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    backdrop.classList.toggle("is-open", open);
    backdrop.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  backdrop.addEventListener("click", function () {
    setOpen(false);
  });
  drawer.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });
})();

(function initChatFab() {
  var fab = document.getElementById("chatFab");
  var backdrop = document.getElementById("chatBackdrop");
  if (!fab || !backdrop) return;

  function setChatOpen(open) {
    document.body.classList.toggle("chat-open", open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      var input = document.getElementById("chatInput");
      if (input && !input.disabled) {
        window.setTimeout(function () {
          input.focus({ preventScroll: true });
        }, 320);
      }
    }
  }

  fab.addEventListener("click", function () {
    setChatOpen(!document.body.classList.contains("chat-open"));
  });
  backdrop.addEventListener("click", function () {
    setChatOpen(false);
  });

  window.zfrOpenChat = function () {
    setChatOpen(true);
    var concierge = document.getElementById("concierge");
    if (concierge && window.matchMedia("(min-width: 1025px)").matches) {
      concierge.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };
})();

(function initContactQuickForm() {
  var form = document.getElementById("contactQuickForm");
  var statusEl = document.getElementById("contactFormStatus");
  if (!form) return;

  var cfg = window.ZFR_CONFIG || {};
  var webhookUrl = String(cfg.makeLeadWebhook || "").trim();

  function showStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.hidden = !text;
    statusEl.classList.toggle("is-error", !!isError);
  }

  function normalizePhone(raw) {
    return String(raw || "").replace(/\D/g, "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!webhookUrl) {
      showStatus("שגיאת הגדרה — פנו אלינו בטלפון.", true);
      return;
    }

    var name = (form.clientName && form.clientName.value || "").trim();
    var phone = normalizePhone(form.phoneNumber && form.phoneNumber.value);
    if (!name || phone.length < 9) {
      showStatus("נא למלא שם ומספר טלפון תקין.", true);
      return;
    }

    var payload = {
      clientName: name,
      phoneNumber: phone,
      budget: "לא צוין",
      housingStatus: "לא צוין",
      hasPropertyToSell: "לא צוין",
      mortgageStatus: "לא צוין",
      bestTimeToCall: "לא צוין",
      propertyRequirements: "פנייה מטופס יצירת קשר",
      initialMessage: "פנייה מטופס יצירת קשר באתר",
      preferredNeighborhood: "לא צוין",
      propertyType: "לא צוין",
      source: "ZFR Contact Form",
    };

    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    showStatus("שולח…", false);

    fetch(webhookUrl, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .catch(function () {
        return fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify(payload),
        });
      })
      .then(function () {
        form.reset();
        showStatus("תודה! נחזור אליכם בהקדם.", false);
      })
      .catch(function () {
        showStatus("לא הצלחנו לשלוח — התקשרו אלינו: 052-524-0271", true);
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  });
})();

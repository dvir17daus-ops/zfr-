(function initBgVideo() {
  var video = document.querySelector(".bg-motion-video");
  if (!video) return;

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var narrow = window.matchMedia("(max-width: 768px)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;

  function disableVideo() {
    video.pause();
    video.removeAttribute("autoplay");
    var source = video.querySelector("source");
    if (source) source.removeAttribute("src");
    video.load();
  }

  if (prefersReduced || narrow || saveData) {
    disableVideo();
    return;
  }

  video.addEventListener(
    "error",
    function () {
      disableVideo();
    },
    { once: true }
  );
})();

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
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scrollObserver = null;

  function activate(el) {
    if (!el || el.classList.contains("active")) return;
    var delay = el.getAttribute("data-scroll-delay");
    if (delay && !reducedMotion) {
      el.style.transitionDelay = delay + "ms";
    }
    el.classList.add("active");
  }

  function observeElements(elements) {
    if (!elements.length) return;

    if (reducedMotion) {
      elements.forEach(activate);
      return;
    }

    if (!scrollObserver) {
      scrollObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            activate(entry.target);
            scrollObserver.unobserve(entry.target);
          });
        },
        {
          root: null,
          rootMargin: "0px 0px -10% 0px",
          threshold: 0.12,
        }
      );
    }

    elements.forEach(function (el) {
      if (el.classList.contains("active")) return;
      scrollObserver.observe(el);
    });

    requestAnimationFrame(function () {
      var viewH = window.innerHeight || document.documentElement.clientHeight;
      elements.forEach(function (el) {
        if (el.classList.contains("active")) return;
        var rect = el.getBoundingClientRect();
        if (rect.top < viewH * 0.92 && rect.bottom > viewH * 0.08) {
          activate(el);
          scrollObserver.unobserve(el);
        }
      });
    });
  }

  window.ZFR_activateScrollElements = function (container) {
    var scope = container && container.querySelectorAll ? container : document;
    var nodes = scope.querySelectorAll(selector);
    observeElements(Array.prototype.slice.call(nodes));
  };

  observeElements(Array.prototype.slice.call(document.querySelectorAll(selector)));
})();

(function initChatFocusLinks() {
  var chatInput = document.getElementById("chatInput");
  if (!chatInput) return;

  document.querySelectorAll('a[href="#concierge"]').forEach(function (link) {
    link.addEventListener("click", function () {
      if (typeof window.zfrOpenChat === "function") {
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

(function initChatOverlay() {
  var backdrop = document.getElementById("chatBackdrop");
  var closeBtn = document.getElementById("chatClose");
  var chatPanel = document.querySelector(".hero-section .chat-panel");
  if (!backdrop) return;

  function isMobileChatLayout() {
    return window.matchMedia("(max-width: 1024px)").matches;
  }

  function isChatNearViewport() {
    var shell = document.getElementById("concierge");
    if (!shell) return false;
    var rect = shell.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return rect.top < vh * 0.55 && rect.bottom > vh * 0.15;
  }

  function syncMobileChatChrome(open) {
    if (!isMobileChatLayout()) {
      document.body.classList.remove("chat-open");
      if (closeBtn) closeBtn.hidden = true;
      backdrop.setAttribute("aria-hidden", "true");
      return;
    }
    if (closeBtn) closeBtn.hidden = !open;
    backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    if (chatPanel) chatPanel.classList.add("active");
  }

  function focusChatInput() {
    var input = document.getElementById("chatInput");
    if (input && !input.disabled) {
      window.setTimeout(function () {
        input.focus({ preventScroll: true });
      }, 320);
    }
  }

  function scrollToChat() {
    var concierge = document.getElementById("concierge");
    if (concierge) {
      concierge.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function setChatOpen(open) {
    if (isMobileChatLayout()) {
      if (open && isChatNearViewport()) {
        document.body.classList.remove("chat-open");
        syncMobileChatChrome(false);
        scrollToChat();
        focusChatInput();
        return;
      }
      document.body.classList.toggle("chat-open", open);
      syncMobileChatChrome(open);
      if (open) focusChatInput();
      return;
    }

    document.body.classList.remove("chat-open");
    syncMobileChatChrome(false);
    if (open) {
      scrollToChat();
      focusChatInput();
    }
  }

  backdrop.addEventListener("click", function () {
    setChatOpen(false);
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      setChatOpen(false);
    });
  }

  window.zfrOpenChat = function () {
    if (isMobileChatLayout() && isChatNearViewport()) {
      scrollToChat();
      focusChatInput();
      return;
    }
    if (isMobileChatLayout()) {
      setChatOpen(true);
      return;
    }
    scrollToChat();
    focusChatInput();
  };

  if (chatPanel) chatPanel.classList.add("active");

  window.addEventListener(
    "resize",
    function () {
      if (!isMobileChatLayout() && document.body.classList.contains("chat-open")) {
        setChatOpen(false);
      }
    },
    { passive: true }
  );
})();

(function initTeamPortrait() {
  var ring = document.getElementById("teamPortraitRing");
  var img = document.getElementById("teamPortraitPhoto");
  var chatAvatar = document.getElementById("chatAvatarPhoto");
  var logoFallback = "assets/zfr-logo.png";

  function applyAvatarFallback() {
    if (!chatAvatar) return;
    chatAvatar.src = logoFallback;
    chatAvatar.classList.add("chat-avatar-photo--logo");
  }

  function applyAvatarPhoto() {
    if (!chatAvatar) return;
    chatAvatar.classList.remove("chat-avatar-photo--logo");
  }

  if (chatAvatar) {
    chatAvatar.addEventListener("error", applyAvatarFallback, { once: true });
    chatAvatar.addEventListener(
      "load",
      function () {
        if ((chatAvatar.naturalWidth || 0) > 0) applyAvatarPhoto();
        else applyAvatarFallback();
      },
      { once: true }
    );
  }

  if (!ring || !img) return;

  function markMissing() {
    ring.classList.add("is-empty");
    img.hidden = true;
    applyAvatarFallback();
  }

  function markLoaded() {
    ring.classList.remove("is-empty");
    img.hidden = false;
    if (chatAvatar && chatAvatar.src.indexOf("team-founder") !== -1) {
      chatAvatar.src = img.src;
      applyAvatarPhoto();
    }
  }

  img.addEventListener("error", markMissing, { once: true });

  if (img.complete) {
    if (img.naturalWidth < 1) markMissing();
    else markLoaded();
  } else {
    img.addEventListener("load", markLoaded, { once: true });
  }
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

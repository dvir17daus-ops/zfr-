(function () {
  var ZFR_DEBUG = !!(window.ZFR_CONFIG && window.ZFR_CONFIG.debug);
  var DEFAULT_WELCOME =
    "ברוכים הבאים ל-ZFR Estates. כאן תוכלו לקבל גישה לנכסים אקסקלוסיביים, כולל דירות באוף-מרקט שעדיין לא פורסמו ברשת. בואו נבדוק מה מתאים לכם.";

  function getClientName() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = params.get("client");
      if (!raw || !raw.trim()) return null;
      return decodeURIComponent(raw.trim()).replace(/\+/g, " ");
    } catch (e) {
      return null;
    }
  }

  function getWelcomeMessage() {
    var name = getClientName();
    if (name) {
      return "שלום " + name + ", " + DEFAULT_WELCOME;
    }
    return DEFAULT_WELCOME;
  }

  var messagesEl = document.getElementById("chatMessages");
  var form = document.getElementById("chatForm");
  var input = document.getElementById("chatInput");
  if (!messagesEl || !form || !input) return;

  if (window.location.protocol === "file:") {
    console.warn(
      "%cZFR — האתר נפתח כקובץ מקומי (file://). לחיבור Make פתחו עם שרת מקומי, למשל: python3 -m http.server 8080",
      "font-weight:bold;color:#fbbf24;"
    );
  }

  var submitBtn = form.querySelector('button[type="submit"]');
  var DEFAULT_INPUT_PLACEHOLDER = input.placeholder;

  function focusChatInput() {
    try {
      input.focus({ preventScroll: true });
    } catch (e) {
      input.focus();
    }
  }

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  var BETWEEN_BOT_MESSAGES_MS = prefersReducedMotion ? 200 : 1500;
  var FIRST_MESSAGE_DELAY_MS = prefersReducedMotion ? 150 : 650;
  var FINAL_STEP = 7;
  var PHONE_STEP = 6;
  var PHONE_DIGITS_ONLY = /^\d{9,15}$/;
  var MORTGAGE_READY = "כן, מוכן לפעולה";
  var MORTGAGE_IN_PROGRESS = "בתהליכים";
  var HOUSING_OWNED = "בבעלותנו";
  var HOUSING_RENTAL = "בשכירות";
  var CALL_MORNING = "בוקר (09:00-12:00)";
  var CALL_AFTERNOON = "צהריים (12:00-16:00)";
  var CALL_EVENING = "ערב (16:00-20:00)";

  /** מספר הבעלים לקבלת סיכומי לידים (0525240271 → בינלאומי) */
  var OWNER_WHATSAPP_PHONE = "972525240271";
  /**
   * מפתח CallMeBot — הפעלה חד-פעמית:
   * 1. הוסיפו לוואטסאפ את +34 644 33 66 63 בשם CallMeBot
   * 2. שלחו לו: I allow callmebot to send me messages
   * 3. העתיקו לכאן את ה-APIKEY שמתקבל בתשובה
   */
  var CALLMEBOT_API_KEY = "";

  /** Webhook Make — שליחת לידים (JSON POST) */
  var MAKE_WEBHOOK_URL =
    (window.ZFR_CONFIG && window.ZFR_CONFIG.makeLeadWebhook) ||
    "https://hook.eu1.make.com/gsmo9h6e2hfruc5hshw9e0x35oejeexv";
  var ZFR_DEBUG = !!(window.ZFR_CONFIG && window.ZFR_CONFIG.debug);
  var leadSentToMake = false;
  var makeDeliveryDebug = {
    route: null,
    status: "idle",
    at: null,
    error: null,
  };

  /** 0 = name, 1 = property requirements, 2 = budget, 3 = mortgage (QR), 4 = housing (QR), 5 = call time (QR), 6 = phone, 7 = done */
  var surveyStep = 0;
  var activeQuickRepliesEl = null;
  var isBotBusy = false;
  var botTimeouts = [];
  var lead = {
    name: null,
    propertyRequirements: null,
    initialMessage: null,
    budget: null,
    mortgageStatus: null,
    housingStatus: null,
    hasPropertyToSell: false,
    preferredNeighborhood: null,
    propertyType: null,
    bestTimeToCall: null,
    phoneNumber: null,
  };

  function isQuickReplyStep(step) {
    return step === 3 || step === 4 || step === 5;
  }

  function setPhoneCaptureMode(active) {
    if (active) {
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("autocomplete", "tel");
      input.setAttribute("maxlength", "15");
      input.placeholder = "מספר טלפון (ספרות בלבד)…";
    } else {
      input.removeAttribute("inputmode");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("maxlength", "2000");
      input.placeholder = DEFAULT_INPUT_PLACEHOLDER;
    }
  }

  function getPhoneInputRaw() {
    return (input.value || "").trim();
  }

  function normalizePhoneDigits(raw) {
    return String(raw || "").replace(/\D/g, "");
  }

  function validatePhoneNumber(digits) {
    return PHONE_DIGITS_ONLY.test(digits);
  }

  function updateInputPlaceholderForStep() {
    if (surveyStep >= FINAL_STEP) return;
    if (surveyStep === PHONE_STEP) {
      setPhoneCaptureMode(true);
      return;
    }
    setPhoneCaptureMode(false);
    if (surveyStep === 0) {
      input.placeholder = "הקלידו את שמכם…";
    } else if (surveyStep === 1) {
      input.placeholder = "תארו דרישות נכס (אזור, סוג, חדרים…)…";
    } else if (surveyStep === 2) {
      input.placeholder = "לדוגמה: 3–5 מיליון ₪…";
    } else {
      input.placeholder = DEFAULT_INPUT_PLACEHOLDER;
    }
  }

  function promptForValidPhone(userMessage, botMessage) {
    appendBubble(userMessage, "user");
    input.value = "";
    setInputDisabled(true);
    sendBotSequence([botMessage], function () {
      setPhoneCaptureMode(true);
      setInputDisabled(false);
      focusChatInput();
    });
  }

  function completePhoneCapture(phoneDigits) {
    appendBubble(phoneDigits, "user");
    input.value = "";
    lead.phoneNumber = phoneDigits;
    surveyStep = FINAL_STEP;
    logLeadSummary();
    setInputDisabled(true);
    var name = lead.name || getClientName();
    var opener = name ? "תודה " + name + "!" : "תודה רבה!";
    sendBotSequence(
      [
        opener +
          " הפרטים הועברו למחלקה הרלוונטית ב־ZFR. סוכן מומחה לאזור הזה יצור איתך קשר בזמן הקרוב.",
      ],
      setChatEnded
    );
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function clearBotTimeouts() {
    botTimeouts.forEach(function (id) {
      window.clearTimeout(id);
    });
    botTimeouts = [];
  }

  function clearStaleTypingIndicators() {
    messagesEl.querySelectorAll(".msg.assistant").forEach(function (el) {
      if (el.querySelector(".typing")) el.remove();
    });
  }

  function appendBubble(text, role) {
    var div = document.createElement("div");
    div.className = "msg " + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function showTyping() {
    var wrap = document.createElement("div");
    wrap.className = "msg assistant";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML =
      '<span class="typing"><span></span><span></span><span></span></span>';
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function setInputDisabled(disabled) {
    input.disabled = disabled;
    if (submitBtn) submitBtn.disabled = disabled;
    if (disabled) input.blur();
  }

  function setQuickReplyMode(active) {
    if (active) {
      input.placeholder = "בחרו אחת מהאפשרויות למטה…";
    } else {
      input.placeholder = DEFAULT_INPUT_PLACEHOLDER;
    }
  }

  function setChatEnded() {
    clearBotTimeouts();
    clearStaleTypingIndicators();
    isBotBusy = false;
    removeQuickReplies();
    setQuickReplyMode(false);
    setPhoneCaptureMode(false);
    setInputDisabled(true);
    input.placeholder = "השיחה הסתיימה — ניצור קשר בקרוב.";

    if (isLeadConversationComplete()) {
      sendLeadToMake();
      sendLeadSummaryToOwnerWhatsApp();
    }
  }

  function removeQuickReplies() {
    if (activeQuickRepliesEl) {
      activeQuickRepliesEl.remove();
      activeQuickRepliesEl = null;
    }
  }

  function showQuickReplies(labels, ariaLabel, onChoose) {
    removeQuickReplies();
    var wrap = document.createElement("div");
    wrap.className = "quick-replies";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", ariaLabel);

    labels.forEach(function (label) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quick-reply-btn";
      btn.textContent = label;
      btn.addEventListener("click", function () {
        if (isBotBusy) return;
        wrap.querySelectorAll(".quick-reply-btn").forEach(function (b) {
          b.disabled = true;
        });
        removeQuickReplies();
        setQuickReplyMode(false);
        appendBubble(label, "user");
        onChoose(label);
      });
      wrap.appendChild(btn);
    });

    form.parentElement.insertBefore(wrap, form);
    activeQuickRepliesEl = wrap;
    setQuickReplyMode(true);
    setInputDisabled(true);
    scrollToBottom();
  }

  function showMortgageQuickReplies() {
    showQuickReplies(
      [MORTGAGE_READY, MORTGAGE_IN_PROGRESS],
      "סטטוס משכנתא והון עצמי",
      handleMortgageSelection
    );
  }

  function showHousingQuickReplies() {
    showQuickReplies(
      [HOUSING_OWNED, HOUSING_RENTAL],
      "סטטוס דיור נוכחי",
      handleHousingSelection
    );
  }

  function showCallTimeQuickReplies() {
    showQuickReplies(
      [CALL_MORNING, CALL_AFTERNOON, CALL_EVENING],
      "זמן מועדף לשיחה",
      handleCallTimeSelection
    );
  }

  function handleMortgageSelection(choice) {
    if (surveyStep !== 3) return;
    lead.mortgageStatus = choice;
    surveyStep = 4;
    sendBotSequence(
      ["האם הנכס שבו אתם גרים כעת הוא בבעלותכם או בשכירות?"],
      showHousingQuickReplies
    );
  }

  function handleHousingSelection(choice) {
    if (surveyStep !== 4) return;
    lead.housingStatus = choice;
    lead.hasPropertyToSell = choice === HOUSING_OWNED;
    surveyStep = 5;

    var replies = [];
    if (choice === HOUSING_OWNED) {
      replies.push("נפלא! שדרוג נכס הוא המומחיות שלנו ב-ZFR.");
    }
    replies.push("מתי הכי נוח שסוכן מומחה יתקשר אליכם?");

    sendBotSequence(replies, showCallTimeQuickReplies);
  }

  function handleCallTimeSelection(choice) {
    if (surveyStep !== 5) return;
    lead.bestTimeToCall = choice;
    surveyStep = 6;
    var privacyEl = document.getElementById("chatPrivacy");
    if (privacyEl) privacyEl.hidden = false;

    sendBotSequence(
      [
        "כדי שאוכל לשלוח לך תיק נכסים רלוונטי בוואטסאפ (כולל תמונות וסיורים וירטואליים), מה מספר הטלפון הכי טוב ליצירת קשר?",
      ],
      function () {
        setPhoneCaptureMode(true);
        setInputDisabled(false);
        focusChatInput();
      }
    );
  }

  function buildLeadWhatsAppMessage() {
    var lines = ["*ליד חדש — ZFR Estates*", ""];
    var clientName = lead.name || getClientName();
    if (clientName) lines.push("שם: " + clientName);
    if (lead.phoneNumber) lines.push("טלפון לקוח: " + lead.phoneNumber);
    if (lead.budget) lines.push("תקציב: " + lead.budget);
    if (lead.mortgageStatus) lines.push("משכנתא / הון: " + lead.mortgageStatus);
    if (lead.housingStatus) lines.push("דיור נוכחי: " + lead.housingStatus);
    if (lead.bestTimeToCall) lines.push("זמן מועדף לשיחה: " + lead.bestTimeToCall);
    if (lead.propertyRequirements) lines.push("דרישות נכס: " + lead.propertyRequirements);
    if (lead.housingStatus === HOUSING_OWNED) {
      lines.push("", "⭐ לקוח בבעלות — פוטנציאל שדרוג / מכירה");
    }
    if (lead.mortgageStatus === MORTGAGE_READY) {
      lines.push("✓ מוכן לפעולה (משכנתא / הון זמין)");
    }
    lines.push("", "נשלח מהאתר · " + new Date().toLocaleString("he-IL"));
    return lines.join("\n");
  }

  var LEAD_FIELD_FALLBACK = "לא צוין";

  function leadField(value) {
    if (value === null || value === undefined) return LEAD_FIELD_FALLBACK;
    var str = String(value).trim();
    return str.length ? str : LEAD_FIELD_FALLBACK;
  }

  function isLeadConversationComplete() {
    return surveyStep >= FINAL_STEP && !!lead.phoneNumber;
  }

  function buildMakeLeadPayload() {
    var requirements =
      lead.propertyRequirements != null && String(lead.propertyRequirements).trim()
        ? lead.propertyRequirements
        : lead.initialMessage;

    return {
      clientName: leadField(lead.name || getClientName()),
      phoneNumber: leadField(lead.phoneNumber),
      budget: leadField(lead.budget),
      housingStatus: leadField(lead.housingStatus),
      hasPropertyToSell:
        lead.hasPropertyToSell === true
          ? "כן"
          : lead.hasPropertyToSell === false
            ? "לא"
            : LEAD_FIELD_FALLBACK,
      mortgageStatus: leadField(lead.mortgageStatus),
      bestTimeToCall: leadField(lead.bestTimeToCall),
      propertyRequirements: leadField(requirements),
      initialMessage: leadField(lead.initialMessage || requirements),
      preferredNeighborhood: leadField(lead.preferredNeighborhood),
      propertyType: leadField(lead.propertyType),
    };
  }

  function sendLeadToMake() {
    var webhookUrl = String(MAKE_WEBHOOK_URL || "").trim();
    if (leadSentToMake || !webhookUrl) return;
    if (!isLeadConversationComplete()) {
      console.warn(
        "ZFR — Make send skipped: conversation not complete (step " +
          surveyStep +
          ", phone " +
          (lead.phoneNumber || "missing") +
          ")"
      );
      return;
    }

    var dataToSend = buildMakeLeadPayload();
    var payloadJson = JSON.stringify(dataToSend);
    leadSentToMake = true;
    makeDeliveryDebug.route = "json";
    makeDeliveryDebug.status = "sending";
    makeDeliveryDebug.at = new Date().toISOString();
    makeDeliveryDebug.error = null;

    if (ZFR_DEBUG) {
      console.log("%cZFR — dataToSend (Make webhook)", "font-weight:bold;color:#c9a962;");
      console.log(dataToSend);
    }

    function sendNoCorsFallback() {
      makeDeliveryDebug.route = "no-cors-fallback";
      makeDeliveryDebug.status = "sending";
      makeDeliveryDebug.at = new Date().toISOString();
      makeDeliveryDebug.error = null;

      return fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: payloadJson,
      })
        .then(function () {
          leadSentToMake = true;
          makeDeliveryDebug.status = "dispatched";
          makeDeliveryDebug.at = new Date().toISOString();
          if (ZFR_DEBUG) {
            console.log(
              "%cZFR — Lead JSON dispatched to Make via no-cors fallback",
              "color:#86efac;"
            );
            console.log("%cZFR — Delivery route: no-cors-fallback", "color:#93c5fd;");
          }
        })
        .catch(function (fallbackErr) {
          leadSentToMake = false;
          makeDeliveryDebug.status = "failed";
          makeDeliveryDebug.at = new Date().toISOString();
          makeDeliveryDebug.error = String(
            (fallbackErr && fallbackErr.message) || fallbackErr || "Unknown error"
          );
          console.error("ZFR — Make webhook fallback error:", fallbackErr);
        });
    }

    fetch(webhookUrl, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: payloadJson,
    })
      .then(function () {
        leadSentToMake = true;
        makeDeliveryDebug.status = "sent";
        makeDeliveryDebug.at = new Date().toISOString();
        if (ZFR_DEBUG) {
          console.log(
            "%cZFR — Lead JSON sent to Make webhook",
            "color:#86efac;"
          );
          console.log("%cZFR — Delivery route: json", "color:#93c5fd;");
        }
      })
      .catch(function (err) {
        makeDeliveryDebug.status = "retrying-fallback";
        makeDeliveryDebug.at = new Date().toISOString();
        makeDeliveryDebug.error = String((err && err.message) || err || "Unknown error");
        console.warn("ZFR — Make webhook CORS send failed, trying no-cors fallback:", err);
        return sendNoCorsFallback();
      });
  }

  if (ZFR_DEBUG) {
    window.zfrDebugSendMake = function () {
      leadSentToMake = false;
      surveyStep = FINAL_STEP;
      if (!lead.phoneNumber) lead.phoneNumber = "0501234567";
      if (!lead.name) lead.name = "בדיקת Console";
      if (!lead.budget) lead.budget = "בדיקת חיבור Make";
      if (!lead.propertyRequirements) lead.propertyRequirements = "בדיקה ידנית מה-Console";
      sendLeadToMake();
    };
    window.zfrMakeDeliveryStatus = function () {
      console.log("%cZFR — Make delivery status", "font-weight:bold;color:#c9a962;");
      console.table(makeDeliveryDebug);
      return makeDeliveryDebug;
    };
  }

  function sendLeadSummaryToOwnerWhatsApp() {
    var text = buildLeadWhatsAppMessage();
    var ownerPhone = "+" + OWNER_WHATSAPP_PHONE;

    if (!CALLMEBOT_API_KEY) {
      console.warn(
        "%cZFR — WhatsApp: הגדירו CALLMEBOT_API_KEY בקוד כדי לקבל סיכומי לידים אוטומטית ב-0525240271",
        "font-weight:bold;color:#e4d4a5;"
      );
      console.info("תצוגה מקדימה של ההודעה:\n" + text);
      return;
    }

    var url =
      "https://api.callmebot.com/whatsapp.php?phone=" +
      encodeURIComponent(ownerPhone) +
      "&text=" +
      encodeURIComponent(text) +
      "&apikey=" +
      encodeURIComponent(CALLMEBOT_API_KEY);

    var pixel = new Image();
    pixel.referrerPolicy = "no-referrer";
    pixel.src = url;

    fetch(url, { method: "GET", mode: "no-cors" }).catch(function () {
      /* Image() above is the primary transport */
    });
  }

  function logLeadSummary() {
    if (!ZFR_DEBUG) return;
    var isOwner = lead.housingStatus === HOUSING_OWNED;
    var summary = {
      Name: lead.name || getClientName() || "—",
      "Property requirements": lead.propertyRequirements || "—",
      Budget: lead.budget || "—",
      "Housing Status": lead.housingStatus || "—",
      "Mortgage Status": lead.mortgageStatus || "—",
      "Best Time to Call": lead.bestTimeToCall || "—",
      "Phone Number": lead.phoneNumber || "—",
    };

    console.group("%cZFR Estates — Lead summary", "font-weight:bold;font-size:14px;color:#c9a962;");
    console.table(summary);
    if (isOwner) {
      console.warn(
        "%c★ Potential seller — client owns current home (upgrade opportunity) ★",
        "font-weight:bold;color:#e4d4a5;"
      );
    }
    if (lead.mortgageStatus === MORTGAGE_READY) {
      console.log("%cMortgage: Ready to act — high-intent buyer", "color:#c9a962;");
    }
    console.log("Full lead object:", lead);
    console.groupEnd();
  }

  function nextAssistantRepliesAfterUserMessage(userText) {
    if (surveyStep === 0) {
      lead.name = userText;
      surveyStep = 1;
      return ["מהן דרישות הנכס שאתם מחפשים? (אזור, סוג נכס, חדרים וכו')"];
    }
    if (surveyStep === 1) {
      lead.propertyRequirements = userText;
      surveyStep = 2;
      return ["מהו התקציב שלכם?"];
    }
    if (surveyStep === 2) {
      lead.budget = userText;
      surveyStep = 3;
      return [
        "האם כבר קיבלתם אישור עקרוני למשכנתא או שיש הון עצמי זמין?",
      ];
    }
    if (surveyStep === 3 || surveyStep === 4 || surveyStep === 5 || surveyStep === 6) {
      return [];
    }
    return [];
  }

  function sendBotSequence(messages, onDone) {
    clearBotTimeouts();
    clearStaleTypingIndicators();
    isBotBusy = true;

    if (!messages || !messages.length) {
      isBotBusy = false;
      onDone && onDone();
      return;
    }

    var index = 0;
    function next() {
      if (index >= messages.length) {
        isBotBusy = false;
        onDone && onDone();
        return;
      }
      var typing = showTyping();
      var delay =
        index === 0
          ? FIRST_MESSAGE_DELAY_MS + (prefersReducedMotion ? 0 : Math.random() * 400)
          : BETWEEN_BOT_MESSAGES_MS;
      var timeoutId = window.setTimeout(function () {
        if (typing.parentNode) typing.remove();
        appendBubble(messages[index], "assistant");
        index++;
        next();
      }, delay);
      botTimeouts.push(timeoutId);
    }
    next();
  }

  setInputDisabled(true);
  appendBubble(getWelcomeMessage(), "assistant");

  (function startNameQuestion() {
    var urlName = getClientName();
    if (urlName) {
      lead.name = urlName;
      surveyStep = 1;
      sendBotSequence(
        ["מהן דרישות הנכס שאתם מחפשים? (אזור, סוג נכס, חדרים וכו')"],
        function () {
          updateInputPlaceholderForStep();
          setInputDisabled(false);
          focusChatInput();
        }
      );
      return;
    }
    sendBotSequence(["מה שמך?"], function () {
      updateInputPlaceholderForStep();
      setInputDisabled(false);
      focusChatInput();
    });
  })();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (surveyStep >= FINAL_STEP || isQuickReplyStep(surveyStep) || isBotBusy) return;

    if (surveyStep === PHONE_STEP) {
      var phoneRaw = getPhoneInputRaw();
      if (!phoneRaw) return;

      var phoneDigits = normalizePhoneDigits(phoneRaw);
      if (!validatePhoneNumber(phoneDigits)) {
        promptForValidPhone(
          phoneRaw,
          "כדי שנוכל לשלוח לך את תיק הנכסים בוואטסאפ, נא לשלוח מספר טלפון בלבד — ספרות בלבד, 9–15 ספרות (לדוגמה: 0501234567)."
        );
        return;
      }

      completePhoneCapture(phoneDigits);
      return;
    }

    var text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    appendBubble(text, "user");

    var previousStep = surveyStep;
    var replies = nextAssistantRepliesAfterUserMessage(text);
    var awaitingMortgageChoice = previousStep === 2 && surveyStep === 3;
    var awaitingCallTimeChoice = previousStep === 4 && surveyStep === 5;
    setInputDisabled(true);

    sendBotSequence(replies, function () {
      if (surveyStep >= FINAL_STEP) {
        setChatEnded();
      } else if (awaitingMortgageChoice) {
        showMortgageQuickReplies();
      } else if (awaitingCallTimeChoice) {
        showCallTimeQuickReplies();
      } else {
        updateInputPlaceholderForStep();
        setInputDisabled(false);
        focusChatInput();
      }
    });
  });
})();

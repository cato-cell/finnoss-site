/* =========================================================
   FINNOSS – MASTER JS (REN) v3.2
   Felles logikk + medlemsregistrering + mobilmeny + medlemspopup
   NB: Denne filen skal kun lastes som ren .js-fil
   ========================================================= */

(function () {
  "use strict";

  const SEL_CAROUSEL = ".fo-carousel";
  const SEL_WRAP = ".fo-carousel-wrap";
  const SEL_CARD = ".fo-shop";
  const BTN_SEL = ".fo-carousel__btn";
  const MOBILE_BP = 640;

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function isMobile(mq) {
    return (mq || window.matchMedia(`(max-width:${MOBILE_BP}px)`)).matches;
  }

  /* =========================
     CAROUSEL
  ========================== */

  function getStepPx(car) {
    const firstCard = qs(SEL_CARD, car);
    const gap = parseFloat(getComputedStyle(car).gap || "0") || 0;

    if (!firstCard) {
      return Math.round(car.clientWidth * 0.9);
    }

    const width = firstCard.getBoundingClientRect().width || 280;
    return Math.round(width + gap);
  }

  function maxScrollLeft(car) {
    return Math.max(0, car.scrollWidth - car.clientWidth);
  }

  function shouldShowArrows(car) {
    return car.scrollWidth > car.clientWidth + 4;
  }

  function setButtonsPositionClass(wrap, mobile) {
    wrap.classList.toggle("fo-carousel-wrap--mobile", !!mobile);
  }

  function ensureButtons(car) {
    const wrap = car.closest(SEL_WRAP);
    if (!wrap) return null;

    let prev = qs(`${BTN_SEL}.fo-carousel__btn--prev`, wrap);
    let next = qs(`${BTN_SEL}.fo-carousel__btn--next`, wrap);

    if (!prev) {
      prev = document.createElement("button");
      prev.type = "button";
      prev.className = "fo-carousel__btn fo-carousel__btn--prev";
      prev.textContent = "‹";
      prev.setAttribute("aria-label", "Forrige");
      wrap.appendChild(prev);
    }

    if (!next) {
      next = document.createElement("button");
      next.type = "button";
      next.className = "fo-carousel__btn fo-carousel__btn--next";
      next.textContent = "›";
      next.setAttribute("aria-label", "Neste");
      wrap.appendChild(next);
    }

    return { wrap, prev, next };
  }

  function updateButtonsUI(car, btns, mq) {
    if (!btns) return;

    const { prev, next, wrap } = btns;
    const show = shouldShowArrows(car);

    prev.classList.toggle("is-hidden", !show);
    next.classList.toggle("is-hidden", !show);
    setButtonsPositionClass(wrap, isMobile(mq));

    if (!show) return;

    const max = maxScrollLeft(car);
    const left = car.scrollLeft;

    prev.classList.toggle("is-hidden", left <= 2);
    next.classList.toggle("is-hidden", left >= max - 2);
  }

  function scrollByDir(car, dir) {
    const step = getStepPx(car);

    try {
      car.scrollBy({
        left: dir * step,
        behavior: "smooth"
      });
    } catch (err) {
      car.scrollLeft += dir * step;
    }
  }

  function initCarouselArrows() {
    const cars = qsa(SEL_CAROUSEL);
    const mq = window.matchMedia(`(max-width:${MOBILE_BP}px)`);

    cars.forEach((car) => {
      if (car.dataset.foCarouselInit === "1") return;
      car.dataset.foCarouselInit = "1";

      const btns = ensureButtons(car);
      if (!btns) return;

      const update = () => updateButtonsUI(car, btns, mq);

      btns.prev.addEventListener("click", () => scrollByDir(car, -1));
      btns.next.addEventListener("click", () => scrollByDir(car, 1));

      car.addEventListener("scroll", update, { passive: true });

      if ("ResizeObserver" in window) {
        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(car);
      }

      if ("addEventListener" in mq) {
        mq.addEventListener("change", update);
      } else if ("addListener" in mq) {
        mq.addListener(update);
      }

      requestAnimationFrame(update);
    });
  }

  /* =========================
     FIX LINKS
  ========================== */

  function fixAnchors() {
    const root = document.getElementById("finnoss-aktor");
    if (!root) return;

    root.querySelectorAll('a[href="/heggedal/#steder"]').forEach((link) => {
      link.setAttribute("href", "/heggedal/#kategorier");

      if (link.textContent.trim().toLowerCase() === "steder") {
        link.textContent = "Kategorier";
      }
    });
  }

  function fixBackLinks() {
    const aktorRoot = document.getElementById("finnoss-aktor");
    if (!aktorRoot) return;

    qsa(".fo-back-home", aktorRoot).forEach((link) => {
      link.textContent = "← Se alle lokale bedrifter i Heggedal";
      link.setAttribute("aria-label", "Se alle lokale bedrifter i Heggedal");
      link.setAttribute("href", "/heggedal/#kategorier");
    });
  }

  /* =========================
     STICKY CTA
  ========================== */

  function initStickyCTA() {
    const stickyCTA = qs("#stickyCTA");
    const hero = qs("#finnoss-aktor .fo-hero");

    if (!stickyCTA || !hero) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          stickyCTA.classList.toggle("visible", !entry.isIntersecting);
        });
      },
      {
        threshold: 0,
        rootMargin: "-100px 0px 0px 0px"
      }
    );

    observer.observe(hero);
  }

  /* =========================
     MEMBER REGISTRATION MESSAGE
  ========================== */

  function handleRegisterMessage() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("register");
    if (!status) return;

    const container = qs(".fo-member-register");
    if (!container) return;

    let message = "";

    if (status === "success") {
      message = '<div class="fo-success">Du er nå medlem av FinnOss 🎉</div>';
    } else if (status === "exists") {
      message = '<div class="fo-error">Denne e-posten er allerede registrert</div>';
    } else if (status === "empty") {
      message = '<div class="fo-error">Alle felt må fylles ut</div>';
    }

    if (!message) return;

    container.insertAdjacentHTML("afterbegin", message);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  /* =========================
     MEMBER MODAL / POPUP
  ========================== */

  function initMemberModal() {
    const root = qs("#finnoss-heggedal");
    if (!root) return;

    const modal = qs("#fo-member-modal", root);
    const openButtons = qsa(".js-open-member-modal", root);
    const closeButtons = qsa("[data-close-member-modal]", root);

    if (!modal || !openButtons.length) return;
    if (modal.dataset.foMemberModalInit === "1") return;

    modal.dataset.foMemberModalInit = "1";

    function openMemberModal(event) {
      if (event) event.preventDefault();

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      const firstInput = qs("input:not([type='hidden'])", modal);
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 80);
      }
    }

    function closeMemberModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    openButtons.forEach((button) => {
      button.addEventListener("click", openMemberModal);
    });

    closeButtons.forEach((button) => {
      button.addEventListener("click", closeMemberModal);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeMemberModal();
      }
    });
  }

  /* =========================
     OFFER RAIL HORIZONTAL WHEEL
  ========================== */

  function initOfferRails() {
    qsa(".offer-rail").forEach((rail) => {
      if (rail.dataset.foOfferRailInit === "1") return;
      rail.dataset.foOfferRailInit = "1";

      rail.addEventListener(
        "wheel",
        (e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            rail.scrollLeft += e.deltaY;
          }
        },
        { passive: false }
      );
    });
  }

  /* =========================
     MOBILE MENU
  ========================== */

  function closeMenu(toggle, menu) {
    menu.classList.remove("is-open");
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  function openMenu(toggle, menu) {
    menu.classList.add("is-open");
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
  }

  function initFinnossMobileMenu() {
    const toggle = qs(".fo-menu-toggle");
    const menu = qs("#fo-mobile-menu");

    if (!toggle || !menu) return;
    if (toggle.dataset.foMenuInit === "1") return;

    toggle.dataset.foMenuInit = "1";
    closeMenu(toggle, menu);

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = menu.classList.contains("is-open");

      if (isOpen) {
        closeMenu(toggle, menu);
      } else {
        openMenu(toggle, menu);
      }
    });

    qsa("a", menu).forEach((link) => {
      link.addEventListener("click", function () {
        closeMenu(toggle, menu);
      });
    });

    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target) && !toggle.contains(e.target)) {
        closeMenu(toggle, menu);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeMenu(toggle, menu);
      }
    });
  }

  /* =========================
     INIT
  ========================== */

  function init() {
    initCarouselArrows();
    fixAnchors();
    fixBackLinks();
    initStickyCTA();
    handleRegisterMessage();
    initMemberModal();
    initOfferRails();
    initFinnossMobileMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* =========================================================
   FINNOSS – COOKIE BANNER v1.0
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "finnoss_cookie_consent_v1";

  function getConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
  }

  function hideBanner(banner) {
    if (!banner) return;
    banner.classList.remove("is-visible");
  }

  function showBanner(banner) {
    if (!banner) return;
    banner.classList.add("is-visible");
  }

  function initCookieBanner() {
    const banner = document.getElementById("foCookieBanner");
    const acceptBtn = document.getElementById("foCookieAccept");
    const rejectBtn = document.getElementById("foCookieReject");

    if (!banner || !acceptBtn || !rejectBtn) return;

    const existingConsent = getConsent();

    if (!existingConsent) {
      showBanner(banner);
    }

    acceptBtn.addEventListener("click", function () {
      setConsent("all");
      hideBanner(banner);

      /*
        Her kan analyseverktøy aktiveres senere.
        Eksempel: Google Analytics / Meta Pixel skal kun lastes etter "all".
      */
      window.dispatchEvent(new CustomEvent("finnoss:cookiesAccepted"));
    });

    rejectBtn.addEventListener("click", function () {
      setConsent("necessary");
      hideBanner(banner);

      window.dispatchEvent(new CustomEvent("finnoss:cookiesRejected"));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCookieBanner);
  } else {
    initCookieBanner();
  }
})();


/* =========================================================
   FinnOss – registrerings-popup (modal)
   Åpnes når man klikker en CTA som peker til /bli-medlem/.
   Bruker samme Cloudflare-funksjon (/api/registrer) som siden.
   Faller tilbake til /bli-medlem/-siden hvis JS er av.
   ========================================================= */
(function () {
  "use strict";

  var TRIGGER_SEL = 'a[href="/bli-medlem/"], a[href="/bli-medlem"]';
  var modal = null;
  var lastFocus = null;

  function buildModal() {
    var el = document.createElement("div");
    el.className = "fo-modal";
    el.id = "foRegModal";
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="fo-modal__overlay" data-close></div>' +
      '<div class="fo-modal__card" role="dialog" aria-modal="true" aria-labelledby="foRegMTitle">' +
        '<button type="button" class="fo-modal__close" data-close aria-label="Lukk">\u00d7</button>' +
        '<div class="fo-modal__body">' +
          '<div id="foRegViewM">' +
          '<div class="fo-kicker">GRATIS REGISTRERING</div>' +
          '<h2 class="fo-h2 fo-h2--post" id="foRegMTitle" style="margin:6px 0 10px;">Bli med i FinnOss</h2>' +
          '<p class="fo-muted" style="margin:0 0 18px;">Fyll inn telefon og e-post. Du f\u00e5r lokale tilbud, nyheter og informasjon fra Heggedal \u2013 normalt 1\u20134 utsendelser i m\u00e5neden. Du kan melde deg av n\u00e5r som helst.</p>' +
          '<form id="foRegFormM" novalidate>' +
            '<label class="fo-field"><span class="fo-field__label">Telefonnummer</span><input class="fo-input" type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="Ditt mobilnummer" required></label>' +
            '<label class="fo-field"><span class="fo-field__label">E-post</span><input class="fo-input" type="email" name="email" autocomplete="email" placeholder="din@epost.no" required></label>' +
            '<div class="fo-hp" aria-hidden="true"><label>Ikke fyll ut<input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>' +
            '<label class="fo-consent"><input type="checkbox" name="consent" value="yes" required><span class="fo-consent__text">Ja, jeg samtykker til at FinnOss.no kan sende meg lokale tilbud, nyheter og informasjon fra Heggedal p\u00e5 e-post og SMS. Jeg kan trekke samtykket tilbake n\u00e5r som helst via avmeldingslenke i e-post eller ved \u00e5 svare STOPP p\u00e5 SMS.</span></label>' +
            '<button type="submit" class="fo-btn fo-btn--gold fo-btn--block">Registrer meg</button>' +
            '<p id="foRegMsgM" class="fo-reg-msg" role="status" aria-live="polite"></p>' +
            '<p class="fo-fineprint">Ved registrering deltar du i trekningen av et lokalt gavekort n\u00e5r FinnOss n\u00e5r 500 registrerte brukere. Det er gratis \u00e5 delta. Se <a href="/personvern/">personvernerkl\u00e6ringen</a>.</p>' +
          '</form>' +
          '</div>' + /* slutt #foRegViewM */
          '<div id="foRegSuccessM" class="fo-modal__success" hidden>' +
            '<div class="fo-success__badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#06111d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>' +
            '<h2 class="fo-h2 fo-h2--post" style="margin:0 0 10px;">Velkommen inn! \ud83c\udf89</h2>' +
            '<p class="fo-muted" style="margin:0 0 10px;">Du er n\u00e5 registrert hos FinnOss og med i trekningen av et lokalt gavekort.</p>' +
            '<p class="fo-muted" style="margin:0 0 22px;">Vi sender deg lokale tilbud og nyheter fra Heggedal \u2013 og snart kommer egne <strong style="color:var(--fo-gold1);">medlemsfordeler</strong> hos lokale akt\u00f8rer. Hold utkikk i innboksen.</p>' +
            '<div class="fo-cta__actions" style="justify-content:center;">' +
              '<a class="fo-btn fo-btn--gold" href="/heggedal/">Utforsk Heggedal</a>' +
              '<button type="button" class="fo-btn fo-btn--ghost" data-close>Lukk</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function openModal(trigger) {
    if (!modal) return;
    lastFocus = trigger || document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("fo-modal-open");
    var first = modal.querySelector("input, button");
    if (first) first.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("fo-modal-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function trapTab(e) {
    if (e.key !== "Tab") return;
    var nodes = modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])');
    var vis = [];
    for (var i = 0; i < nodes.length; i++) { if (nodes[i].offsetParent !== null) vis.push(nodes[i]); }
    if (!vis.length) return;
    var first = vis[0], last = vis[vis.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function handleSubmit(form) {
    var msg = document.getElementById("foRegMsgM");
    var btn = form.querySelector('button[type="submit"]');
    var success = document.getElementById("foRegSuccessM");
    msg.textContent = ""; msg.classList.remove("is-error");

    var phone = form.phone.value.trim();
    var email = form.email.value.trim();
    var consent = form.consent.checked;
    var company = form.company.value.trim();

    if (!phone) { msg.textContent = "Fyll inn telefonnummer."; msg.classList.add("is-error"); form.phone.focus(); return; }
    if (!email || email.indexOf("@") === -1) { msg.textContent = "Fyll inn en gyldig e-post."; msg.classList.add("is-error"); form.email.focus(); return; }
    if (!consent) { msg.textContent = "Du m\u00e5 huke av for samtykke for \u00e5 bli med."; msg.classList.add("is-error"); return; }

    btn.disabled = true; var t = btn.textContent; btn.textContent = "Registrerer\u2026";

    fetch("/api/registrer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone, email: email, consent: consent, company: company })
    })
    .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
    .then(function (r) {
      if (r.ok && r.data && r.data.ok) { document.getElementById("foRegViewM").hidden = true; success.hidden = false; var c = modal.querySelector(".fo-modal__card"); if (c) c.scrollTop = 0; }
      else { msg.textContent = (r.data && r.data.error) || "Noe gikk galt. Pr\u00f8v igjen om litt."; msg.classList.add("is-error"); btn.disabled = false; btn.textContent = t; }
    })
    .catch(function () { msg.textContent = "Fikk ikke kontakt med serveren. Pr\u00f8v igjen."; msg.classList.add("is-error"); btn.disabled = false; btn.textContent = t; });
  }

  function init() {
    modal = buildModal();

    document.addEventListener("click", function (e) {
      if (!e.target || !e.target.closest) return;
      var trigger = e.target.closest(TRIGGER_SEL);
      if (trigger) { e.preventDefault(); openModal(trigger); return; }
      if (!modal.hidden && e.target.closest("[data-close]")) { closeModal(); }
    });

    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") closeModal();
      else trapTab(e);
    });

    var form = modal.querySelector("#foRegFormM");
    form.addEventListener("submit", function (e) { e.preventDefault(); handleSubmit(form); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();


/* =========================================================
   FinnOss – fremdriftslinje for aktørkaruseller (additiv)
   Rører ikke pil-logikken; legger bare til en gull-linje per karusell.
   ========================================================= */
(function () {
  "use strict";
  function initProgress() {
    var wraps = document.querySelectorAll(".fo-carousel-wrap");
    wraps.forEach(function (wrap) {
      var car = wrap.querySelector(".fo-carousel");
      if (!car || wrap.querySelector(".fo-car-track")) return;
      var track = document.createElement("div");
      track.className = "fo-car-track";
      track.setAttribute("aria-hidden", "true");
      var thumb = document.createElement("div");
      thumb.className = "fo-car-thumb";
      track.appendChild(thumb);
      wrap.appendChild(track);

      function update() {
        var max = car.scrollWidth - car.clientWidth;
        var visible = car.scrollWidth > 0 ? car.clientWidth / car.scrollWidth : 1;
        var w = Math.max(visible * 100, 14);
        var ratio = max > 0 ? car.scrollLeft / max : 0;
        thumb.style.width = w + "%";
        thumb.style.left = (ratio * (100 - w)) + "%";
        track.style.display = visible >= 0.999 ? "none" : "block";
      }
      car.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      if ("ResizeObserver" in window) { new ResizeObserver(update).observe(car); }
      update();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProgress);
  else initProgress();
})();

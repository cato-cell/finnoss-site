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

(() => {
  const style = document.createElement("style");
  style.id = "site-effects-styles";
  style.textContent = `
    header {
      transition: box-shadow 240ms ease, backdrop-filter 240ms ease;
    }
    header.site-is-scrolled {
      box-shadow: 0 12px 32px rgba(33, 27, 23, 0.22);
      backdrop-filter: blur(12px);
    }
    #site-header nav a {
      position: relative;
      overflow: hidden;
    }
    #site-header nav a::after {
      position: absolute;
      right: 10px;
      bottom: 2px;
      left: 10px;
      height: 1px;
      background: #efc8a5;
      content: "";
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 220ms ease;
    }
    #site-header nav a:hover::after,
    #site-header nav a[aria-current="page"]::after {
      transform: scaleX(1);
    }
    main figure img,
    main .wood-image img,
    main .product-image img,
    main .post-image img,
    main .about-image img,
    main .intro-image img {
      transition: transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    main figure:hover img,
    main .wood-piece:hover img,
    main .product:hover img,
    main .post:hover img,
    main .about-image:hover img,
    main .intro-image:hover img {
      transform: scale(1.035);
    }
    .site-scroll-reveal {
      opacity: 0;
      transform: translateY(18px);
      transition:
        opacity 640ms cubic-bezier(0.2, 0.7, 0.2, 1) var(--site-reveal-delay, 0ms),
        transform 640ms cubic-bezier(0.2, 0.7, 0.2, 1) var(--site-reveal-delay, 0ms);
    }
    .site-scroll-reveal.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    @media (prefers-reduced-motion: reduce) {
      .site-scroll-reveal {
        opacity: 1;
        transform: none;
        transition: none;
      }
      main figure:hover img,
      main .wood-piece:hover img,
      main .product:hover img,
      main .post:hover img,
      main .about-image:hover img,
      main .intro-image:hover img {
        transform: none;
      }
    }
  `;
  document.head.append(style);

  const headers = [...document.querySelectorAll("header")];
  const updateHeaderDepth = () => {
    const isScrolled = window.scrollY > 12;
    headers.forEach((header) =>
      header.classList.toggle("site-is-scrolled", isScrolled),
    );
  };
  window.addEventListener("scroll", updateHeaderDepth, { passive: true });
  updateHeaderDepth();

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reduceMotion || !("IntersectionObserver" in window)) return;

  const revealSelector = "main > *, main article, main .product, main .wood-piece";
  const observed = new WeakSet();
  let sequence = 0;
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
  );

  const observeRevealTargets = (root) => {
    const targets = [];
    if (root instanceof Element && root.matches(revealSelector)) {
      targets.push(root);
    }
    if (root.querySelectorAll) {
      targets.push(...root.querySelectorAll(revealSelector));
    }
    targets.forEach((target) => {
      if (observed.has(target)) return;
      observed.add(target);
      target.classList.add("site-scroll-reveal");
      target.style.setProperty("--site-reveal-delay", `${(sequence % 5) * 65}ms`);
      sequence += 1;
      revealObserver.observe(target);
    });
  };

  observeRevealTargets(document);
  const main = document.querySelector("main");
  if (main) {
    new MutationObserver((records) => {
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) observeRevealTargets(node);
        }),
      );
    }).observe(main, { childList: true, subtree: true });
  }
})();
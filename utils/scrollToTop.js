/**
 * Scroll-to-top button logic.
 * Shows button after scrolling past threshold, hides at top, smooth-scrolls on click.
 * @param {HTMLElement|null} btn
 * @param {number} threshold
 * @returns {() => void} cleanup function
 */
export const initScrollToTop = (btn, threshold = 320) => {
  if (!btn) return () => {};

  let ticking = false;
  let lastVisible = false;

  const update = () => {
    ticking = false;
    const shouldShow = window.scrollY > threshold;
    if (shouldShow !== lastVisible) {
      lastVisible = shouldShow;
      btn.classList.toggle("yt-scroll-top--visible", shouldShow);
      btn.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    }
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(update);
    } else {
      update();
    }
  };

  const onClick = () => {
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  };

  // Use passive listener for scroll perf
  window.addEventListener("scroll", onScroll, { passive: true });
  btn.addEventListener("click", onClick);

  // Initial state
  update();

  return () => {
    window.removeEventListener("scroll", onScroll);
    btn.removeEventListener("click", onClick);
  };
};

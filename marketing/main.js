// claude-dotfiles marketing microsite - motion + interaction
// Uses GSAP + ScrollTrigger + Lenis per motion-reference skill canonical patterns.
// CDN imports keep the local site dependency-free.

import gsap from 'https://esm.sh/gsap@3.12.5';
import ScrollTrigger from 'https://esm.sh/gsap@3.12.5/ScrollTrigger';
import Lenis from 'https://esm.sh/lenis@1.1.20';

gsap.registerPlugin(ScrollTrigger);

// Safety: if JS loaded but the gsap-driven reveal never fires (e.g. an
// element is below the fold but never enters the viewport for some reason),
// reveal everything after 4 seconds as a fail-safe.
setTimeout(() => {
  document.querySelectorAll('.js [data-reveal]:not(.is-revealed)').forEach((el) => {
    el.classList.add('is-revealed');
  });
}, 4000);

// -------------------------------------------------------------------------
// Lenis + ScrollTrigger glue (canonical 3-step from motion-reference)
// Disabled temporarily during cmux browser verification - Lenis hijacks
// native scroll which prevents cmux's scroll command from working.
// Re-enable for production by toggling LENIS_ENABLED.
// -------------------------------------------------------------------------

const LENIS_ENABLED = true;
let lenis = null;

if (LENIS_ENABLED) {
  lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    lerp: 0.1,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}

// -------------------------------------------------------------------------
// Reveal-on-mount staggered entrance
// -------------------------------------------------------------------------

const heroReveals = document.querySelectorAll('.hero [data-reveal], .site-header [data-reveal]');
gsap.to(heroReveals, {
  opacity: 1,
  y: 0,
  duration: 0.7,
  ease: 'power2.out',
  stagger: 0.08,
  delay: 0.15,
  onComplete: () => {
    heroReveals.forEach((el) => el.classList.add('is-revealed'));
  },
});

// -------------------------------------------------------------------------
// Reveal-on-scroll (for everything below the hero)
// IntersectionObserver-based trigger via ScrollTrigger.batch
// -------------------------------------------------------------------------

const scrollReveals = document.querySelectorAll(
  '.bet [data-reveal], .houses [data-reveal], .proof [data-reveal], .components [data-reveal], .install [data-reveal]'
);

ScrollTrigger.batch(scrollReveals, {
  start: 'top 88%',
  onEnter: (batch) => {
    gsap.to(batch, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power2.out',
      stagger: 0.06,
      onComplete: () => {
        batch.forEach((el) => el.classList.add('is-revealed'));
      },
    });
  },
  once: true,
});

// -------------------------------------------------------------------------
// Houses cards: subtle parallax inside each card on scroll
// -------------------------------------------------------------------------

const houses = document.querySelectorAll('.house');
houses.forEach((house) => {
  const num = house.querySelector('.house__num');
  if (!num) return;

  gsap.fromTo(
    num,
    { y: 10 },
    {
      y: -10,
      ease: 'none',
      scrollTrigger: {
        trigger: house,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
      },
    }
  );
});

// -------------------------------------------------------------------------
// Copy-to-clipboard interaction (the install commands)
// -------------------------------------------------------------------------

const copyButtons = document.querySelectorAll('[data-copy]');
copyButtons.forEach((btn) => {
  btn.addEventListener('click', async (e) => {
    const text = btn.getAttribute('data-copy');
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);

      const label = btn.querySelector('.install-block__copy-label, span') || btn;
      const original = label.textContent;
      label.textContent = 'Copied';
      btn.classList.add('is-copied');

      // 240ms acknowledgment per make-interfaces-feel-better
      gsap.fromTo(
        btn,
        { scale: 0.94 },
        { scale: 1, duration: 0.24, ease: 'back.out(2.4)' }
      );

      setTimeout(() => {
        label.textContent = original;
        btn.classList.remove('is-copied');
      }, 1800);
    } catch (err) {
      console.error('Clipboard write failed:', err);
      // Fallback: select + manual
      const range = document.createRange();
      const cmdEl = btn.previousElementSibling || btn.parentElement.querySelector('code');
      if (cmdEl) {
        range.selectNode(cmdEl);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
    }
  });
});

// -------------------------------------------------------------------------
// Smooth-scroll anchor links (Lenis-aware)
// Native scroll-into-view doesn't respect Lenis - use lenis.scrollTo
// -------------------------------------------------------------------------

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();

    // Account for sticky header height
    const headerH = document.querySelector('.site-header')?.offsetHeight || 76;
    if (lenis) {
      lenis.scrollTo(target, { offset: -headerH - 8, duration: 1.2 });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// -------------------------------------------------------------------------
// ScrollTrigger refresh after fonts load (heading metrics shift)
// -------------------------------------------------------------------------

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    ScrollTrigger.refresh();
  });
}

// Refresh after window resize too (debounced via ScrollTrigger internally)
window.addEventListener('resize', () => ScrollTrigger.refresh());

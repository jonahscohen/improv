// claude-dotfiles reference manual - motion + interaction
// GSAP + Lenis from esm.sh per motion-reference canonical patterns.
// Lessons applied from marketing/ retrospective: esm.sh not skypack;
// LENIS_ENABLED toggle for cmux verification; visible-by-default reveal.

import gsap from 'https://esm.sh/gsap@3.12.5';
import ScrollTrigger from 'https://esm.sh/gsap@3.12.5/ScrollTrigger';
import Lenis from 'https://esm.sh/lenis@1.1.20';

gsap.registerPlugin(ScrollTrigger);

document.documentElement.classList.add('js');

// -------------------------------------------------------------------------
// Lenis + ScrollTrigger glue (canonical 3-step from motion-reference)
// Toggle for cmux verification - flip false when verifying scroll-based UI
// -------------------------------------------------------------------------

const LENIS_ENABLED = true;
let lenis = null;

if (LENIS_ENABLED) {
  lenis = new Lenis({
    duration: 1.0,
    smoothWheel: true,
    lerp: 0.1,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// -------------------------------------------------------------------------
// Failsafe: reveal everything after 4s in case of timing race
// -------------------------------------------------------------------------

setTimeout(() => {
  document.querySelectorAll('.js [data-reveal]:not(.is-revealed)').forEach((el) => {
    el.classList.add('is-revealed');
  });
}, 4000);

// -------------------------------------------------------------------------
// Initial reveal on mount (header + first-fold elements)
// -------------------------------------------------------------------------

const initialReveals = document.querySelectorAll('.topbar [data-reveal], .section--hero [data-reveal]');
gsap.to(initialReveals, {
  opacity: 1,
  y: 0,
  duration: 0.6,
  ease: 'power2.out',
  stagger: 0.06,
  delay: 0.1,
  onComplete: () => {
    initialReveals.forEach((el) => el.classList.add('is-revealed'));
  },
});

// -------------------------------------------------------------------------
// Reveal-on-scroll for sections below the fold
// -------------------------------------------------------------------------

const scrollReveals = document.querySelectorAll('.section:not(.section--hero) [data-reveal]');
ScrollTrigger.batch(scrollReveals, {
  start: 'top 90%',
  onEnter: (batch) => {
    gsap.to(batch, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.05,
      onComplete: () => batch.forEach((el) => el.classList.add('is-revealed')),
    });
  },
  once: true,
});

// -------------------------------------------------------------------------
// Sidebar active-state via IntersectionObserver
// Highlights the sidebar link whose target section is currently in view.
// -------------------------------------------------------------------------

const sidebarLinks = document.querySelectorAll('.sidebar__link');
const sectionTargets = new Map();

sidebarLinks.forEach((link) => {
  const href = link.getAttribute('href');
  if (href && href.startsWith('#')) {
    const target = document.querySelector(href);
    if (target) {
      sectionTargets.set(target, link);
    }
  }
});

if ('IntersectionObserver' in window && sectionTargets.size > 0) {
  let currentActive = null;

  const observer = new IntersectionObserver(
    (entries) => {
      // Find the topmost intersecting section
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        const link = sectionTargets.get(visible[0].target);
        if (link && link !== currentActive) {
          sidebarLinks.forEach((l) => {
            l.classList.remove('is-active');
            l.removeAttribute('aria-current');
          });
          link.classList.add('is-active');
          link.setAttribute('aria-current', 'location');
          currentActive = link;
        }
      }
    },
    {
      // Trigger when section enters top 1/3 of viewport
      rootMargin: '-80px 0px -65% 0px',
      threshold: 0,
    }
  );

  sectionTargets.forEach((_link, section) => observer.observe(section));
}

// -------------------------------------------------------------------------
// Smooth-scroll anchor links (Lenis-aware - native scrollIntoView ignores Lenis)
// -------------------------------------------------------------------------

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();
    const topbarH = document.querySelector('.topbar')?.offsetHeight || 64;

    // Immediate sidebar active-state update (don't wait for IntersectionObserver)
    if (link.classList.contains('sidebar__link')) {
      sidebarLinks.forEach((l) => {
        l.classList.remove('is-active');
        l.removeAttribute('aria-current');
      });
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'location');
      // Keep the active sidebar item in view
      link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    if (lenis) {
      lenis.scrollTo(target, { offset: -topbarH - 8, duration: 1.0 });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - topbarH - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    }

    // On mobile, close the sidebar after navigating
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('is-open')) {
      sidebar.classList.remove('is-open');
      document.querySelector('.topbar-toggle')?.setAttribute('aria-expanded', 'false');
    }
  });
});

// -------------------------------------------------------------------------
// Sidebar toggle (mobile only - shown via .topbar-toggle button)
// -------------------------------------------------------------------------

const sidebarToggle = document.querySelector('.topbar-toggle');
const sidebar = document.querySelector('.sidebar');

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('is-open');
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// -------------------------------------------------------------------------
// Copy-to-clipboard for install commands + code blocks
// -------------------------------------------------------------------------

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = btn.getAttribute('data-copy');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const label = btn.querySelector('.install-block__copy-label, span') || btn;
      const original = label.textContent;
      label.textContent = 'Copied';
      btn.classList.add('is-copied');
      gsap.fromTo(btn, { scale: 0.94 }, { scale: 1, duration: 0.24, ease: 'back.out(2.4)' });
      setTimeout(() => {
        label.textContent = original;
        btn.classList.remove('is-copied');
      }, 1800);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  });
});

// -------------------------------------------------------------------------
// ScrollTrigger refresh after fonts load (heading metrics shift)
// -------------------------------------------------------------------------

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

window.addEventListener('resize', () => ScrollTrigger.refresh());

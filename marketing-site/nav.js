// Mobile nav drawer + light/dark theme toggle.
//
// Theme: data-theme on <html> is set BEFORE first paint by an inline script
// in each page's <head> (to avoid FOUC). This file only handles the click
// handler that flips data-theme and persists the choice to localStorage.
//
// Drawer: wires .nav-toggle to .topbar nav, sets aria-expanded +
// data-mobile-open so the CSS drawer can slide in. Closes on Escape, on
// link click, and on viewport resize beyond the breakpoint.
(function () {
  var THEME_KEY = 'theme';

  function initDrawer() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = toggle && document.getElementById(toggle.getAttribute('aria-controls') || 'primary-nav');
    if (!toggle || !nav) return;

    function close() {
      toggle.setAttribute('aria-expanded', 'false');
      nav.removeAttribute('data-mobile-open');
      document.body.style.overflow = '';
    }

    function open() {
      toggle.setAttribute('aria-expanded', 'true');
      nav.setAttribute('data-mobile-open', '');
      document.body.style.overflow = 'hidden';
    }

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      if (expanded) close(); else open();
    });

    var links = nav.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () {
        if (toggle.getAttribute('aria-expanded') === 'true') close();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        close();
        toggle.focus();
      }
    });

    var mq = window.matchMedia('(min-width: 768px)');
    function onChange() {
      if (mq.matches && toggle.getAttribute('aria-expanded') === 'true') close();
    }
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  function initThemeToggle() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    // Apply theme + persist + update affordance label. Pulled out so the
    // View Transitions callback (which must be synchronous) can call it
    // directly without re-reading the button each click.
    function applyTheme(next) {
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }

    btn.addEventListener('click', function (e) {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';

      // Reduced-motion or no VT API support: instant swap.
      var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!document.startViewTransition || prefersReduced) {
        applyTheme(next);
        return;
      }

      // Circle clip-path reveal from the click point. End radius reaches the
      // farthest viewport corner so the new theme fully covers the screen.
      var x = e.clientX;
      var y = e.clientY;
      var endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      var transition = document.startViewTransition(function () {
        applyTheme(next);
      });

      transition.ready.then(function () {
        document.documentElement.animate(
          {
            clipPath: [
              'circle(0px at ' + x + 'px ' + y + 'px)',
              'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)'
            ]
          },
          {
            duration: 420,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      });
    });

    var initial = document.documentElement.getAttribute('data-theme') || 'light';
    btn.setAttribute('aria-label', initial === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }

  function init() {
    initDrawer();
    initThemeToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

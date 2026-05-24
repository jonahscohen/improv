// Per-framework GSAP loading + cleanup idioms.
// Pure data + accessor. No I/O.
//
// Each framework value in TechStack.framework has its own MotionIdiom record.
// 'unknown' resolves to the vanilla idiom via the accessor's fallback.

import { TechStack } from './project-context';

export interface MotionIdiom {
  framework: TechStack['framework'];
  loadingPattern: string;
  cleanupPattern: string;
  scopeBoundary: string;
  exampleSnippet: string;
  notes: string[];
}

// Shared snippet for react/next/remix - all use the @gsap/react useGSAP hook.
const REACT_LIKE_SNIPPET = `import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

export function HeroReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from('.headline', {
      y: 40,
      opacity: 0,
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.08,
    });
  }, { scope: containerRef });
  return <div ref={containerRef}>{/* ... */}</div>;
}`;

const REACT_LIKE_NOTES = [
  '@gsap/react provides useGSAP which auto-disposes the GSAP context on unmount',
  'scope option restricts selectors to the ref - safer than global selectors',
];

const VANILLA_SNIPPET = `<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script>
  let ctx;
  document.addEventListener('DOMContentLoaded', () => {
    ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.08,
      });
    });
  });
  window.addEventListener('beforeunload', () => ctx?.revert());
</script>`;

const IDIOMS: Record<TechStack['framework'], MotionIdiom> = {
  react: {
    framework: 'react',
    loadingPattern: 'npm install gsap @gsap/react; import useGSAP from @gsap/react inside the component',
    cleanupPattern: 'useGSAP auto-disposes the underlying gsap.context on unmount',
    scopeBoundary: 'component unmount',
    exampleSnippet: REACT_LIKE_SNIPPET,
    notes: REACT_LIKE_NOTES,
  },
  next: {
    framework: 'next',
    loadingPattern: 'npm install gsap @gsap/react; import useGSAP inside a client component ("use client")',
    cleanupPattern: 'useGSAP auto-disposes on unmount; ensure SSR-safe by gating on a client component',
    scopeBoundary: 'client component unmount',
    exampleSnippet: REACT_LIKE_SNIPPET,
    notes: [
      ...REACT_LIKE_NOTES,
      'Animations require a "use client" component - server components cannot use refs or effects',
    ],
  },
  remix: {
    framework: 'remix',
    loadingPattern: 'npm install gsap @gsap/react; import useGSAP inside the route component',
    cleanupPattern: 'useGSAP auto-disposes on route change / unmount',
    scopeBoundary: 'route component unmount',
    exampleSnippet: REACT_LIKE_SNIPPET,
    notes: REACT_LIKE_NOTES,
  },
  vue: {
    framework: 'vue',
    loadingPattern: 'npm install gsap; import in <script setup>; create gsap.context() inside onMounted',
    cleanupPattern: 'onBeforeUnmount + ctx.revert() disposes the context',
    scopeBoundary: 'component unmount',
    exampleSnippet: `<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import gsap from 'gsap';

const containerRef = ref<HTMLElement | null>(null);
let ctx: gsap.Context | null = null;

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.from('.headline', {
      y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
    });
  }, containerRef.value!);
});

onBeforeUnmount(() => {
  ctx?.revert();
});
</script>

<template>
  <div ref="containerRef"><!-- ... --></div>
</template>`,
    notes: [
      'Pass the ref element as the gsap.context() scope to restrict selectors',
      'ctx.revert() reverses every transform GSAP applied - safe to call multiple times',
    ],
  },
  svelte: {
    framework: 'svelte',
    loadingPattern: 'npm install gsap; import in <script>; create gsap.context() inside onMount',
    cleanupPattern: 'onMount returns a cleanup function that calls ctx.revert()',
    scopeBoundary: 'component unmount',
    exampleSnippet: `<script lang="ts">
  import { onMount } from 'svelte';
  import gsap from 'gsap';
  let container: HTMLElement;

  onMount(() => {
    const ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
      });
    }, container);
    return () => ctx.revert();
  });
</script>

<div bind:this={container}><!-- ... --></div>`,
    notes: [
      'onMount returning a function is the canonical Svelte cleanup pattern',
      'Pass the bound element as gsap.context() scope for safe selectors',
    ],
  },
  astro: {
    framework: 'astro',
    loadingPattern: 'Add a <script> block (client-side); import gsap. For client islands, use the framework-specific idiom instead.',
    cleanupPattern: 'Listen for astro:before-swap (View Transitions) and call ctx.revert() before navigation',
    scopeBoundary: 'page navigation (View Transitions)',
    exampleSnippet: `---
// HeroReveal.astro
---
<div class="hero"><!-- ... --></div>

<script>
  import gsap from 'gsap';
  let ctx: gsap.Context;
  function init() {
    ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
      });
    });
  }
  init();
  // View Transitions API cleanup
  document.addEventListener('astro:before-swap', () => ctx?.revert());
</script>`,
    notes: [
      'Without View Transitions, the script runs once on initial page load - no cleanup needed',
      'For React/Vue/Svelte islands inside Astro, use that framework\'s motion idiom instead',
    ],
  },
  angular: {
    framework: 'angular',
    loadingPattern: 'npm install gsap; inject ElementRef in the component; use gsap.context() manually (no canonical useGSAP wrapper for Angular)',
    cleanupPattern: 'ngOnDestroy + ctx.revert() disposes the context',
    scopeBoundary: 'component destroy',
    exampleSnippet: `import { Component, ElementRef, OnInit, OnDestroy } from '@angular/core';
import gsap from 'gsap';

@Component({
  selector: 'app-hero-reveal',
  template: '<div #container><!-- ... --></div>',
})
export class HeroRevealComponent implements OnInit, OnDestroy {
  private ctx: gsap.Context | null = null;
  constructor(private host: ElementRef<HTMLElement>) {}
  ngOnInit() {
    this.ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
      });
    }, this.host.nativeElement);
  }
  ngOnDestroy() {
    this.ctx?.revert();
  }
}`,
    notes: [
      'No canonical useGSAP for Angular - the lifecycle wrapper is hand-rolled',
      'Pass host.nativeElement as gsap.context() scope to restrict selectors to this component',
    ],
  },
  wordpress: {
    framework: 'wordpress',
    loadingPattern: 'wp_enqueue_script in functions.php to load GSAP from CDN; wrap theme JS in jQuery noConflict',
    cleanupPattern: '$(window).on("beforeunload", () => ctx.revert()) handles page unload',
    scopeBoundary: 'page lifecycle',
    exampleSnippet: `// In functions.php (theme or child theme):
add_action('wp_enqueue_scripts', function () {
  wp_enqueue_script(
    'gsap',
    'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js',
    [],
    '3.12.5',
    true
  );
  wp_enqueue_script(
    'theme-motion',
    get_stylesheet_directory_uri() . '/assets/js/motion.js',
    ['gsap', 'jquery'],
    wp_get_theme()->get('Version'),
    true
  );
});

// In assets/js/motion.js:
(function ($) {
  let ctx;
  $(function () {
    ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
      });
    });
  });
  $(window).on('beforeunload', () => ctx?.revert());
})(jQuery);`,
    notes: [
      'WordPress ships jQuery in noConflict mode - always wrap theme JS in the (function ($) {})(jQuery) IIFE',
      'enqueueing in the footer (5th arg `true`) prevents render-blocking',
      'For Gutenberg block editor work, prefer the react idiom inside the block component',
    ],
  },
  drupal: {
    framework: 'drupal',
    loadingPattern: 'Declare in MODULE.libraries.yml with GSAP as external CDN dep; in JS use Drupal.behaviors.X = { attach, detach }',
    cleanupPattern: 'detach() runs ctx.revert() - also fires when AJAX content is removed',
    scopeBoundary: 'behavior detach (works on AJAX-loaded content too)',
    exampleSnippet: `# In MODULE.libraries.yml:
hero_motion:
  version: 1.x
  js:
    js/hero-motion.js: {}
  dependencies:
    - core/drupalSettings
    - core/once
  external:
    - https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js

// In js/hero-motion.js:
(function (Drupal, once) {
  Drupal.behaviors.heroMotion = {
    attach: function (context) {
      once('hero-motion', '.hero', context).forEach((el) => {
        const ctx = gsap.context(() => {
          gsap.from(el.querySelector('.headline'), {
            y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
          });
        }, el);
        el._heroMotionCtx = ctx;
      });
    },
    detach: function (context, settings, trigger) {
      if (trigger !== 'unload') return;
      context.querySelectorAll('.hero').forEach((el) => el._heroMotionCtx?.revert());
    },
  };
})(Drupal, once);`,
    notes: [
      'once() prevents re-attaching to the same element on subsequent AJAX cycles',
      'detach fires on Drupal AJAX content removal too, not just page navigation',
      'Storing ctx on the DOM element (el._heroMotionCtx) lets detach find it cleanly',
    ],
  },
  hubspot: {
    framework: 'hubspot',
    loadingPattern: 'Load GSAP via CDN ESM import (no jQuery dep on HubSpot); use gsap.context() in the module JS field',
    cleanupPattern: 'window.addEventListener("pagehide", () => ctx.revert(), { once: true })',
    scopeBoundary: 'page lifecycle',
    exampleSnippet: `// In your module's js field (module.js):
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3/+esm';

const ctx = gsap.context(() => {
  gsap.from('.headline', {
    y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
  });
}, document.querySelector('.hero'));

window.addEventListener('pagehide', () => ctx.revert(), { once: true });`,
    notes: [
      'HubSpot does not include jQuery by default - use vanilla querySelector instead',
      'pagehide fires more reliably than beforeunload on mobile Safari',
      'For multiple modules on the same page, scope each gsap.context() to its own root selector',
    ],
  },
  vanilla: {
    framework: 'vanilla',
    loadingPattern: '<script src=...> tag for GSAP from CDN, then DOMContentLoaded listener for the animation code',
    cleanupPattern: 'beforeunload handler calls ctx.revert()',
    scopeBoundary: 'page lifecycle',
    exampleSnippet: VANILLA_SNIPPET,
    notes: [
      'For ES module setups, import gsap from a bundler entry point instead of a script tag',
      'gsap.context() is optional for a single one-shot animation - it shines when multiple animations share lifecycle',
    ],
  },
  unknown: {
    framework: 'unknown',
    loadingPattern: '<script src=...> tag for GSAP from CDN, then DOMContentLoaded listener for the animation code',
    cleanupPattern: 'beforeunload handler calls ctx.revert()',
    scopeBoundary: 'page lifecycle (unknown stack - falling back to vanilla)',
    exampleSnippet: VANILLA_SNIPPET,
    notes: [
      'Stack could not be detected from filesystem or package.json - using vanilla as the safe default',
      'For an ES module setup, import gsap from a bundler entry point instead',
    ],
  },
};

export function getMotionIdiom(framework: TechStack['framework']): MotionIdiom {
  return IDIOMS[framework] ?? IDIOMS.vanilla;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const motion_stack_idioms_1 = require("../motion-stack-idioms");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(() => {
    // Every framework value must resolve to a non-null record.
    const allFrameworks = [
        'react', 'next', 'remix',
        'vue', 'svelte', 'astro',
        'angular',
        'wordpress', 'drupal', 'hubspot',
        'vanilla', 'unknown',
    ];
    for (const fw of allFrameworks) {
        const idiom = (0, motion_stack_idioms_1.getMotionIdiom)(fw);
        assertTrue(idiom != null, `${fw} resolves to non-null idiom`);
        assertTrue(idiom.loadingPattern.length > 0, `${fw} has non-empty loadingPattern`);
        assertTrue(idiom.cleanupPattern.length > 0, `${fw} has non-empty cleanupPattern`);
        assertTrue(idiom.scopeBoundary.length > 0, `${fw} has non-empty scopeBoundary`);
        assertTrue(idiom.exampleSnippet.length > 0, `${fw} has non-empty exampleSnippet`);
        assertTrue(Array.isArray(idiom.notes), `${fw} has notes array`);
    }
    // 'unknown' resolves to the same content as 'vanilla' (fallback semantics).
    const unknownIdiom = (0, motion_stack_idioms_1.getMotionIdiom)('unknown');
    const vanillaIdiom = (0, motion_stack_idioms_1.getMotionIdiom)('vanilla');
    assertTrue(unknownIdiom.exampleSnippet === vanillaIdiom.exampleSnippet, 'unknown idiom falls back to vanilla content');
    // Stack-specific keyword spot-checks - snippets must look like the framework they claim to be.
    const wp = (0, motion_stack_idioms_1.getMotionIdiom)('wordpress');
    assertTrue(/wp_enqueue_script|jQuery|\$\(function/.test(wp.exampleSnippet), `wordpress snippet contains wp_enqueue_script / jQuery / $(function: ${wp.exampleSnippet.slice(0, 80)}`);
    const drupal = (0, motion_stack_idioms_1.getMotionIdiom)('drupal');
    assertTrue(/Drupal\.behaviors/.test(drupal.exampleSnippet), `drupal snippet contains Drupal.behaviors: ${drupal.exampleSnippet.slice(0, 80)}`);
    const angular = (0, motion_stack_idioms_1.getMotionIdiom)('angular');
    assertTrue(/@Component|ngOnInit|ngOnDestroy/.test(angular.exampleSnippet), `angular snippet contains @Component / ngOnInit / ngOnDestroy: ${angular.exampleSnippet.slice(0, 80)}`);
    const react = (0, motion_stack_idioms_1.getMotionIdiom)('react');
    assertTrue(/useGSAP|@gsap\/react/.test(react.exampleSnippet), `react snippet uses useGSAP: ${react.exampleSnippet.slice(0, 80)}`);
    const hubspot = (0, motion_stack_idioms_1.getMotionIdiom)('hubspot');
    assertTrue(/pagehide|gsap\.context/.test(hubspot.exampleSnippet), `hubspot snippet has pagehide cleanup or gsap.context: ${hubspot.exampleSnippet.slice(0, 80)}`);
    const svelte = (0, motion_stack_idioms_1.getMotionIdiom)('svelte');
    assertTrue(/onMount/.test(svelte.exampleSnippet), `svelte snippet uses onMount: ${svelte.exampleSnippet.slice(0, 80)}`);
    const vue = (0, motion_stack_idioms_1.getMotionIdiom)('vue');
    assertTrue(/onBeforeUnmount|onMounted/.test(vue.exampleSnippet), `vue snippet uses onMounted/onBeforeUnmount: ${vue.exampleSnippet.slice(0, 80)}`);
    const astro = (0, motion_stack_idioms_1.getMotionIdiom)('astro');
    assertTrue(/astro:before-swap|<script>/.test(astro.exampleSnippet), `astro snippet has astro:before-swap or <script>: ${astro.exampleSnippet.slice(0, 80)}`);
    const vanilla = (0, motion_stack_idioms_1.getMotionIdiom)('vanilla');
    assertTrue(/DOMContentLoaded|<script src=/.test(vanilla.exampleSnippet), `vanilla snippet has DOMContentLoaded or <script src=: ${vanilla.exampleSnippet.slice(0, 80)}`);
    console.log('sprint3-motion-stack-idioms PASS');
})();
//# sourceMappingURL=sprint3-motion-stack-idioms.test.js.map
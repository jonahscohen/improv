"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flow_handler_motion_integration_1 = require("../flow-handler-motion-integration");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(async () => {
    const handler = new flow_handler_motion_integration_1.FlowHMotionIntegrationHandler();
    // Test 1: Drupal context emits Drupal.behaviors snippet
    const drupalResult = await handler.execute({
        utterance: 'add motion',
        projectContext: { register: 'product', product: {}, design: {} },
        metadata: {
            techStack: { framework: 'drupal', hasAnimationLib: false, hasTypescript: false, packageManager: 'unknown' },
        },
    });
    assertTrue(drupalResult.status === 'success', 'drupal execute success');
    const drupalGuidance = (drupalResult.guidance || []).join('\n');
    assertTrue(/Stack-specific implementation \(framework=drupal\)/.test(drupalGuidance), 'drupal guidance includes Stack-specific header');
    assertTrue(/Drupal\.behaviors/.test(drupalGuidance), 'drupal guidance includes Drupal.behaviors snippet content');
    const drupalArtifacts = drupalResult.artifacts || [];
    assertTrue(drupalArtifacts.some((a) => a.type === 'template' && a.name === 'Motion code template: drupal'), 'drupal result has Motion code template artifact');
    // Test 2: WordPress context emits wp_enqueue + jQuery snippet
    const wpResult = await handler.execute({
        utterance: 'add motion',
        projectContext: { register: 'brand', product: {}, design: {} },
        metadata: {
            techStack: { framework: 'wordpress', hasAnimationLib: false, hasTypescript: false, packageManager: 'unknown' },
        },
    });
    assertTrue(wpResult.status === 'success', 'wordpress execute success');
    const wpGuidance = (wpResult.guidance || []).join('\n');
    assertTrue(/Stack-specific implementation \(framework=wordpress\)/.test(wpGuidance), 'wordpress guidance includes Stack-specific header');
    assertTrue(/wp_enqueue_script/.test(wpGuidance), 'wordpress guidance includes wp_enqueue_script snippet content');
    assertTrue((wpResult.artifacts || []).some((a) => a.type === 'template' && a.name === 'Motion code template: wordpress'), 'wordpress result has Motion code template artifact');
    // Test 3: Missing techStack falls back to vanilla (no crash)
    const fallbackResult = await handler.execute({
        utterance: 'add motion',
        projectContext: { register: 'brand', product: {}, design: {} },
        metadata: {},
    });
    assertTrue(fallbackResult.status === 'success', 'fallback execute success');
    const fallbackGuidance = (fallbackResult.guidance || []).join('\n');
    assertTrue(/Stack-specific implementation \(framework=unknown\)/.test(fallbackGuidance) ||
        /Stack-specific implementation \(framework=vanilla\)/.test(fallbackGuidance), 'fallback guidance still includes Stack-specific header');
    assertTrue(/DOMContentLoaded|<script src=/.test(fallbackGuidance), 'fallback guidance falls back to vanilla snippet content');
    console.log('sprint3-motion-stack-integration PASS');
})();
//# sourceMappingURL=sprint3-motion-stack-integration.test.js.map
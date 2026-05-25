"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
console.log('\n[Task 11] Interactive Menu Equivalent to /sidecoach\n');
console.log('='.repeat(80));
const orchestrator = (0, sidecoach_orchestrator_1.createExecutionEngine)();
// Test 1: Empty input shows menu
console.log('\n[Test 1] Empty input shows interactive menu');
orchestrator.process('').then((result) => {
    const isMenu = result.message && result.message.includes('Interactive');
    const hasGuidance = result.guidance && result.guidance.length > 20;
    const hasPhaseHeaders = result.guidance &&
        result.guidance.some((g) => g.includes('Research Phase')) &&
        result.guidance.some((g) => g.includes('Implement Phase')) &&
        result.guidance.some((g) => g.includes('Review Phase')) &&
        result.guidance.some((g) => g.includes('Special Phase'));
    console.log(`  Message shows "Interactive": ${isMenu ? 'YES' : 'NO'}`);
    console.log(`  Guidance items present: ${hasGuidance ? 'YES' : 'NO'}`);
    console.log(`  All 4 phase headers present: ${hasPhaseHeaders ? 'YES' : 'NO'}`);
    const menuShown = isMenu && hasGuidance && hasPhaseHeaders;
    console.log(`\n  Result: ${menuShown ? 'PASS' : 'FAIL'}`);
    if (menuShown) {
        console.log('\n[Menu Structure]:');
        let count = 0;
        for (const line of result.guidance) {
            if (count < 15) {
                console.log(`    ${line}`);
                count++;
            }
        }
        if (result.guidance.length > 15) {
            console.log(`    ... (${result.guidance.length - 15} more lines)`);
        }
    }
    // Test 2: /sidecoach with no args shows menu
    console.log('\n[Test 2] /sidecoach with no args shows menu');
    return orchestrator.process('/sidecoach');
}).then((result) => {
    const isMenu = result.message && result.message.includes('Interactive');
    const hasGuidance = result.guidance && result.guidance.length > 20;
    console.log(`  Shows interactive menu: ${isMenu && hasGuidance ? 'YES' : 'NO'}`);
    console.log(`  Result: ${isMenu && hasGuidance ? 'PASS' : 'FAIL'}`);
    // Test 3: Menu has numbered entries
    console.log('\n[Test 3] Menu has numbered command entries');
    const numericEntries = result.guidance && result.guidance.filter((g) => /^\s*\d+\./.test(g)).length;
    const minEntries = numericEntries && numericEntries >= 7;
    console.log(`  Numbered entries found: ${numericEntries || 0}`);
    console.log(`  At least 7 entries: ${minEntries ? 'YES' : 'NO'}`);
    console.log(`  Result: ${minEntries ? 'PASS' : 'FAIL'}`);
    console.log('\n' + '='.repeat(80));
}).catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=task11-interactive-menu.test.js.map
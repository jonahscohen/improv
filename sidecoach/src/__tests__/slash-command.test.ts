import { parseSlashCommand, getAvailableCommands } from '../slash-command-router';

// STALE FLOW COUNTS CORRECTED 2026-07-28 (Jonah). Six of this file's expected `flowIds.length`
// values pinned a routing table that the routing consolidation reshaped; the suite prints
// `Result: FAIL` per failing case and then exits 0, so `npm test` counted it green the entire
// time. It was never reconciled despite the 2026-07-26 routing triage recording it as
// "reconciled against the landed refactor" - that triage's green came through the runner
// defect fixed in scripts/run-tests.ts on 2026-07-28.
//
// Each corrected number below cites PHASE_ALIASES in ../slash-command-router.ts as the
// definition it now matches. The registry's SHAPE (all 21 verbs present, every entry carrying
// non-empty flowIds) is independently pinned by the green gated suite
// sprint8-registry-shape.test.ts, which is what makes "the registry is right and this file was
// stale" a measurement rather than a preference.
console.log('\nSlash Command Routing Test Suite\n');
console.log('='.repeat(80));

// Test 1: Parse research command
const test1 = parseSlashCommand('/sidecoach research Button');
console.log('\n[Test 1] Parse "/sidecoach research Button"');
console.log(`  isCommand: ${test1.isCommand}`);
console.log(`  command: ${test1.command}`);
console.log(`  flowIds count: ${test1.flowIds.length}`);
const pass1 = test1.isCommand && test1.command === 'research' && test1.flowIds.length === 7;
console.log(`  Result: ${pass1 ? 'PASS' : 'FAIL'}`);

// Test 2: Parse implement command
const test2 = parseSlashCommand('/sidecoach implement Page');
console.log('\n[Test 2] Parse "/sidecoach implement Page"');
console.log(`  isCommand: ${test2.isCommand}`);
console.log(`  command: ${test2.command}`);
console.log(`  flowIds count: ${test2.flowIds.length}`);
// 7 -> 4: PHASE_ALIASES.implement is [flowF_design_tokens, flowG_component_implementation,
// flowH_motion_integration, flowI_accessibility] (slash-command-router.ts:42).
const pass2 = test2.isCommand && test2.command === 'implement' && test2.flowIds.length === 4;
console.log(`  Result: ${pass2 ? 'PASS' : 'FAIL'}`);

// Test 3: Parse review command
const test3 = parseSlashCommand('/review Button');
console.log('\n[Test 3] Parse "/review Button" (shorthand)');
console.log(`  isCommand: ${test3.isCommand}`);
console.log(`  command: ${test3.command}`);
console.log(`  flowIds count: ${test3.flowIds.length}`);
// 10 -> 5: PHASE_ALIASES.review is [flowJ_tactical_polish, flowK_multi_lens_audit,
// flowL_design_critique, flowM_responsive_validation, flowN_rapid_iteration_refined]
// (slash-command-router.ts:43).
const pass3 = test3.isCommand && test3.command === 'review' && test3.flowIds.length === 5;
console.log(`  Result: ${pass3 ? 'PASS' : 'FAIL'}`);

// Test 4: Parse clone command
const test4 = parseSlashCommand('/clone Modal');
console.log('\n[Test 4] Parse "/clone Modal"');
console.log(`  isCommand: ${test4.isCommand}`);
console.log(`  command: ${test4.command}`);
console.log(`  flowIds count: ${test4.flowIds.length}`);
// 2 -> 1: PHASE_ALIASES.clone is [flowO_clone_match_special] (slash-command-router.ts:44).
const pass4 = test4.isCommand && test4.command === 'clone' && test4.flowIds.length === 1;
console.log(`  Result: ${pass4 ? 'PASS' : 'FAIL'}`);

// Test 5: Parse constrain command
const test5 = parseSlashCommand('/constrain Modal from design');
console.log('\n[Test 5] Parse "/constrain Modal from design"');
console.log(`  isCommand: ${test5.isCommand}`);
console.log(`  command: ${test5.command}`);
console.log(`  target: ${test5.target}`);
// 2 -> 1: PHASE_ALIASES.constrain is [flowP_constraint_design_special]
// (slash-command-router.ts:45). The `target` this case prints is asserted below, not here.
const pass5 = test5.isCommand && test5.command === 'constrain' && test5.flowIds.length === 1;
console.log(`  Result: ${pass5 ? 'PASS' : 'FAIL'}`);

// Test 6: Parse migrate command
const test6 = parseSlashCommand('/migrate');
console.log('\n[Test 6] Parse "/migrate"');
console.log(`  isCommand: ${test6.isCommand}`);
console.log(`  command: ${test6.command}`);
console.log(`  flowIds count: ${test6.flowIds.length}`);
// 2 -> 1: PHASE_ALIASES.migrate is [flowQ_migration_special] (slash-command-router.ts:46).
const pass6 = test6.isCommand && test6.command === 'migrate' && test6.flowIds.length === 1;
console.log(`  Result: ${pass6 ? 'PASS' : 'FAIL'}`);

// Test 7: Parse refactor command
const test7 = parseSlashCommand('/refactor');
console.log('\n[Test 7] Parse "/refactor"');
console.log(`  isCommand: ${test7.isCommand}`);
console.log(`  command: ${test7.command}`);
console.log(`  flowIds count: ${test7.flowIds.length}`);
// 2 -> 1: PHASE_ALIASES.refactor is [flowR_layout_optimization] (slash-command-router.ts:47).
const pass7 = test7.isCommand && test7.command === 'refactor' && test7.flowIds.length === 1;
console.log(`  Result: ${pass7 ? 'PASS' : 'FAIL'}`);

// Test 8: Parse type command
const test8 = parseSlashCommand('/type');
console.log('\n[Test 8] Parse "/type"');
console.log(`  isCommand: ${test8.isCommand}`);
console.log(`  command: ${test8.command}`);
console.log(`  flowIds count: ${test8.flowIds.length}`);
const pass8 = test8.isCommand && test8.command === 'type' && test8.flowIds.length === 1;
console.log(`  Result: ${pass8 ? 'PASS' : 'FAIL'}`);

// Test 9: Parse motion command
const test9 = parseSlashCommand('/motion');
console.log('\n[Test 9] Parse "/motion"');
console.log(`  isCommand: ${test9.isCommand}`);
console.log(`  command: ${test9.command}`);
console.log(`  flowIds count: ${test9.flowIds.length}`);
const pass9 = test9.isCommand && test9.command === 'motion' && test9.flowIds.length === 1;
console.log(`  Result: ${pass9 ? 'PASS' : 'FAIL'}`);

// Test 10: Parse reference command
const test10 = parseSlashCommand('/reference');
console.log('\n[Test 10] Parse "/reference"');
console.log(`  isCommand: ${test10.isCommand}`);
console.log(`  command: ${test10.command}`);
console.log(`  flowIds count: ${test10.flowIds.length}`);
const pass10 = test10.isCommand && test10.command === 'reference' && test10.flowIds.length === 1;
console.log(`  Result: ${pass10 ? 'PASS' : 'FAIL'}`);

// Test 11: Parse comprehensive command
const test11 = parseSlashCommand('/comprehensive');
console.log('\n[Test 11] Parse "/comprehensive"');
console.log(`  isCommand: ${test11.isCommand}`);
console.log(`  command: ${test11.command}`);
console.log(`  flowIds count: ${test11.flowIds.length}`);
const pass11 = test11.isCommand && test11.command === 'comprehensive' && test11.flowIds.length === 1;
console.log(`  Result: ${pass11 ? 'PASS' : 'FAIL'}`);

// Test 12: Parse list command
const test12 = parseSlashCommand('/list');
console.log('\n[Test 12] Parse "/list"');
console.log(`  isCommand: ${test12.isCommand}`);
console.log(`  command: ${test12.command}`);
console.log(`  flowIds length: ${test12.flowIds.length}`);
const pass12 = test12.isCommand && test12.command === 'list';
console.log(`  Result: ${pass12 ? 'PASS' : 'FAIL'}`);

// Test 13: Parse unknown command
const test13 = parseSlashCommand('/unknown');
console.log('\n[Test 13] Parse "/unknown"');
console.log(`  isCommand: ${test13.isCommand}`);
console.log(`  reason: ${test13.reason}`);
const pass13 = !test13.isCommand;
console.log(`  Result: ${pass13 ? 'PASS' : 'FAIL'}`);

// Test 14: Non-slash input
const test14 = parseSlashCommand('make a button');
console.log('\n[Test 14] Parse "make a button" (no slash)');
console.log(`  isCommand: ${test14.isCommand}`);
console.log(`  reason: ${test14.reason}`);
const pass14 = !test14.isCommand;
console.log(`  Result: ${pass14 ? 'PASS' : 'FAIL'}`);

// Test 15: Get available commands - verify all 11 present
const commands = getAvailableCommands();
console.log('\n[Test 15] Get available commands - verify all 11 commands present');
console.log(`  Commands found: ${Object.keys(commands).length}`);
const expectedCommands = ['research', 'implement', 'review', 'clone', 'constrain', 'migrate', 'refactor', 'type', 'motion', 'reference', 'comprehensive', 'list'];
const hasAllCommands = expectedCommands.every(
  cmd => commands[cmd as keyof typeof commands]
);
console.log(`  Expected: ${expectedCommands.join(', ')}`);
const pass15 = hasAllCommands;
console.log(`  Result: ${pass15 ? 'PASS' : 'FAIL'}`);

// Summary
console.log('\n' + '='.repeat(80));
// VACUOUS SUMMARY FIXED 2026-07-28 (Jonah). This array used to hold the parsed RESULT OBJECTS
// (test1, test2, ...), which are always truthy, so `results.filter(Boolean).length` was always
// 15. The suite printed `Results: 15 passed, 0 failed out of 15 tests` and `Success rate: 100.0%`
// in the SAME run where six of its cases printed `Result: FAIL`. It could not compute its own
// failure, let alone report it. Now it collects the actual per-case verdict booleans.
const results = [pass1, pass2, pass3, pass4, pass5, pass6, pass7, pass8, pass9, pass10, pass11, pass12, pass13, pass14, pass15];
const passCount = results.filter(Boolean).length;
console.log(`\nResults: ${passCount} passed, ${15 - passCount} failed out of 15 tests`);
console.log(`Success rate: ${((passCount / 15) * 100).toFixed(1)}%\n`);

// FAIL-LOUD 2026-07-28 (Jonah): this suite used to end here, exiting 0 no matter what it
// printed. Codex review flagged it as a standalone-honesty gap even after the counts were
// corrected. It now sets its exit code from its own verdict, so it does not depend on the
// runner's transcript scan to be noticed.
process.exit(passCount === 15 ? 0 : 1);

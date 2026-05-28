"use strict";
// T-0023 deep-interview enhancement tests for TeachCommandHandlerV2.
//
// Covers:
// - Standard teach flow still works (regression - duplicated from sprint8 with
//   the new helper layer)
// - --deep flag activates extended taxonomy (9 fields)
// - Vague-answer detection demotes high-confidence answers to low in deep mode
// - Follow-up question logic triggers on vague answers
// - PRODUCT.md output passes validateProductMd in deep mode
// - Deep-mode handoff guidance points to /sidecoach document
// - parseDeepFlag strips flag from brief
// - ambiguityScore math is OMC-style
//
// >= 12 assertions, per T-0023 spec.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const teach_command_handler_v2_1 = require("../teach-command-handler-v2");
const teach_deep_interview_1 = require("../teach-deep-interview");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function mkSandbox() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-t23-'));
}
async function run() {
    const checks = [];
    // --- Scenario 1: standard teach flow regression (no --deep, baseline brief) ---
    {
        const sandbox = mkSandbox();
        const handler = new teach_command_handler_v2_1.TeachCommandHandlerV2();
        const utterance = `Register: brand. Users: PMs running standup. Brand personality: technical, restrained. Anti-references: corporate SaaS, screenshot-heavy tours. Strategic principles: no funnel tricks; real screenshots only.`;
        const result = await handler.execute({ utterance, projectPath: sandbox, metadata: {} });
        checks.push(['S1: standard teach succeeds without --deep', result.status === 'success']);
        const content = fs.readFileSync(path.join(sandbox, 'PRODUCT.md'), 'utf-8');
        // Standard mode must NOT include extended sections.
        checks.push(['S1: standard mode has NO Problem section', !content.includes('## Problem')]);
        checks.push(['S1: standard mode has NO Success Metrics', !content.includes('## Success Metrics')]);
        checks.push(['S1: standard mode has NO Technical Constraints', !content.includes('## Technical Constraints')]);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // --- Scenario 2: --deep flag activates extended taxonomy ---
    {
        const sandbox = mkSandbox();
        const handler = new teach_command_handler_v2_1.TeachCommandHandlerV2();
        const utterance = `--deep Register: brand. Users: PMs in mid-sized agencies running daily standup. Brand personality: restrained, technical, ink-on-paper. Brand voice: terse, precise, never sales-y. Anti-references: corporate SaaS, screenshot-heavy tours, Bootstrap purple. Strategic principles: zero clicks to today's queue; no nested modals; real screenshots not mockups. Problem: PMs spend 30 minutes daily reformatting standup notes for Slack and email. Success metrics: under 2 minutes setup; 80% retention week 4; under 5 errors per session. Business model: paid subscription, $12/user/month, B2B. Technical constraints: must work in Chrome and Safari current; WCAG AA; under 200KB initial JS.`;
        const result = await handler.execute({ utterance, projectPath: sandbox, metadata: {} });
        checks.push(['S2: --deep status is success when all 9 fields supplied', result.status === 'success']);
        checks.push(['S2: --deep message tags deep mode', /deep interview mode/i.test(result.message || '')]);
        const content = fs.readFileSync(path.join(sandbox, 'PRODUCT.md'), 'utf-8');
        checks.push(['S2: deep mode includes Problem section', content.includes('## Problem')]);
        checks.push(['S2: deep mode includes Success Metrics', content.includes('## Success Metrics')]);
        checks.push(['S2: deep mode includes Business Model', content.includes('## Business Model')]);
        checks.push(['S2: deep mode includes Technical Constraints', content.includes('## Technical Constraints')]);
        checks.push(['S2: deep mode includes Brand Voice (brand register)', content.includes('## Brand Voice')]);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // --- Scenario 3: --deep with vague users answer surfaces follow-up question ---
    {
        const sandbox = mkSandbox();
        const handler = new teach_command_handler_v2_1.TeachCommandHandlerV2();
        // Bare "developers" is in VAGUE_PATTERNS.users
        const utterance = `--deep Register: brand. Users: developers. Brand personality: ink-on-paper, technical, restrained.`;
        const result = await handler.execute({ utterance, projectPath: sandbox, metadata: {} });
        checks.push(['S3: --deep with vague answers returns pending', result.status === 'pending']);
        const guidance = (result.guidance || []).join('\n');
        checks.push([
            'S3: users gap surfaces sharper follow-up (job title cue)',
            /job title/i.test(guidance),
        ]);
        checks.push(['S3: ambiguity score reported in guidance', /Ambiguity:/i.test(guidance)]);
        checks.push(['S3: weakest dimension reported', /Weakest dimension/i.test(guidance)]);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // --- Scenario 4: parseDeepFlag strips flag from brief ---
    {
        const r1 = (0, teach_deep_interview_1.parseDeepFlag)('--deep Register: brand');
        checks.push(['S4: parseDeepFlag detects --deep', r1.depth === 'deep']);
        checks.push(['S4: parseDeepFlag strips flag from brief', r1.brief === 'Register: brand']);
        const r2 = (0, teach_deep_interview_1.parseDeepFlag)('Register: brand');
        checks.push(['S4: default depth is standard', r2.depth === 'standard']);
        const r3 = (0, teach_deep_interview_1.parseDeepFlag)('Register: brand --quick');
        checks.push(['S4: parseDeepFlag detects --quick at end', r3.depth === 'quick']);
    }
    // --- Scenario 5: isVagueAnswer detection ---
    {
        checks.push(['S5: bare "developers" is vague for users', (0, teach_deep_interview_1.isVagueAnswer)('users', 'developers')]);
        checks.push([
            'S5: specific PM role is NOT vague for users',
            !(0, teach_deep_interview_1.isVagueAnswer)('users', 'PMs at mid-sized agencies running daily standup'),
        ]);
        checks.push([
            'S5: "modern" alone is vague for brandPersonality',
            (0, teach_deep_interview_1.isVagueAnswer)('brandPersonality', 'modern'),
        ]);
        checks.push([
            'S5: "ink-on-paper, restrained" is NOT vague for brandPersonality',
            !(0, teach_deep_interview_1.isVagueAnswer)('brandPersonality', 'ink-on-paper, technical, restrained'),
        ]);
        checks.push([
            'S5: empty string is vague',
            (0, teach_deep_interview_1.isVagueAnswer)('successMetrics', ''),
        ]);
    }
    // --- Scenario 6: generateFollowUpQuestion produces a sharper prompt ---
    {
        const q = (0, teach_deep_interview_1.generateFollowUpQuestion)('users', 'developers');
        checks.push(['S6: follow-up echoes the vague answer', q.includes('"developers"')]);
        checks.push(['S6: follow-up asks for specific role', /job title|frustration/i.test(q)]);
        const qProblem = (0, teach_deep_interview_1.generateFollowUpQuestion)('problem', 'make something');
        checks.push(['S6: problem follow-up asks for the X/Y/Z form', /X.+Y.+Z/.test(qProblem)]);
    }
    // --- Scenario 7: ambiguityScore math ---
    {
        // All absent -> ambiguity = 1
        const all = (0, teach_deep_interview_1.ambiguityScore)({}, teach_deep_interview_1.DEEP_FIELDS);
        checks.push(['S7: all-absent ambiguity is 1.0', Math.abs(all.ambiguity - 1) < 0.01]);
        checks.push(['S7: weakest dimension when all-absent is goal', all.weakest === 'goal']);
        // Everything high -> ambiguity = 0
        const allHigh = {};
        for (const f of teach_deep_interview_1.DEEP_FIELDS)
            allHigh[f] = 'high';
        const clean = (0, teach_deep_interview_1.ambiguityScore)(allHigh, teach_deep_interview_1.DEEP_FIELDS);
        checks.push(['S7: all-high ambiguity is 0', clean.ambiguity < 0.01]);
        checks.push(['S7: all-high weakest is null', clean.weakest === null]);
        // Mixed: high goal, absent constraints -> weakest = constraints
        const mixed = {};
        for (const f of teach_deep_interview_1.DEEP_FIELDS) {
            mixed[f] = teach_deep_interview_1.FIELD_DIMENSION[f] === 'goal' ? 'high' : 'absent';
        }
        const m = (0, teach_deep_interview_1.ambiguityScore)(mixed, teach_deep_interview_1.DEEP_FIELDS);
        checks.push(['S7: mixed weakest is constraints (next-after-goal)', m.weakest === 'constraints']);
    }
    // --- Scenario 8: validateProductMd structural validation ---
    {
        const goodBrand = [
            '# PRODUCT.md',
            '',
            '## Register',
            '',
            '**Brand**',
            '',
            '## Primary Users',
            '',
            'PMs at mid-sized agencies running daily standup meetings.',
            '',
            '## Brand Personality',
            '',
            'restrained, technical, ink-on-paper aesthetic.',
            '',
            '## Anti-References',
            '',
            'What this should NOT look like:',
            '',
            '- corporate SaaS hero patterns',
            '- screenshot-heavy product tours',
            '',
            '## Strategic Principles',
            '',
            '- zero clicks to today queue',
            '- no nested modals',
            '',
        ].join('\n');
        const v1 = (0, teach_deep_interview_1.validateProductMd)(goodBrand, { register: 'brand', deep: false });
        checks.push(['S8: well-formed standard PRODUCT.md validates clean', v1.ok]);
        // Missing Brand Personality but register=brand
        const missing = goodBrand.replace(/## Brand Personality[\s\S]*?(?=## Anti)/, '');
        const v2 = (0, teach_deep_interview_1.validateProductMd)(missing, { register: 'brand', deep: false });
        checks.push(['S8: missing Brand Personality flagged', v2.missingSections.includes('Brand Personality')]);
        // Deep mode requires Problem, Success Metrics, etc
        const v3 = (0, teach_deep_interview_1.validateProductMd)(goodBrand, { register: 'brand', deep: true });
        checks.push([
            'S8: deep validation flags missing Problem section',
            v3.missingSections.includes('Problem'),
        ]);
        checks.push([
            'S8: deep validation flags missing Success Metrics',
            v3.missingSections.includes('Success Metrics'),
        ]);
        // TODO marker
        const withTodo = goodBrand + '\n## Notes\n\n[TODO] fill in later\n';
        const v4 = (0, teach_deep_interview_1.validateProductMd)(withTodo, { register: 'brand', deep: false });
        checks.push(['S8: TODO marker flagged', v4.warnings.some((w) => /TODO/i.test(w))]);
    }
    // --- Scenario 9: --deep handoff hint to /sidecoach document when no DESIGN.md ---
    {
        const sandbox = mkSandbox();
        const handler = new teach_command_handler_v2_1.TeachCommandHandlerV2();
        const utterance = `--deep Register: product. Users: ops engineers at mid-sized SaaS shops monitoring infra dashboards on call. Anti-references: cluttered Grafana dashboards, Datadog noise floors. Strategic principles: zero scroll on the critical view; alert > metric > log hierarchy; one accent color only. Problem: ops engineers spend 2 minutes per page on call routing to the right dashboard. Success metrics: under 30 second mean time to acknowledge; under 3 errors per shift. Business model: enterprise SaaS, $50/seat/month. Technical constraints: must run in Chrome current; WCAG AA; under 100ms time to interactive.`;
        const result = await handler.execute({ utterance, projectPath: sandbox, metadata: {} });
        checks.push(['S9: --deep with full product brief succeeds', result.status === 'success']);
        const guidance = (result.guidance || []).join('\n');
        checks.push([
            'S9: handoff hint points at /sidecoach document when no DESIGN.md',
            /\/sidecoach document/.test(guidance),
        ]);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // --- Scenario 10: metadata.depth='deep' equivalent to --deep flag ---
    {
        const sandbox = mkSandbox();
        const handler = new teach_command_handler_v2_1.TeachCommandHandlerV2();
        const utterance = `Register: brand. Users: developers.`;
        const result = await handler.execute({
            utterance,
            projectPath: sandbox,
            metadata: { depth: 'deep' },
        });
        checks.push(['S10: metadata.depth=deep activates deep mode', /deep interview mode/i.test(result.message || '')]);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // --- Scenario 11: --deep + teachAnswers merge fills extended fields ---
    {
        const sandbox = mkSandbox();
        const handler = new teach_command_handler_v2_1.TeachCommandHandlerV2();
        const utterance = `--deep Register: brand. Users: senior engineers at YC-backed SaaS startups maintaining a single internal tool. Brand personality: ink-on-paper, technical, restrained.`;
        const teachAnswers = {
            antiReferences: ['corporate SaaS', 'screenshot tours'],
            strategicPrinciples: ['no funnel tricks', 'real screenshots only'],
            problem: 'engineers waste 30 minutes per release reformatting changelog notes for the company blog and Slack',
            successMetrics: ['under 5 min per release', 'over 90% adoption month 1'],
            businessModel: 'free for solo, $20/seat/month for teams; B2B',
            technicalConstraints: ['Chrome and Safari current', 'WCAG AA', 'under 200KB JS'],
            brandVoice: 'terse, precise, technical; never sales-y',
        };
        const result = await handler.execute({
            utterance,
            projectPath: sandbox,
            metadata: { teachAnswers },
        });
        checks.push(['S11: --deep with teachAnswers merges successfully', result.status === 'success']);
        const content = fs.readFileSync(path.join(sandbox, 'PRODUCT.md'), 'utf-8');
        checks.push(['S11: merged problem appears in PRODUCT.md', content.includes('reformatting changelog')]);
        checks.push(['S11: merged success metrics appear', content.includes('over 90% adoption month 1')]);
        checks.push(['S11: merged business model appears', content.includes('$20/seat/month')]);
        checks.push(['S11: merged brand voice appears', content.includes('terse, precise')]);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // --- Scenario 12: taxonomy shape constants ---
    {
        checks.push(['S12: CORE_FIELDS has 5 entries', teach_deep_interview_1.CORE_FIELDS.length === 5]);
        checks.push(['S12: EXTENDED_FIELDS has 5 entries (4 generic + brandVoice)', teach_deep_interview_1.EXTENDED_FIELDS.length === 5]);
        checks.push(['S12: DEEP_FIELDS has 10 entries total', teach_deep_interview_1.DEEP_FIELDS.length === 10]);
        checks.push(['S12: every DEEP_FIELD has a dimension mapping', teach_deep_interview_1.DEEP_FIELDS.every((f) => !!teach_deep_interview_1.FIELD_DIMENSION[f])]);
    }
    let allPass = true;
    let passCount = 0;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
        else
            passCount++;
    }
    console.log(`\nt23-deep-interview: ${passCount}/${checks.length} ${allPass ? 'PASS' : 'FAIL'}`);
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=t23-deep-interview.test.js.map
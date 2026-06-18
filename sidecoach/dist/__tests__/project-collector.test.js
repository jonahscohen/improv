"use strict";
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
// sidecoach/src/__tests__/project-collector.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const project_collector_1 = require("../validators/project-collector");
const product_rule_types_1 = require("../product-rule-types");
function mkproj() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'p4a2-collector-'));
}
async function run() {
    // 1. a Sass-only project is discovered as scss, inspected, and usable by css-rule coverage
    {
        const dir = mkproj();
        fs.writeFileSync(path.join(dir, 'styles.scss'), '.btn:active { transform: scale(0.96); }');
        const c = await (0, project_collector_1.collectFromPath)(dir);
        const scss = c.files.find((f) => f.path === 'styles.scss');
        if (!scss || scss.sourceKind !== 'scss')
            throw new Error('scss file must be discovered as scss');
        if (!c.inspectedFiles.includes('styles.scss'))
            throw new Error('scss file must be inspected');
        if (scss.cssText.trim().length === 0)
            throw new Error('scss file must carry css text');
        if (!(0, product_rule_types_1.sourceKindsForEvidence)(['css-rule']).includes('scss'))
            throw new Error('scss must be a css-rule-compatible source kind');
        if (!scss.evidenceKindsPresent.includes('scss'))
            throw new Error('scss evidenceKindsPresent must include scss');
    }
    // 2. a mixed .css + .md project reports .css inspected and .md unsupported
    {
        const dir = mkproj();
        fs.writeFileSync(path.join(dir, 'a.css'), '.x { color: red; }');
        fs.writeFileSync(path.join(dir, 'README.md'), '# hi');
        const c = await (0, project_collector_1.collectFromPath)(dir);
        if (!c.inspectedFiles.includes('a.css'))
            throw new Error('.css must be inspected');
        if (!c.unsupportedFiles.includes('README.md'))
            throw new Error('.md must be unsupported');
        const md = c.discovered.find((d) => d.path === 'README.md');
        if (!md || md.outcome !== 'unsupported' || md.sourceKind !== 'extension:.md')
            throw new Error('.md must record the matrix-derived unsupported extension kind');
    }
    // 3. an oversized supported file remains discovered and skipped (not inspected)
    {
        const dir = mkproj();
        fs.writeFileSync(path.join(dir, 'big.css'), 'a'.repeat(2 * 1024 * 1024 + 16));
        fs.writeFileSync(path.join(dir, 'small.css'), '.y { color: blue; }');
        const c = await (0, project_collector_1.collectFromPath)(dir);
        if (c.files.some((f) => f.path === 'big.css'))
            throw new Error('oversized file must not be read into files');
        const big = c.discovered.find((d) => d.path === 'big.css');
        if (!big || big.outcome !== 'oversized')
            throw new Error('oversized supported file must stay discovered with outcome oversized');
        if (!c.skippedFiles.includes('big.css'))
            throw new Error('oversized file must appear in skippedFiles');
        if (!c.inspectedFiles.includes('small.css'))
            throw new Error('the small css file must still be inspected');
    }
    // 4. a read-failure seam records unreadable (not silently dropped)
    if (!(typeof process.getuid === 'function' && process.getuid() === 0)) {
        const dir = mkproj();
        const locked = path.join(dir, 'locked.css');
        fs.writeFileSync(locked, '.z { color: green; }');
        fs.chmodSync(locked, 0o000);
        try {
            const c = await (0, project_collector_1.collectFromPath)(dir);
            const rec = c.discovered.find((d) => d.path === 'locked.css');
            if (!rec || rec.outcome !== 'unreadable')
                throw new Error('a read-failure must be recorded unreadable, never dropped');
            if (!c.unreadableFiles.includes('locked.css'))
                throw new Error('unreadable file must appear in unreadableFiles');
        }
        finally {
            fs.chmodSync(locked, 0o644);
        }
    }
    // 5. a missing/unreadable root throws (validator-level collection failure)
    {
        let threw = false;
        try {
            await (0, project_collector_1.collectFromPath)(path.join(os.tmpdir(), 'p4a2-does-not-exist-' + process.pid));
        }
        catch {
            threw = true;
        }
        if (!threw)
            throw new Error('a missing root must throw');
    }
    // 6a. cooperative async collection YIELDS to the event loop: a large multi-file
    //     collection lets a concurrent 1ms timer fire (a synchronous/blocking collector
    //     would starve it -> ticks stays 0 -> the precise red). No abort here, so no
    //     dependence on the abort firing within a timing window.
    {
        const dir = mkproj();
        for (let i = 0; i < 1500; i++)
            fs.writeFileSync(path.join(dir, `f${i}.css`), `.c${i} { color: red; transition: opacity 1s; }`);
        let ticks = 0;
        const timer = setInterval(() => { ticks++; }, 1);
        try {
            await (0, project_collector_1.collect)({ projectPath: dir });
        }
        finally {
            clearInterval(timer);
        }
        if (ticks === 0)
            throw new Error('a slow multi-file collection must yield to the event loop so the heartbeat timer can fire');
    }
    // 6b. collection observes the AbortSignal between entries and throws promptly
    //     (deterministic: an already-aborted signal trips the first between-entry check).
    {
        const dir = mkproj();
        for (let i = 0; i < 4; i++)
            fs.writeFileSync(path.join(dir, `g${i}.css`), `.g${i} { color: blue; }`);
        const ac = new AbortController();
        ac.abort();
        let aborted = false;
        try {
            await (0, project_collector_1.collect)({ projectPath: dir }, ac.signal);
        }
        catch (e) {
            aborted = e instanceof project_collector_1.CollectionAbortedError;
        }
        if (!aborted)
            throw new Error('collection must throw CollectionAbortedError when the signal is aborted');
    }
    console.log('project-collector: OK');
}
run();
//# sourceMappingURL=project-collector.test.js.map
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
const path = __importStar(require("path"));
const assert = __importStar(require("assert"));
const slash_command_router_1 = require("../slash-command-router");
const LANES = path.resolve(__dirname, '..', '..', '..', 'claude', 'hooks', 'sidecoach-lanes.json');
function check(phrase, kind, lane) {
    const r = (0, slash_command_router_1.resolveSidecoachPhrase)(phrase, LANES);
    assert.strictEqual(r.kind, kind, `${phrase} -> ${r.kind}`);
    if (lane)
        assert.strictEqual(r.lane, lane, `${phrase} lane`);
}
check('make this production-ready', 'ROUTE', 'lane_ship'); // SCOPE_UNKNOWN proceeds under explicit address
check('build the API from scratch', 'OUT_OF_SCOPE'); // positive negative evidence refuses
check('make the landing page production-ready', 'ROUTE', 'lane_ship');
// A known verb word typed as the command wins outright (existing command path).
const known = (0, slash_command_router_1.resolveSidecoachPhrase)('polish the button', LANES);
assert.strictEqual(known.kind, 'ROUTE', `polish -> ${known.kind}`);
assert.strictEqual(known.command, 'polish', `polish command`);
// UNKNOWN: no lane evidence at all -> a BUILT near-miss suggestion. Assert the
// actual suggestion string, not merely kind==='UNKNOWN', so an empty stub FAILS.
const miss = (0, slash_command_router_1.resolveSidecoachPhrase)('polsih the button', LANES);
assert.strictEqual(miss.kind, 'UNKNOWN', `polsih -> ${miss.kind}`);
assert.ok(miss.suggestion && /did you mean/i.test(miss.suggestion) && /\bpolish\b/i.test(miss.suggestion), `expected a "did you mean ... polish" near-miss suggestion, got: ${miss.suggestion}`);
// UNKNOWN with no plausible near-miss -> helpful UNKNOWN, no suggestion (a typo
// must NEVER become an interview/route).
const foo = (0, slash_command_router_1.resolveSidecoachPhrase)('foo', LANES);
assert.strictEqual(foo.kind, 'UNKNOWN', `foo -> ${foo.kind}`);
assert.ok(!foo.lane && !foo.command, `foo must not route/command, got lane=${foo.lane} command=${foo.command}`);
console.log('slash-phrase: OK');
//# sourceMappingURL=slash-phrase.test.js.map
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
exports.IconSourceReferenceImpl = void 0;
exports.createIconSourceReference = createIconSourceReference;
exports.buildIconSourceArtifactContent = buildIconSourceArtifactContent;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const LIBRARIES = [
    {
        id: 'heroicons',
        displayName: 'Heroicons',
        approxCount: 300,
        tier: 'static',
        strengths: 'Clean UI chrome, nav, actions',
        repo: 'tailwindlabs/heroicons',
        packageName: '@heroicons/react',
        classPattern: 'heroicon-*',
    },
    {
        id: 'lucide',
        displayName: 'Lucide',
        approxCount: 1500,
        tier: 'static',
        strengths: 'General purpose, broadest coverage',
        repo: 'lucide-icons/lucide',
        packageName: 'lucide-react',
        classPattern: 'lucide-*',
    },
    {
        id: 'tabler',
        displayName: 'Tabler',
        approxCount: 5400,
        tier: 'static',
        strengths: 'Largest set, edge-case coverage',
        repo: 'tabler/tabler-icons',
        packageName: '@tabler/icons-react',
        classPattern: 'tabler-*',
    },
    {
        id: 'bootstrap-icons',
        displayName: 'Bootstrap Icons',
        approxCount: 2000,
        tier: 'static',
        strengths: 'Familiar web conventions',
        repo: 'twbs/icons',
        packageName: 'bootstrap-icons',
        classPattern: 'bi-*',
    },
    {
        id: 'phosphor',
        displayName: 'Phosphor',
        approxCount: 7000,
        tier: 'static',
        strengths: 'Weight flexibility (6 weights), illustration-adjacent',
        repo: 'phosphor-icons/core',
        packageName: '@phosphor-icons/react',
        classPattern: 'ph-*',
        variants: 'thin, light, regular, bold, fill, duotone',
    },
    {
        id: 'material-symbols',
        displayName: 'Material Symbols',
        approxCount: 3000,
        tier: 'static',
        strengths: 'Variable font, 3 fills, 7 grades, Material convention',
        repo: 'google/material-design-icons',
        packageName: 'material-symbols',
        classPattern: 'ms-*',
        variants: 'outlined, rounded, sharp - each with fill 0/1, weight 100-700, grade -25/0/200, optical-size 20-48',
    },
    {
        id: 'lucide-animated',
        displayName: 'Lucide Animated',
        approxCount: 1000,
        tier: 'animated',
        strengths: 'Micro-interactions, state transitions (React + Framer Motion)',
        repo: 'pqoqubbw/icons',
        classPattern: 'lucide-*',
    },
    {
        id: 'heroicons-animated',
        displayName: 'Heroicons Animated',
        approxCount: 300,
        tier: 'animated',
        strengths: 'Polished interactive states (React + Framer Motion)',
        repo: 'heroicons-animated/heroicons-animated',
        classPattern: 'heroicon-*',
    },
];
const SELECTION_PROTOCOL = [
    '1. Check DESIGN.md first - if the project specifies an icon library, use that exclusively. Project consistency trumps individual icon quality.',
    '2. If no project preference, match the tech stack. React + framer-motion installed -> animated tier eligible. Vanilla HTML or non-React -> static SVG only.',
    '3. If the project already uses icons from a specific library (grep imports), use the same one - one library per project, no exceptions.',
    '4. Search by semantic intent (what the icon means in context), not visual shape. "home" not "house"; "close" or "dismiss" not "circle with X".',
    '5. Copy SVG path data verbatim from the library source. Never redraw, simplify, optimize, or approximate paths. Byte-for-byte equality with the library source is the rule.',
    '6. Animated variants ONLY when the icon represents a state change or feedback moment - never for static UI chrome. Animated icons must pair with their static parent library (Lucide + Lucide Animated, Heroicons + Heroicons Animated). No other cross-library mixing.',
    '7. Annotate every placed icon with a provenance marker: class="<library>-<name>", data-icon-source="<library>", or <!-- source: <library>/<filename> --> comment. The taste-validator (taste/fabricated-svg rule) enforces this on commit.',
];
const PROVENANCE = {};
for (const lib of LIBRARIES) {
    PROVENANCE[lib.id] = {
        classPattern: lib.classPattern,
        dataAttribute: `data-icon-source="${lib.id}"`,
        commentTemplate: `<!-- source: ${lib.id}/<icon-name>.svg -->`,
        example: `<svg class="${lib.classPattern.replace('*', 'home')}" data-icon-source="${lib.id}" ...>`,
    };
}
class IconSourceReferenceImpl {
    getApprovedLibraries() {
        return [...LIBRARIES];
    }
    getLibrary(id) {
        return LIBRARIES.find((l) => l.id === id);
    }
    getSelectionProtocol() {
        return [...SELECTION_PROTOCOL];
    }
    getProvenanceMarkers(library) {
        const m = PROVENANCE[library];
        if (!m) {
            throw new Error(`Unknown icon library: ${library}. Approved: ${LIBRARIES.map((l) => l.id).join(', ')}`);
        }
        return m;
    }
    recommendLibrary(opts = {}) {
        if (opts.designMdLibrary) {
            const match = LIBRARIES.find((l) => l.id === opts.designMdLibrary ||
                l.displayName.toLowerCase() === opts.designMdLibrary.toLowerCase());
            if (match) {
                return {
                    library: match.id,
                    reason: `DESIGN.md specifies ${match.displayName} - project consistency trumps individual choice.`,
                    confidence: 'high',
                };
            }
            return {
                library: 'lucide',
                reason: `DESIGN.md names "${opts.designMdLibrary}" which is not in the approved pool. Falling back to Lucide and flagging for human review.`,
                confidence: 'low',
            };
        }
        if (opts.existingLibrary) {
            return {
                library: opts.existingLibrary,
                reason: `Project already uses ${opts.existingLibrary} - one library per project rule keeps stroke widths and visual weight consistent.`,
                confidence: 'high',
            };
        }
        if (opts.hasFramerMotion && opts.isReactProject) {
            return {
                library: 'lucide-animated',
                reason: 'React + framer-motion stack supports animated icons. Lucide Animated covers the broadest set and pairs cleanly with static Lucide for non-interactive chrome.',
                confidence: 'medium',
            };
        }
        return {
            library: 'lucide',
            reason: 'No project preference, no existing imports, no animation stack. Lucide is the safest general-purpose default at 1,500 icons with broad coverage.',
            confidence: 'medium',
        };
    }
    loadBundle(library) {
        if (IconSourceReferenceImpl.iconBundles[library]) {
            return IconSourceReferenceImpl.iconBundles[library];
        }
        // Only Lucide bundled in Sprint 1; others added in future sprints
        if (library !== 'lucide')
            return null;
        try {
            const bundlePath = path.resolve(__dirname, '..', 'data', 'icons', `${library}.json`);
            const raw = fs.readFileSync(bundlePath, 'utf8');
            const parsed = JSON.parse(raw);
            IconSourceReferenceImpl.iconBundles[library] = parsed;
            return parsed;
        }
        catch {
            return null;
        }
    }
    getIconSource(library, name) {
        const bundle = this.loadBundle(library);
        if (!bundle)
            return null;
        return bundle[name] || null;
    }
    searchSemantics(intent) {
        const lower = intent.toLowerCase();
        const guidance = [
            `Search "${intent}" by semantic intent in the library's icon catalog (search box on the library website or grep its icon manifest).`,
        ];
        const swaps = [
            [/\bhouse\b/, 'Try "home" instead of "house" - the icon means "go home", not "building".'],
            [/circle.*x|x.*circle/, 'Try "close" or "dismiss" instead of describing the shape.'],
            [/arrow.*right/, 'Try "next", "forward", or "chevron-right" - the purpose, not the direction.'],
            [/person|silhouette|figure/, 'Try "user", "account", or "profile" - the domain concept.'],
            [/three.*line|hamburger/, 'Try "menu" - the function, not the appearance.'],
            [/gear|cog/, 'Try "settings" - the meaning in context.'],
        ];
        for (const [pat, swap] of swaps) {
            if (pat.test(lower))
                guidance.push(swap);
        }
        return guidance;
    }
}
exports.IconSourceReferenceImpl = IconSourceReferenceImpl;
IconSourceReferenceImpl.iconBundles = {};
function createIconSourceReference() {
    return new IconSourceReferenceImpl();
}
function buildIconSourceArtifactContent(ref) {
    const libs = ref.getApprovedLibraries();
    const protocol = ref.getSelectionProtocol();
    const lines = [];
    lines.push('APPROVED ICON LIBRARIES (one per project, no cross-library mixing except animated/static parent pairs):');
    lines.push('');
    for (const lib of libs) {
        lines.push(`- ${lib.displayName} (${lib.id}) [${lib.tier}] - ~${lib.approxCount} icons - ${lib.strengths} - repo: ${lib.repo}` +
            (lib.variants ? ` - variants: ${lib.variants}` : ''));
    }
    lines.push('');
    lines.push('SELECTION PROTOCOL:');
    for (const step of protocol) {
        lines.push(step);
    }
    lines.push('');
    lines.push('PROVENANCE MARKERS REQUIRED (taste/fabricated-svg rule enforces these):');
    for (const lib of libs) {
        const m = ref.getProvenanceMarkers(lib.id);
        lines.push(`- ${lib.displayName}: class="${m.classPattern}" OR ${m.dataAttribute} OR ${m.commentTemplate}`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=icon-source-reference.js.map
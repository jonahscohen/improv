"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANES_BY_ID = exports.LANES = void 0;
exports.getLane = getLane;
exports.getLaneFlowSequence = getLaneFlowSequence;
exports.LANES = [
    {
        "lane": "lane_build",
        "label": "a ground-up build",
        "description": "Shapes the design, crafts the implementation, then polishes the result.",
        "interviewLabel": "Build it from the ground up",
        "executionKind": "sequence",
        "verbChain": [
            "shape",
            "craft",
            "polish"
        ],
        "prereqWaivers": [],
        "flowSequence": [
            "flowA_brand_verify",
            "flowB_component_research",
            "flowE_motion_patterns",
            "flowF_design_tokens",
            "flowG_component_implementation",
            "flowH_motion_integration",
            "flowI_accessibility",
            "flowM_responsive_validation",
            "flowJ_tactical_polish"
        ],
        "verbGuidance": [
            {
                "verb": "shape",
                "guidance": [
                    "Discovery interview ran with 2-3 questions per round before any decisions were made.",
                    "Visual Direction Probe was either run or its skip was announced in one line; the decision was conscious.",
                    "Brief presented and response stopped to wait for explicit confirmation before any implementation."
                ]
            },
            {
                "verb": "craft",
                "guidance": [
                    "Shape brief confirmed before any code was written; gates were not compressed.",
                    "Component patterns researched before any UI was built; design references vetted for AI-slop.",
                    "Motion patterns researched before motion was integrated; easing tokens selected, not invented.",
                    "Production bar enforced: real content, semantic-first markup, deliberate spacing, full state coverage.",
                    "Motion integrated: easing tokens applied to interactive components, reduced-motion respected.",
                    "Accessibility verified: WCAG 2.1 AA scan complete, contrast and focus ring checks passed.",
                    "Responsive verified: rendered at XS/SM/MD/LG/XL, 44x44 hit areas measured, nav pattern transitions confirmed, iOS svh/dvh checked.",
                    "After the first pass, iterate visually against the brief and the approved direction; patch material defects and re-inspect."
                ]
            },
            {
                "verb": "polish",
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            }
        ],
        "verbSteps": [
            {
                "verb": "shape",
                "flowIds": [
                    "flowA_brand_verify"
                ],
                "guidance": [
                    "Discovery interview ran with 2-3 questions per round before any decisions were made.",
                    "Visual Direction Probe was either run or its skip was announced in one line; the decision was conscious.",
                    "Brief presented and response stopped to wait for explicit confirmation before any implementation."
                ]
            },
            {
                "verb": "craft",
                "flowIds": [
                    "flowB_component_research",
                    "flowE_motion_patterns",
                    "flowF_design_tokens",
                    "flowG_component_implementation",
                    "flowH_motion_integration",
                    "flowI_accessibility",
                    "flowM_responsive_validation",
                    "flowJ_tactical_polish"
                ],
                "guidance": [
                    "Shape brief confirmed before any code was written; gates were not compressed.",
                    "Component patterns researched before any UI was built; design references vetted for AI-slop.",
                    "Motion patterns researched before motion was integrated; easing tokens selected, not invented.",
                    "Production bar enforced: real content, semantic-first markup, deliberate spacing, full state coverage.",
                    "Motion integrated: easing tokens applied to interactive components, reduced-motion respected.",
                    "Accessibility verified: WCAG 2.1 AA scan complete, contrast and focus ring checks passed.",
                    "Responsive verified: rendered at XS/SM/MD/LG/XL, 44x44 hit areas measured, nav pattern transitions confirmed, iOS svh/dvh checked.",
                    "After the first pass, iterate visually against the brief and the approved direction; patch material defects and re-inspect."
                ]
            },
            {
                "verb": "polish",
                "flowIds": [],
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            }
        ]
    },
    {
        "lane": "lane_ship",
        "label": "a release-readiness pass",
        "description": "Audits, critiques, hardens errors and i18n, validates responsive, finishes with polish.",
        "interviewLabel": "Get it ship-ready",
        "executionKind": "sequence",
        "verbChain": [
            "audit",
            "critique",
            "harden",
            "adapt",
            "polish"
        ],
        "prereqWaivers": [
            {
                "dependentFlowId": "flowJ_tactical_polish",
                "prerequisiteFlowId": "flowG_component_implementation",
                "reason": "existing UI satisfies the implementation-history assumption"
            }
        ],
        "flowSequence": [
            "flowK_multi_lens_audit",
            "flowI_accessibility",
            "flowL_design_critique",
            "flowV_all_seven_qa",
            "flowM_responsive_validation",
            "flowJ_tactical_polish"
        ],
        "verbGuidance": [
            {
                "verb": "audit",
                "guidance": [
                    "Diagnostic scan ran across accessibility, performance, theming, responsive, and anti-patterns; each scored 0-4.",
                    "Anti-patterns verdict opens the report (pass/fail on the \"does this look AI-generated\" question) with specific tells named.",
                    "Findings tagged P0-P3 with location, impact, WCAG standard, recommended fix, and the suggested follow-up command."
                ]
            },
            {
                "verb": "critique",
                "guidance": [
                    "Two independent assessments gathered (LLM design review and automated detection); neither saw the other before synthesis.",
                    "Nielsen heuristics scored 0-4 across all 10 with key issues called out per heuristic.",
                    "Persona red flags walked the primary user action for 2-3 personas relevant to this interface type."
                ]
            },
            {
                "verb": "harden",
                "guidance": [
                    "Extreme inputs tested (very long names, empty fields, emoji, RTL, CJK, large numbers, 1000+ items).",
                    "Internationalization handled with logical properties (margin-inline-start, padding-inline) and Intl APIs for dates and numbers.",
                    "Error states cover network, 4xx, 5xx, validation, rate limiting, and concurrent operations with recovery paths."
                ]
            },
            {
                "verb": "adapt",
                "guidance": [
                    "Source and target contexts named explicitly (device, input method, screen, connection, usage) before any changes.",
                    "Touch targets at 44x44px minimum and hover-dependent interactions replaced for touch contexts.",
                    "Tested on real devices in both orientations, not just DevTools emulation."
                ]
            },
            {
                "verb": "polish",
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            }
        ],
        "verbSteps": [
            {
                "verb": "audit",
                "flowIds": [
                    "flowK_multi_lens_audit",
                    "flowI_accessibility"
                ],
                "guidance": [
                    "Diagnostic scan ran across accessibility, performance, theming, responsive, and anti-patterns; each scored 0-4.",
                    "Anti-patterns verdict opens the report (pass/fail on the \"does this look AI-generated\" question) with specific tells named.",
                    "Findings tagged P0-P3 with location, impact, WCAG standard, recommended fix, and the suggested follow-up command."
                ]
            },
            {
                "verb": "critique",
                "flowIds": [
                    "flowL_design_critique"
                ],
                "guidance": [
                    "Two independent assessments gathered (LLM design review and automated detection); neither saw the other before synthesis.",
                    "Nielsen heuristics scored 0-4 across all 10 with key issues called out per heuristic.",
                    "Persona red flags walked the primary user action for 2-3 personas relevant to this interface type."
                ]
            },
            {
                "verb": "harden",
                "flowIds": [
                    "flowV_all_seven_qa"
                ],
                "guidance": [
                    "Extreme inputs tested (very long names, empty fields, emoji, RTL, CJK, large numbers, 1000+ items).",
                    "Internationalization handled with logical properties (margin-inline-start, padding-inline) and Intl APIs for dates and numbers.",
                    "Error states cover network, 4xx, 5xx, validation, rate limiting, and concurrent operations with recovery paths."
                ]
            },
            {
                "verb": "adapt",
                "flowIds": [
                    "flowM_responsive_validation"
                ],
                "guidance": [
                    "Source and target contexts named explicitly (device, input method, screen, connection, usage) before any changes.",
                    "Touch targets at 44x44px minimum and hover-dependent interactions replaced for touch contexts.",
                    "Tested on real devices in both orientations, not just DevTools emulation."
                ]
            },
            {
                "verb": "polish",
                "flowIds": [
                    "flowJ_tactical_polish"
                ],
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            }
        ]
    },
    {
        "lane": "lane_delight",
        "label": "a personality pass - color, motion, delight",
        "description": "Applies color, adds delightful micro-interactions, integrates motion, finishes with polish.",
        "interviewLabel": "Give it personality",
        "executionKind": "sequence",
        "verbChain": [
            "colorize",
            "delight",
            "animate",
            "polish"
        ],
        "prereqWaivers": [
            {
                "dependentFlowId": "flowA_brand_verify",
                "prerequisiteFlowId": "flowG_component_implementation",
                "reason": "brand-verify on existing UI does not require prior implementation history"
            }
        ],
        "flowSequence": [
            "flowF_design_tokens",
            "flowH_motion_integration",
            "flowT_ambitious_motion",
            "flowJ_tactical_polish",
            "flowM_responsive_validation"
        ],
        "verbGuidance": [
            {
                "verb": "colorize",
                "guidance": [
                    "Color strategy chosen explicitly (Restrained / Committed / Full palette / Drenched) before any hue decisions.",
                    "OKLCH used for color generation so equal lightness steps look perceptually equal.",
                    "No border-left or border-right greater than 1px as a colored accent stripe; full hairline border, background tint, or leading glyph used instead."
                ]
            },
            {
                "verb": "delight",
                "guidance": [
                    "Delight applied at specific moments (completion, first-time actions, error recovery, milestones), not pages.",
                    "Copy personality matched to the brand; cliched AI-slop loading messages explicitly avoided.",
                    "Delight remains skippable, brief (<1s), and never blocks core functionality."
                ]
            },
            {
                "verb": "animate",
                "guidance": [
                    "Hero moment chosen first; scattered micro-interactions resisted in favor of one well-orchestrated experience.",
                    "Easing curves drawn from ease-out-quart/quint/expo; bounce and elastic explicitly rejected as dated.",
                    "prefers-reduced-motion handled and exit animations clocked at roughly 75% of enter duration."
                ]
            },
            {
                "verb": "polish",
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            }
        ],
        "verbSteps": [
            {
                "verb": "colorize",
                "flowIds": [
                    "flowF_design_tokens"
                ],
                "guidance": [
                    "Color strategy chosen explicitly (Restrained / Committed / Full palette / Drenched) before any hue decisions.",
                    "OKLCH used for color generation so equal lightness steps look perceptually equal.",
                    "No border-left or border-right greater than 1px as a colored accent stripe; full hairline border, background tint, or leading glyph used instead."
                ]
            },
            {
                "verb": "delight",
                "flowIds": [
                    "flowH_motion_integration"
                ],
                "guidance": [
                    "Delight applied at specific moments (completion, first-time actions, error recovery, milestones), not pages.",
                    "Copy personality matched to the brand; cliched AI-slop loading messages explicitly avoided.",
                    "Delight remains skippable, brief (<1s), and never blocks core functionality."
                ]
            },
            {
                "verb": "animate",
                "flowIds": [
                    "flowT_ambitious_motion"
                ],
                "guidance": [
                    "Hero moment chosen first; scattered micro-interactions resisted in favor of one well-orchestrated experience.",
                    "Easing curves drawn from ease-out-quart/quint/expo; bounce and elastic explicitly rejected as dated.",
                    "prefers-reduced-motion handled and exit animations clocked at roughly 75% of enter duration."
                ]
            },
            {
                "verb": "polish",
                "flowIds": [
                    "flowJ_tactical_polish",
                    "flowM_responsive_validation"
                ],
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            }
        ]
    },
    {
        "lane": "lane_live",
        "label": "live in-browser iteration",
        "description": "Loops the design inside the browser: live iteration, color refinement, polish, then a critique pass.",
        "interviewLabel": "Iterate live in the browser",
        "executionKind": "sequence",
        "verbChain": [
            "live",
            "colorize",
            "polish",
            "critique"
        ],
        "prereqWaivers": [
            {
                "dependentFlowId": "flowJ_tactical_polish",
                "prerequisiteFlowId": "flowG_component_implementation",
                "reason": "existing UI satisfies the implementation-history assumption"
            }
        ],
        "flowSequence": [
            "flowN_rapid_iteration_refined",
            "flowF_design_tokens",
            "flowJ_tactical_polish",
            "flowM_responsive_validation",
            "flowL_design_critique",
            "flowK_multi_lens_audit"
        ],
        "verbGuidance": [
            {
                "verb": "live",
                "guidance": [
                    "Identity lock extracted from DESIGN.md, CSS custom properties, computed styles, or sibling components before any planning.",
                    "Default mode (preserve identity, vary axes) used for ~90% of sessions; departure mode triggered only by explicit anti-references or freeform prompt.",
                    "Three variants committed to three DIFFERENT primary axes; squint test confirmed they read as the same brand at three angles."
                ]
            },
            {
                "verb": "colorize",
                "guidance": [
                    "Color strategy chosen explicitly (Restrained / Committed / Full palette / Drenched) before any hue decisions.",
                    "OKLCH used for color generation so equal lightness steps look perceptually equal.",
                    "No border-left or border-right greater than 1px as a colored accent stripe; full hairline border, background tint, or leading glyph used instead."
                ]
            },
            {
                "verb": "polish",
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            },
            {
                "verb": "critique",
                "guidance": [
                    "Two independent assessments gathered (LLM design review and automated detection); neither saw the other before synthesis.",
                    "Nielsen heuristics scored 0-4 across all 10 with key issues called out per heuristic.",
                    "Persona red flags walked the primary user action for 2-3 personas relevant to this interface type."
                ]
            }
        ],
        "verbSteps": [
            {
                "verb": "live",
                "flowIds": [
                    "flowN_rapid_iteration_refined"
                ],
                "guidance": [
                    "Identity lock extracted from DESIGN.md, CSS custom properties, computed styles, or sibling components before any planning.",
                    "Default mode (preserve identity, vary axes) used for ~90% of sessions; departure mode triggered only by explicit anti-references or freeform prompt.",
                    "Three variants committed to three DIFFERENT primary axes; squint test confirmed they read as the same brand at three angles."
                ]
            },
            {
                "verb": "colorize",
                "flowIds": [
                    "flowF_design_tokens"
                ],
                "guidance": [
                    "Color strategy chosen explicitly (Restrained / Committed / Full palette / Drenched) before any hue decisions.",
                    "OKLCH used for color generation so equal lightness steps look perceptually equal.",
                    "No border-left or border-right greater than 1px as a colored accent stripe; full hairline border, background tint, or leading glyph used instead."
                ]
            },
            {
                "verb": "polish",
                "flowIds": [
                    "flowJ_tactical_polish",
                    "flowM_responsive_validation"
                ],
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            },
            {
                "verb": "critique",
                "flowIds": [
                    "flowL_design_critique",
                    "flowK_multi_lens_audit"
                ],
                "guidance": [
                    "Two independent assessments gathered (LLM design review and automated detection); neither saw the other before synthesis.",
                    "Nielsen heuristics scored 0-4 across all 10 with key issues called out per heuristic.",
                    "Persona red flags walked the primary user action for 2-3 personas relevant to this interface type."
                ]
            }
        ]
    },
    {
        "lane": "lane_calm",
        "label": "a tone-down pass - quiet it to essentials",
        "description": "Quiets visual noise, distills to essentials, clarifies copy and labels, then polishes.",
        "interviewLabel": "Quiet it down to essentials",
        "executionKind": "sequence",
        "verbChain": [
            "quieter",
            "distill",
            "clarify",
            "polish"
        ],
        "prereqWaivers": [
            {
                "dependentFlowId": "flowJ_tactical_polish",
                "prerequisiteFlowId": "flowG_component_implementation",
                "reason": "existing UI satisfies the implementation-history assumption"
            }
        ],
        "flowSequence": [
            "flowJ_tactical_polish",
            "flowX_copywriting",
            "flowM_responsive_validation"
        ],
        "verbGuidance": [
            {
                "verb": "quieter",
                "guidance": [
                    "Intensity sources catalogued (color saturation, contrast extremes, visual weight, animation excess) before reducing.",
                    "Saturation pulled to 70-85% and tinted grays used instead of pure gray for restrained depth.",
                    "Quieter does not mean grayscale or generic; the POV survived the cuts."
                ]
            },
            {
                "verb": "distill",
                "guidance": [
                    "Core purpose named as ONE thing; everything else evaluated against whether it earns its place.",
                    "Progressive disclosure used to hide complexity behind clear entry points instead of removing necessary features.",
                    "Cards never nested inside cards; spacing and dividers carry hierarchy within sections."
                ]
            },
            {
                "verb": "clarify",
                "guidance": [
                    "Active voice and specific labels preferred; \"Click here\", \"Submit\", \"OK\" replaced with verb-plus-noun CTAs.",
                    "Error messages explain what went wrong and suggest how to fix it, without blaming the user.",
                    "Confirmation dialogs state the specific action and consequences instead of \"Are you sure?\"."
                ]
            },
            {
                "verb": "polish",
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            }
        ],
        "verbSteps": [
            {
                "verb": "quieter",
                "flowIds": [
                    "flowJ_tactical_polish"
                ],
                "guidance": [
                    "Intensity sources catalogued (color saturation, contrast extremes, visual weight, animation excess) before reducing.",
                    "Saturation pulled to 70-85% and tinted grays used instead of pure gray for restrained depth.",
                    "Quieter does not mean grayscale or generic; the POV survived the cuts."
                ]
            },
            {
                "verb": "distill",
                "flowIds": [],
                "guidance": [
                    "Core purpose named as ONE thing; everything else evaluated against whether it earns its place.",
                    "Progressive disclosure used to hide complexity behind clear entry points instead of removing necessary features.",
                    "Cards never nested inside cards; spacing and dividers carry hierarchy within sections."
                ]
            },
            {
                "verb": "clarify",
                "flowIds": [
                    "flowX_copywriting"
                ],
                "guidance": [
                    "Active voice and specific labels preferred; \"Click here\", \"Submit\", \"OK\" replaced with verb-plus-noun CTAs.",
                    "Error messages explain what went wrong and suggest how to fix it, without blaming the user.",
                    "Confirmation dialogs state the specific action and consequences instead of \"Are you sure?\"."
                ]
            },
            {
                "verb": "polish",
                "flowIds": [
                    "flowM_responsive_validation"
                ],
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            }
        ]
    },
    {
        "lane": "lane_converge",
        "label": "iterate-until-it-passes looping",
        "description": "Runs polish, audit, and critique in a loop until the product validators pass or a cap fires.",
        "interviewLabel": "Loop until it passes",
        "executionKind": "loop",
        "verbChain": [
            "polish",
            "audit",
            "critique"
        ],
        "prereqWaivers": [
            {
                "dependentFlowId": "flowJ_tactical_polish",
                "prerequisiteFlowId": "flowG_component_implementation",
                "reason": "existing UI satisfies the implementation-history assumption"
            }
        ],
        "flowSequence": [
            "flowJ_tactical_polish",
            "flowM_responsive_validation",
            "flowK_multi_lens_audit",
            "flowI_accessibility",
            "flowL_design_critique"
        ],
        "verbGuidance": [
            {
                "verb": "polish",
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            },
            {
                "verb": "audit",
                "guidance": [
                    "Diagnostic scan ran across accessibility, performance, theming, responsive, and anti-patterns; each scored 0-4.",
                    "Anti-patterns verdict opens the report (pass/fail on the \"does this look AI-generated\" question) with specific tells named.",
                    "Findings tagged P0-P3 with location, impact, WCAG standard, recommended fix, and the suggested follow-up command."
                ]
            },
            {
                "verb": "critique",
                "guidance": [
                    "Two independent assessments gathered (LLM design review and automated detection); neither saw the other before synthesis.",
                    "Nielsen heuristics scored 0-4 across all 10 with key issues called out per heuristic.",
                    "Persona red flags walked the primary user action for 2-3 personas relevant to this interface type."
                ]
            }
        ],
        "verbSteps": [
            {
                "verb": "polish",
                "flowIds": [
                    "flowJ_tactical_polish",
                    "flowM_responsive_validation"
                ],
                "guidance": [
                    "Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).",
                    "Pre-polish assessment confirmed functional completeness before any cosmetic work.",
                    "Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality."
                ]
            },
            {
                "verb": "audit",
                "flowIds": [
                    "flowK_multi_lens_audit",
                    "flowI_accessibility"
                ],
                "guidance": [
                    "Diagnostic scan ran across accessibility, performance, theming, responsive, and anti-patterns; each scored 0-4.",
                    "Anti-patterns verdict opens the report (pass/fail on the \"does this look AI-generated\" question) with specific tells named.",
                    "Findings tagged P0-P3 with location, impact, WCAG standard, recommended fix, and the suggested follow-up command."
                ]
            },
            {
                "verb": "critique",
                "flowIds": [
                    "flowL_design_critique"
                ],
                "guidance": [
                    "Two independent assessments gathered (LLM design review and automated detection); neither saw the other before synthesis.",
                    "Nielsen heuristics scored 0-4 across all 10 with key issues called out per heuristic.",
                    "Persona red flags walked the primary user action for 2-3 personas relevant to this interface type."
                ]
            }
        ]
    }
];
exports.LANES_BY_ID = Object.fromEntries(exports.LANES.map(l => [l.lane, l]));
function getLane(id) { return exports.LANES_BY_ID[id]; }
function getLaneFlowSequence(id) { return exports.LANES_BY_ID[id]?.flowSequence; }
//# sourceMappingURL=lanes.generated.js.map
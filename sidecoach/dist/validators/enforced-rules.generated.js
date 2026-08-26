"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENFORCED_RULE_IDS = exports.ENFORCED_RULES = void 0;
exports.ENFORCED_RULES = [
    {
        "ruleId": "motion.no-scale-zero-enter",
        "sourceRuleAliases": [
            "mined:motion.no-scale-zero-enter"
        ],
        "canonicalRuleKey": "mined/no-scale-zero-enter",
        "ownerValidatorId": "polish-standard",
        "sourceVocabulary": "mined-taste",
        "sourceSeverity": "high",
        "severity": "major",
        "severityOverrideReason": "enforced via sidecoach-taste-enforce (held-out precision 1 >= threshold, human-signed); flipped from advisory to blocking",
        "findingClass": "anti-pattern",
        "registryScope": "mined-motion-enter-origin",
        "evidenceRequirements": [
            "css-rule"
        ],
        "supportedSourceKinds": [
            {
                "kind": "css",
                "level": "full"
            },
            {
                "kind": "scss",
                "level": "full"
            },
            {
                "kind": "less",
                "level": "full"
            },
            {
                "kind": "tsx",
                "level": "partial"
            },
            {
                "kind": "html",
                "level": "partial"
            }
        ],
        "scope": "file",
        "narrowTargetBehavior": "evaluate_expanded_context",
        "applicability": "not_applicable",
        "patternSpec": {
            "specVersion": 1,
            "engine": "static-css-regex",
            "applicability": {
                "anyOf": [
                    "scale\\("
                ],
                "scope": "both"
            },
            "defect": {
                "anyOf": [
                    {
                        "pattern": "scale\\(\\s*0(?:\\.0+)?\\s*\\)",
                        "flags": "i"
                    }
                ]
            },
            "message": "transform: scale(0) - an element animates to or from literal zero scale, appearing or disappearing from nothing.",
            "remediation": "Scale from/to 0.9-0.97 with an opacity fade instead of literal 0; reserve a full pop for deliberate emphasis.",
            "evidenceScope": "both"
        }
    }
];
/** The ruleIds of every certified live-blocking mined-taste rule (for the runtime invariant). */
exports.ENFORCED_RULE_IDS = ["motion.no-scale-zero-enter"];
//# sourceMappingURL=enforced-rules.generated.js.map
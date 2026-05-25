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
exports.parseDesignMd = parseDesignMd;
exports.findTokenLine = findTokenLine;
const yaml = __importStar(require("js-yaml"));
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
function parseDesignMd(src) {
    const m = src.match(FRONTMATTER_RE);
    if (!m) {
        throw new Error('DESIGN.md: no YAML frontmatter found (expected leading --- block)');
    }
    const yamlText = m[1];
    const data = yaml.load(yamlText) || {};
    const before = src.slice(0, m.index ?? 0);
    const frontmatterStart = before.split('\n').length;
    const frontmatterEnd = frontmatterStart + yamlText.split('\n').length + 1;
    return {
        colors: data.colors || {},
        typography: data.typography || {},
        rounded: data.rounded || {},
        spacing: data.spacing || {},
        shadow: data.shadow || {},
        motion: data.motion || {},
        bodyLineNumbers: {
            frontmatterStart,
            frontmatterEnd,
            bodyStart: frontmatterEnd + 1,
        },
        raw: data,
    };
}
function findTokenLine(src, dottedPath) {
    const segments = dottedPath.split('.').filter(Boolean);
    if (segments.length === 0)
        return -1;
    const lines = src.split('\n');
    let segIdx = 0;
    let expectedIndent = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const indent = line.length - line.trimStart().length;
        if (segIdx > 0 && indent < expectedIndent) {
            // walked out of the parent block before finding the next segment
            return -1;
        }
        if (indent !== expectedIndent)
            continue;
        const target = segments[segIdx];
        const matches = trimmed.startsWith(`${target}:`) ||
            trimmed.startsWith(`"${target}":`) ||
            trimmed.startsWith(`'${target}':`);
        if (matches) {
            segIdx++;
            if (segIdx === segments.length)
                return i + 1;
            expectedIndent += 2;
        }
    }
    return -1;
}
//# sourceMappingURL=design-md-parser.js.map
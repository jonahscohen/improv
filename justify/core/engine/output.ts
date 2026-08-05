/**
 * Format element changes as structured context for AI agents.
 *
 * Ported from Retune (overlay/src/engine/output.ts), TRIMMED for this phase:
 * the token/candidate/manifest/comment layers are deferred, so this version
 * drops the "Token" column, design-token summary, framework detection,
 * responsive-manifest context, resolution-context <details>, and comments.
 * What it keeps faithfully:
 *   - element identification (tag, selector + scope, classes, component)
 *   - source file line ONLY when present (omitted on non-React/WordPress targets)
 *   - structural actions (__delete / __reparent / __reorder / __text)
 *   - the CSS changes table (with shorthand collapsing + breakpoint overrides)
 *   - a SEPARATE `### Attribute Changes` / `### SVG Attribute Changes` table
 *   - the React `### Prop Changes` table (empty on non-React)
 *   - the `### Detached Variables` table (data only; token resolution deferred)
 * Property keys are camelCase internally; kebab conversion happens here, at the
 * output boundary, via camelToKebab. (Comments de-emdashed for the content guard.)
 */

import type { ElementChange, PropertyChange } from "./types.js";
import { camelToKebab, truncate } from "../inspector/utils.js";
import { captureEnvironment, formatEnvironmentLines } from "../environment.js";

export type Fidelity = "minimal" | "standard" | "full";

/** Known pseudo-state suffixes that we extract from selectors */
const PSEUDO_STATES = [":hover", ":focus", ":active", ":focus-visible", ":focus-within"] as const;

interface ParsedSelector {
  /** The base selector without pseudo-state (e.g. ".btn") */
  base: string;
  /** The pseudo-state if present (e.g. "hover") */
  pseudoState: string | null;
}

/** Extract pseudo-state suffix from a selector, e.g. ".btn:hover" -> { base: ".btn", pseudoState: "hover" } */
export function parsePseudoState(selector: string): ParsedSelector {
  for (const pseudo of PSEUDO_STATES) {
    if (selector.endsWith(pseudo)) {
      return {
        base: selector.slice(0, -pseudo.length),
        pseudoState: pseudo.slice(1), // remove the leading ":"
      };
    }
  }
  return { base: selector, pseudoState: null };
}

/** Describe the scope of a selector for AI agent context */
export function describeSelectorScope(selector: string): string | null {
  // Strip pseudo-state first for scope analysis
  const { base } = parsePseudoState(selector);

  // Ancestor-scoped selectors: contain descendant combinator (space between class parts)
  // e.g. ".message-row--unread .message-row__subject"
  const noParen = base.replace(/\([^)]*\)/g, ""); // ignore spaces inside pseudo-functions
  // Match descendant/child combinators between any selector parts (classes, attributes, pseudo-functions)
  const hasDescendant = /[.\])\w]\s+[.\[:]/.test(noParen);
  const hasChild = /[.\])\w]\s*>\s*[.\[:]/.test(noParen);

  if (base.startsWith(".") || base.startsWith(":") || base.startsWith("[")) {
    try {
      const count = document.querySelectorAll(base).length;
      const countStr = count > 0 ? `, ${count} element${count > 1 ? "s" : ""}` : "";
      if (hasDescendant || hasChild) {
        return `ancestor-scoped${countStr}`;
      }
      if (count > 0) {
        return `class-scoped${countStr}`;
      }
    } catch {
      // Invalid selector for querySelectorAll - fall through
    }
    if (hasDescendant || hasChild) return "ancestor-scoped";
    return "class-scoped";
  }

  // ID-based selectors
  if (base.startsWith("#")) {
    return "id-scoped, unique";
  }

  // Path selectors (contain ">") or other complex selectors are element-specific
  if (base.includes(">")) {
    return "element-specific";
  }

  return null;
}

export function formatChanges(changes: ElementChange[], fidelity: Fidelity = "standard"): string {
  if (changes.length === 0) return "No changes recorded.";

  // Separate bulk instances from primary changes
  const bulkCount = changes.filter(c => c.changes.some(p => p.property === "__bulkOf")).length;
  const primaryChanges = changes.filter(c => !c.changes.some(p => p.property === "__bulkOf"));
  // Use primary changes for output; add bulk count to structural actions
  changes = primaryChanges;

  const lines: string[] = [];

  // Header - preamble gives the AI model clear intent + identification
  lines.push("Apply these Justify visual changes to the source code:\n");

  // Environment context - viewport + DPR + browser + OS, so the AI has the
  // authoring environment when translating these changes to source.
  lines.push("**Environment:**");
  lines.push(`- URL: ${window.location.href}`);
  for (const line of formatEnvironmentLines(captureEnvironment())) lines.push(`- ${line}`);
  lines.push(`- Timestamp: ${new Date().toISOString()}`);
  lines.push("");

  // Each element change - only show section if there are changes
  if (changes.length > 0) {
    lines.push(`# Visual Changes (${changes.length} element${changes.length !== 1 ? "s" : ""})`);
    lines.push("");
    const sections = changes.map((change) => formatSingleChange(change, fidelity, bulkCount));
    lines.push(sections.join("\n---\n\n"));
  }

  return lines.join("\n");
}

function formatSingleChange(change: ElementChange, fidelity: Fidelity, bulkInstanceCount = 0): string {
  const lines: string[] = [];

  // Element identification
  lines.push(`## \`<${change.tagName.toLowerCase()}>\`${change.textContent ? ` "${truncate(change.textContent, 60)}"` : ""}`);
  lines.push("");

  // Source file (most important for agents to find the code).
  // Omitted entirely on non-React targets where sourceFile is null/undefined.
  if (change.sourceFile) {
    const col = change.sourceFile.columnNumber ? `:${change.sourceFile.columnNumber}` : "";
    lines.push(`**Source:** \`${change.sourceFile.fileName}:${change.sourceFile.lineNumber}${col}\``);
  }

  // Component hierarchy (empty on non-React targets)
  if (change.reactComponents.length > 0) {
    lines.push(`**Component:** ${change.reactComponents.join(" -> ")}`);
  }

  // Styling approach
  if (change.stylingApproach && change.stylingApproach !== "unknown") {
    lines.push(`**Styling:** ${formatStylingApproach(change.stylingApproach)}`);
  }

  // DOM path (full traversal for precise identification)
  if (fidelity !== "minimal" && change.domPath) {
    lines.push(`**DOM Path:** \`${change.domPath}\``);
  }

  // Selector - extract pseudo-state and add scope context
  const { base: baseSelector, pseudoState } = parsePseudoState(change.selector);
  const selectorAnnotations: string[] = [];
  if (pseudoState) {
    selectorAnnotations.push(`${pseudoState} state`);
  }
  const scope = describeSelectorScope(change.selector);
  if (scope) {
    selectorAnnotations.push(scope);
  }
  const selectorSuffix = selectorAnnotations.length > 0
    ? ` (${selectorAnnotations.join(", ")})`
    : "";
  lines.push(`**Selector:** \`${baseSelector}\`${selectorSuffix}`);

  // For compound/ancestor selectors, break down the class chain
  // so the AI knows which classes to look for in the source code
  const noParen = baseSelector.replace(/\([^)]*\)/g, "");
  const isAncestorSelector = /\.[a-zA-Z][\w-]*\s+\.[a-zA-Z]/.test(noParen) || /\.[a-zA-Z][\w-]*\s*>\s*\.[a-zA-Z]/.test(noParen);

  if (isAncestorSelector) {
    // Ancestor compound: ".parent .child" - split into ancestor and element parts
    const parts = baseSelector.split(/\s+(?=[.#\[:])/).filter(Boolean);
    if (parts.length >= 2) {
      const ancestorPart = parts.slice(0, -1).join(" ");
      const elementPart = parts[parts.length - 1];
      lines.push(`**Ancestor context:** \`${ancestorPart}\` - change only applies inside this ancestor`);
      lines.push(`**Target element:** \`${elementPart}\` - the element being styled`);
    }
  } else {
    const compoundClasses = baseSelector.match(/\.[a-zA-Z0-9_-]+/g);
    if (compoundClasses && compoundClasses.length > 1) {
      const classBreakdown = compoundClasses.map(c => {
        const cls = c.slice(1); // strip leading dot
        try {
          const count = document.querySelectorAll(c).length;
          return `\`.${cls}\` (${count})`;
        } catch { return `\`.${cls}\``; }
      });
      lines.push(`**Target classes:** ${classBreakdown.join(" -> ")} - apply changes where all these classes are present`);
    }
  }

  // Element ID
  if (fidelity === "full" && change.elementId) {
    lines.push(`**ID:** \`${change.elementId}\``);
  }

  // Accessible name (aria-label, alt, title, etc.)
  if (fidelity === "full" && change.accessibleName) {
    lines.push(`**Accessible name:** "${change.accessibleName}"`);
  }

  // Classes (always include when present - agents need this)
  if (change.classes.length > 0) {
    lines.push(`**Classes:** \`${change.classes.join(" ")}\``);
  }

  // Position and dimensions
  if (fidelity === "full" && change.position) {
    lines.push(`**Position:** x:${change.position.x}, y:${change.position.y} (${change.position.width}x${change.position.height}px)`);
  }

  // Nearby siblings for context
  if (fidelity === "full" && change.nearbySiblings) {
    lines.push(`**Nearby elements:** ${change.nearbySiblings}`);
  }

  // Parent context for disambiguation
  if (fidelity === "full" && change.parentContext) {
    lines.push(`**Parent:** \`${change.parentContext}\``);
  }

  // Child summary to help identify container elements
  if (fidelity === "full" && change.childSummary) {
    lines.push(`**Children:** ${change.childSummary}`);
  }

  // Inline styles (if any authored inline styles exist)
  if (fidelity === "full" && change.inlineStyles) {
    lines.push(`**Inline styles:** \`${change.inlineStyles}\``);
  }

  // Check for element deletion
  const isDelete = change.changes.some(c => c.property === "__delete");
  if (isDelete) {
    lines.push("");
    lines.push("### Action: Delete Element");
    lines.push("");
    lines.push("Remove this element from the source code entirely.");
    if (change.classes.length > 0) {
      lines.push(`**Classes:** \`${change.classes.join(" ")}\``);
    }
    lines.push("");
    return lines.join("\n");
  }

  // Check for reparent
  const reparentChange = change.changes.find(c => c.property === "__reparent");
  if (reparentChange) {
    // Parse "selector@index" format - use lastIndexOf to handle selectors with special chars
    const fromAtIdx = reparentChange.from.lastIndexOf("@");
    const fromSelector = fromAtIdx !== -1 ? reparentChange.from.slice(0, fromAtIdx) : reparentChange.from;
    const toAtIdx = reparentChange.to.lastIndexOf("@");
    const toSelector = toAtIdx !== -1 ? reparentChange.to.slice(0, toAtIdx) : reparentChange.to;
    const toIndex = toAtIdx !== -1 ? reparentChange.to.slice(toAtIdx + 1) : "0";
    lines.push("");
    lines.push("### Action: Reparent Element");
    lines.push("");
    if (bulkInstanceCount > 0) {
      lines.push(`Move this element from its current parent to a new parent container. **This is a component-level change affecting ${bulkInstanceCount + 1} instances** - apply the change to the component JSX template, not individual instances.`);
    } else {
      lines.push("Move this element from its current parent to a new parent container.");
    }
    lines.push(`**From:** \`${fromSelector}\``);
    lines.push(`**To:** \`${toSelector}\` (as child at position ${toIndex})`);
    lines.push("");
    return lines.join("\n");
  }

  // Check for reorder
  const reorderChange = change.changes.find(c => c.property === "__reorder");
  if (reorderChange) {
    lines.push("");
    lines.push("### Action: Reorder Element");
    lines.push("");
    if (bulkInstanceCount > 0) {
      lines.push(`Moved from position ${reorderChange.from} to position ${reorderChange.to} within its parent container. **This is a component-level change affecting ${bulkInstanceCount + 1} instances** - reorder the children in the component JSX template, not individual instances.`);
    } else {
      lines.push(`Moved from position ${reorderChange.from} to position ${reorderChange.to} within its parent container.`);
    }
    lines.push("");
  }

  // Check for text content change
  const textChange = change.changes.find(c => c.property === "__text");
  if (textChange) {
    lines.push("");
    lines.push("### Action: Edit Text Content");
    lines.push("");
    lines.push("**Before:**");
    lines.push("```");
    lines.push(textChange.from);
    lines.push("```");
    lines.push("**After:**");
    lines.push("```");
    lines.push(textChange.to);
    lines.push("```");
    lines.push("");
  }

  // Collapse longhand groups into shorthands where possible.
  // (Token enrichment is deferred; the table shows Property | Before | After only.)
  const collapsed = collapseShorthands(change.changes).filter(c => !c.property.startsWith("__"));

  // CSS changes table - group by breakpoint (base first, then overrides)
  if (collapsed.length > 0) {
    const baseChanges = collapsed.filter(p => !p.breakpoint);
    const bpGroups = new Map<string, PropertyChange[]>();
    for (const prop of collapsed) {
      if (prop.breakpoint) {
        const group = bpGroups.get(prop.breakpoint) || [];
        group.push(prop);
        bpGroups.set(prop.breakpoint, group);
      }
    }

    const renderTable = (props: PropertyChange[]) => {
      lines.push("| Property | Before | After |");
      lines.push("|----------|--------|-------|");
      for (const prop of props) {
        const kebab = prop.property.startsWith("class:") ? prop.property : camelToKebab(prop.property);
        lines.push(`| \`${kebab}\` | \`${prop.from}\` | \`${prop.to}\` |`);
      }
    };

    if (baseChanges.length > 0) {
      lines.push("");
      lines.push(bpGroups.size > 0 ? "### Changes (base)" : "### Changes");
      lines.push("");
      renderTable(baseChanges);
    }

    // Breakpoint overrides - sorted widest first
    const sortedBps = [...bpGroups.entries()].sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
    for (const [bp, props] of sortedBps) {
      lines.push("");
      lines.push(`### Override @media (max-width: ${bp})`);
      lines.push("");
      renderTable(props);
    }
  }

  // Detached variables - properties where the user explicitly removed a token/variable binding
  if (change.unlinkedProperties && change.unlinkedProperties.length > 0) {
    lines.push("");
    lines.push("### Detached Variables");
    lines.push("");
    lines.push("The following properties had their design token/variable binding removed. Hardcode the current values - do not use the token class or CSS variable:");
    lines.push("");
    lines.push("| Property | Current Value |");
    lines.push("|----------|---------------|");
    for (const { property, value } of change.unlinkedProperties) {
      const kebab = camelToKebab(property);
      lines.push(`| \`${kebab}\` | \`${value}\` |`);
    }
  }

  // Attribute changes (HTML/SVG attributes - alt, loading, autoplay, fill, stroke, etc.)
  // Kept DISTINCT from the CSS changes table above.
  if (change.attributeChanges && change.attributeChanges.length > 0) {
    const isSvgElement = ["SVG", "PATH", "CIRCLE", "ELLIPSE", "RECT", "LINE", "POLYGON", "POLYLINE", "G", "TEXT", "USE", "DEFS"].includes(change.tagName.toUpperCase());
    lines.push("");
    lines.push(isSvgElement ? "### SVG Attribute Changes" : "### Attribute Changes");
    lines.push("");
    lines.push(isSvgElement
      ? "Apply these changes to the SVG element's attributes:"
      : "Apply these changes to the HTML element's attributes:");
    lines.push("");
    lines.push("| Attribute | From | To |");
    lines.push("|-----------|------|----|");
    for (const { attr, from, to } of change.attributeChanges) {
      lines.push(`| \`${attr}\` | \`${from || "-"}\` | \`${to}\` |`);
    }
  }

  // Prop changes (React component prop edits; empty on non-React targets)
  if (change.propChanges && change.propChanges.length > 0) {
    lines.push("");
    lines.push("### Prop Changes");
    lines.push("");
    lines.push("Apply these changes to the JSX where this component is rendered:");
    lines.push("");
    lines.push("| Prop | From | To |");
    lines.push("|------|------|----|");
    for (const { prop, from, to } of change.propChanges) {
      const fromStr = from === undefined ? "-" : JSON.stringify(from);
      const toStr = to === undefined ? "-" : JSON.stringify(to);
      lines.push(`| \`${prop}\` | \`${fromStr}\` | \`${toStr}\` |`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function formatStylingApproach(approach: string): string {
  switch (approach) {
    case "tailwind": return "Tailwind CSS (modify utility classes)";
    case "css-modules": return "CSS Modules (modify `.module.css` file)";
    case "css-in-js": return "CSS-in-JS / Emotion (modify style object)";
    case "styled-components": return "styled-components (modify template literal)";
    case "plain-css": return "Plain CSS (modify stylesheet)";
    default: return approach;
  }
}

/** Shorthand groups: when all longhands share the same "to" value, collapse into one shorthand */
const SHORTHAND_GROUPS: Array<{ shorthand: string; longhands: string[] }> = [
  {
    shorthand: "borderRadius",
    longhands: ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"],
  },
  {
    shorthand: "padding",
    longhands: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  },
  {
    shorthand: "margin",
    longhands: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  },
  {
    shorthand: "borderWidth",
    longhands: ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"],
  },
  {
    shorthand: "borderColor",
    longhands: ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"],
  },
  {
    shorthand: "borderStyle",
    longhands: ["borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle"],
  },
];

export function collapseShorthands(changes: PropertyChange[]): PropertyChange[] {
  const result = [...changes];
  for (const group of SHORTHAND_GROUPS) {
    const matches = group.longhands.map((lh) => result.find((c) => c.property === lh));
    if (matches.every((m) => m != null)) {
      const allSameTo = new Set(matches.map((m) => m!.to)).size === 1;
      const allSameFrom = new Set(matches.map((m) => m!.from)).size === 1;
      if (allSameTo && allSameFrom) {
        // Remove longhands, add shorthand
        for (const lh of group.longhands) {
          const idx = result.findIndex((c) => c.property === lh);
          if (idx !== -1) result.splice(idx, 1);
        }
        result.push({ property: group.shorthand, from: matches[0]!.from, to: matches[0]!.to });
      }
    }
  }
  return result;
}

#!/bin/bash
# PreToolUse hook for mcp__claude-in-chrome__javascript_tool
# Blocks JavaScript that shortcuts human-like validation.
#
# When verifying deliverables, Claude must interact like a real user:
# click, type, navigate, screenshot, read_page. Not run JS to inspect
# the DOM, check computed styles, count elements, or read text nodes.
#
# Legitimate JS uses (console.log debugging, dialog dismissal, actual
# implementation work) are not blocked. Only developer-experience
# validation patterns are caught.

INPUT=$(cat)
JS_CODE=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    inp = data.get("tool_input", {})
    code = inp.get("javascript", "") or inp.get("code", "") or inp.get("script", "") or inp.get("expression", "")
    print(code)
except:
    print("")
' 2>/dev/null)

[ -z "$JS_CODE" ] && echo '{}' && exit 0

REASON=""
REMEDY=""

# Feature-detection signal. Read-only capability checks (typeof, CSS.supports,
# `'feature' in window/document`, navigator.userAgent, window.matchMedia) are
# allowed because they don't expose DOM state - they're needed for things like
# prefers-reduced-motion, prefers-color-scheme, View Transitions, etc. Mirror the
# carve-out in bash-guard.sh so cmux eval and chrome MCP javascript_tool behave
# identically. See CLAUDE.md Verification Protocol #2.
#
# The carve-out applies ONLY if the eval ALSO does not match any blocked pattern
# below - mixing feature detection with DOM probing in one eval is still blocked.
FEATURE_DETECT=false
if echo "$JS_CODE" | grep -qE "\btypeof\s|CSS\.supports\(|'[a-zA-Z][a-zA-Z0-9_]*'\s+in\s+(window|document)|\"[a-zA-Z][a-zA-Z0-9_]*\"\s+in\s+(window|document)|navigator\.userAgent|window\.matchMedia\("; then
  FEATURE_DETECT=true
fi

# getComputedStyle - checking CSS values programmatically
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE 'getComputedStyle'; then
  REASON="getComputedStyle is a developer shortcut, not a human validation method."
  REMEDY="Take a screenshot and visually confirm the styling."
fi

# getBoundingClientRect - measuring layout programmatically
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE 'getBoundingClientRect'; then
  REASON="getBoundingClientRect is a developer shortcut for layout measurement."
  REMEDY="Take a screenshot and visually verify position and size."
fi

# offset/client/scroll dimension properties
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.(offsetWidth|offsetHeight|offsetLeft|offsetTop|clientWidth|clientHeight|scrollWidth|scrollHeight|scrollTop|scrollLeft)'; then
  REASON="DOM dimension/scroll properties are developer shortcuts."
  REMEDY="Take a screenshot or scroll the page like a user would."
fi

# .style property access - reading inline styles
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.style[\.\[]'; then
  REASON="Reading element.style is a developer shortcut."
  REMEDY="Take a screenshot and verify the visual result."
fi

# classList - checking CSS class presence
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.classList'; then
  REASON="classList inspection is a developer shortcut."
  REMEDY="Verify the visual effect (color, visibility, state) via screenshot."
fi

# className - reading class attribute
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.className'; then
  REASON="className inspection is a developer shortcut."
  REMEDY="Verify the visual result via screenshot, not the CSS class name."
fi

# hasAttribute / getAttribute
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.(hasAttribute|getAttribute)\('; then
  REASON="Attribute inspection is a developer shortcut."
  REMEDY="Interact with the element and verify its behavior like a user would."
fi

# .matches() CSS selector check
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.matches\('; then
  REASON=".matches() is a developer shortcut for selector validation."
  REMEDY="Verify the element visually or by interacting with it."
fi

# .closest() DOM traversal for validation
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.closest\('; then
  REASON=".closest() is a developer shortcut for DOM structure validation."
  REMEDY="Verify structure visually via screenshot."
fi

# querySelectorAll(...).length - counting elements
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE 'querySelectorAll\([^)]*\)\s*\.length'; then
  REASON="Counting DOM elements via querySelectorAll.length is a developer shortcut."
  REMEDY="Look at the page via screenshot to see how many items are present."
fi

# .textContent / .innerText / .innerHTML for reading page content
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.(textContent|innerText|innerHTML)'; then
  REASON="Reading DOM text/HTML properties is a developer shortcut."
  REMEDY="Use read_page or get_page_text to see what a human sees."
fi

# window.innerWidth / innerHeight
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE 'window\.(innerWidth|innerHeight)'; then
  REASON="Checking viewport dimensions programmatically is a developer shortcut."
  REMEDY="Use resize_window to set viewport size, then screenshot to verify."
fi

# Existence checks: !!querySelector, querySelector !== null, Boolean(querySelector)
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '(!!\s*document\.querySelector|document\.querySelector[^A]*\s*(!==?|===?)\s*null|Boolean\s*\(\s*document\.querySelector)'; then
  REASON="Checking element existence via JavaScript is a developer shortcut."
  REMEDY="Look at the page via screenshot to confirm the element is visible."
fi

# document.querySelectorAll used to iterate/inspect (forEach, map, filter on results)
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE 'querySelectorAll\([^)]*\)\s*\)\s*\.(forEach|map|filter|every|some|reduce)'; then
  REASON="Iterating DOM query results is a developer inspection pattern."
  REMEDY="Navigate the page and verify each item visually like a user would."
fi

# Generic validation: checking .disabled, .checked, .selected on form elements
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.(disabled|checked|selected)\b'; then
  REASON="Checking form element state via properties is a developer shortcut."
  REMEDY="Click the form element and observe its behavior like a user would."
fi

# ===========================================================================
# Trigger-blocking patterns. The above catches READ shortcuts. These catch
# WRITE/INVOKE shortcuts where JS fires application logic that would normally
# require a real click/keystroke. Validation through these is meaningless
# because it bypasses the exact path a real user would exercise.
# ===========================================================================

# Synthetic .click() invocation on an element
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.click\(\s*\)'; then
  REASON="Synthetic .click() bypasses the real interaction path. The user's bug may live in the path between the real click event and the handler - your fake click never travels that path."
  REMEDY="Use cmux 'click --selector <css>' or chrome MCP computer left_click with screen coordinates. The cursor moves, the event flows through the real event pipeline, and the handler fires the way a human would invoke it."
fi

# dispatchEvent - synthesizing keyboard/mouse/custom events
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\.dispatchEvent\('; then
  REASON="dispatchEvent synthesizes an event. Humans don't dispatchEvent."
  REMEDY="Use real input: cmux click/type/press, or chrome MCP computer click/type/key."
fi

# Invoking private (underscore-prefixed) methods - skips the public API
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\._[a-zA-Z][a-zA-Z0-9_]*\s*\('; then
  REASON="Invoking a private (_underscore-prefixed) method via JS bypasses the user-facing flow that would normally fire it. The bug you're trying to verify may sit in the flow you just skipped."
  REMEDY="Drive the UI through real input (cmux click/type/press, chrome MCP computer). The private method should fire as a downstream consequence of the user's action, not as a direct invocation."
fi

# Calling methods on a known application namespace (improv-specific for now;
# add others as the codebase grows). The pattern: <namespace>.method(...).
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '(window\.)?__improv\.[a-zA-Z_][a-zA-Z0-9_]*\s*\('; then
  REASON="Invoking a method on the application namespace (__improv) skips the user-facing path. The very state transitions you want to verify are now triggered by you, not by the UI."
  REMEDY="Open the page, click/type like a user, and let the application call its own methods. Then screenshot to verify the visible result."
fi

# Direct mutation of application data via push/splice/etc. on what looks like
# an application array. Triggered when the array reference is reached via a
# property chain that includes an underscore-prefixed segment (e.g.
# pm._changeQueue.push(...)) - same private-API signature as above.
if [ -z "$REASON" ] && echo "$JS_CODE" | grep -qE '\._[a-zA-Z][a-zA-Z0-9_]*\.(push|splice|shift|unshift|pop)\s*\('; then
  REASON="Mutating a private application array (._foo.push/splice/...) writes state without going through the event flow. A user can't do this; their input has to cause it."
  REMEDY="Perform the user action that would cause this mutation (click a button, submit a form). If no user action causes this mutation, you're testing dead code."
fi

# Feature-detection override: if the eval ONLY does capability detection
# (typeof / CSS.supports / 'feat' in window / navigator.userAgent / matchMedia)
# AND no current pattern flagged it, treat as allowed. This is a defense in case
# a future blocklist regex accidentally catches a benign feature-detection expression -
# the early-exit prevents false positives without weakening the actual blocklist.
if [ "$FEATURE_DETECT" = true ] && [ -z "$REASON" ]; then
  echo '{}'
  exit 0
fi

if [ -n "$REASON" ]; then
  MSG="BLOCKED: $REASON Humans don't open DevTools to validate your work. $REMEDY Read-only feature detection (typeof, CSS.supports, 'feat' in window, navigator.userAgent, window.matchMedia) is allowed if the eval does only that."
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$MSG"
else
  echo '{}'
fi

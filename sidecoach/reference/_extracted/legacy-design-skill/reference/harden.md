# Impeccable harden.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

Designs that only work with perfect data aren't production-ready. Harden the interface against the inputs, errors, languages, and network conditions that real users will throw at it.

## Assess Hardening Needs

Identify weaknesses and edge cases:

1. **Test with extreme inputs**:
   - Very long text (names, descriptions, titles)
   - Very short text (empty, single character)
   - Special characters (emoji, RTL text, accents)
   - Large numbers (millions, billions)
   - Many items (1000+ list items, 50+ options)
   - No data (empty states)

2. **Test error scenarios**:
   - Network failures (offline, slow, timeout)
   - API errors (400, 401, 403, 404, 500)
   - Validation errors
   - Permission errors
   - Rate limiting
   - Concurrent operations

3. **Test internationalization**:
   - Long translations (German is often 30% longer than English)
   - RTL languages (Arabic, Hebrew)
   - Character sets (Chinese, Japanese, Korean, emoji)
   - Date/time formats
   - Number formats (1,000 vs 1.000)
   - Currency symbols

**CRITICAL**: Designs that only work with perfect data aren't production-ready. Harden against reality.

## Hardening Dimensions

Systematically improve resilience:

### Text Overflow & Wrapping

**Long text handling**:
```css
/* Single line with ellipsis */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Multi-line with clamp */
.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Allow wrapping */
.wrap {
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}
```

**Flex/Grid overflow**:
```css
/* Prevent flex items from overflowing */
.flex-item {
  min-width: 0; /* Allow shrinking below content size */
  overflow: hidden;
}

/* Prevent grid items from overflowing */
.grid-item {
  min-width: 0;
  min-height: 0;
}
```

**Responsive text sizing**:
- Use `clamp()` for fluid typography
- Set minimum readable sizes (14px on mobile)
- Test text scaling (zoom to 200%)
- Ensure containers expand with text

### Internationalization (i18n)

**Text expansion**:
- Add 30-40% space budget for translations
- Use flexbox/grid that adapts to content
- Test with longest language (usually German)
- Avoid fixed widths on text containers

```jsx
// Bad: Assumes short English text
<button className="w-24">Submit</button>

// Good: Adapts to content
<button className="px-4 py-2">Submit</button>
```

**RTL (Right-to-Left) support**:
```css
/* Use logical properties */
margin-inline-start: 1rem; /* Not margin-left */
padding-inline: 1rem; /* Not padding-left/right */
border-inline-end: 1px solid; /* Not border-right */

/* Or use dir attribute */
[dir="rtl"] .arrow { transform: scaleX(-1); }
```

**Character set support**:
- Use UTF-8 encoding everywhere
- Test with Chinese/Japanese/Korean (CJK) characters
- Test with emoji (they can be 2-4 bytes)
- Handle different scripts (Latin, Cyrillic, Arabic, etc.)

**Date/Time formatting**:
```javascript
// Use Intl API for proper formatting
new Intl.DateTimeFormat('en-US').format(date); // 1/15/2024
new Intl.DateTimeFormat('de-DE').format(date); // 15.1.2024

new Intl.NumberFormat('en-US', { 
  style: 'currency', 
  currency: 'USD' 
}).format(1234.56); // $1,234.56
```

**Pluralization**:
```javascript
// Bad: Assumes English pluralization
`${count} item${count !== 1 ? 's' : ''}`

// Good: Use proper i18n library
t('items', { count }) // Handles complex plural rules
```

### Error Handling

**Network errors**:
- Show clear error messages
- Provide retry button
- Explain what happened
- Offer offline mode (if applicable)
- Handle timeout scenarios

```jsx
// Error states with recovery
{error && (
  <ErrorMessage>
    <p>Failed to load data. {error.message}</p>
    <button onClick={retry}>Try again</button>
  </ErrorMessage>
)}
```

**Form validation errors**:
- Inline errors near fields
- Clear, specific messages
- Suggest corrections
- Don't block submission unnecessarily
- Preserve user input on error

**API errors**:
- Handle each status code appropriately
  - 400: Show validation errors
  - 401: Redirect to login
  - 403: Show permission error
  - 404: Show not found state
  - 429: Show rate limit message
  - 500: Show generic error, offer support

**Graceful degradation**:
- Core functionality works without JavaScript
- Images have alt text
- Progressive enhancement
- Fallbacks for unsupported features

### Edge Cases & Boundary Conditions

**Empty states**:
- No items in list
- No search results
- No notifications
- No data to display
- Provide clear next action

**Loading states**:
- Initial load
- Pagination load
- Refresh
- Show what's loading ("Loading your projects...")
- Time estimates for long operations

**Large datasets**:
- Pagination or virtual scrolling
- Search/filter capabilities
- Performance optimization
- Don't load all 10,000 items at once

**Concurrent operations**:
- Prevent double-submission (disable button while loading)
- Handle race conditions
- Optimistic updates with rollback
- Conflict resolution

**Permission states**:
- No permission to view
- No permission to edit
- Read-only mode
- Clear explanation of why

**Browser compatibility**:
- Polyfills for modern features
- Fallbacks for unsupported CSS
- Feature detection (not browser detection)
- Test in target browsers

### Input Validation & Sanitization

**Client-side validation**:
- Required fields
- Format validation (email, phone, URL)
- Length limits
- Pattern matching
- Custom validation rules

**Server-side validation** (always):
- Never trust client-side only
- Validate and sanitize all inputs
- Protect against injection attacks
- Rate limiting

**Constraint handling**:
```html
<!-- Set clear constraints -->
<input 
  type="text"
  maxlength="100"
  pattern="[A-Za-z0-9]+"
  required
  aria-describedby="username-hint"
/>
<small id="username-hint">
  Letters and numbers only, up to 100 characters
</small>
```

### Accessibility Resilience

**Keyboard navigation**:
- All functionality accessible via keyboard
- Logical tab order
- Focus management in modals
- Skip links for long content

**Screen reader support**:
- Proper ARIA labels
- Announce dynamic changes (live regions)
- Descriptive alt text
- Semantic HTML

**Motion sensitivity**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**High contrast mode**:
- Test in Windows high contrast mode
- Don't rely only on color
- Provide alternative visual cues

### Performance Resilience

**Slow connections**:
- Progressive image loading
- Skeleton screens
- Optimistic UI updates
- Offline support (service workers)

**Memory leaks**:
- Clean up event listeners
- Cancel subscriptions
- Clear timers/intervals
- Abort pending requests on unmount

**Throttling & Debouncing**:
```javascript
// Debounce search input
const debouncedSearch = debounce(handleSearch, 300);

// Throttle scroll handler
const throttledScroll = throttle(handleScroll, 100);
```

## Testing Strategies

**Manual testing**:
- Test with extreme data (very long, very short, empty)
- Test in different languages
- Test offline
- Test slow connection (throttle to 3G)
- Test with screen reader
- Test keyboard-only navigation
- Test on old browsers

**Automated testing**:
- Unit tests for edge cases
- Integration tests for error scenarios
- E2E tests for critical paths
- Visual regression tests
- Accessibility tests (axe, WAVE)

**IMPORTANT**: Hardening is about expecting the unexpected. Real users will do things you never imagined.

**NEVER**:
- Assume perfect input (validate everything)
- Ignore internationalization (design for global)
- Leave error messages generic ("Error occurred")
- Forget offline scenarios
- Trust client-side validation alone
- Use fixed widths for text
- Assume English-length text
- Block entire interface when one component errors

## Verify Hardening

Test thoroughly with edge cases:

- **Long text**: Try names with 100+ characters
- **Emoji**: Use emoji in all text fields
- **RTL**: Test with Arabic or Hebrew
- **CJK**: Test with Chinese/Japanese/Korean
- **Network issues**: Disable internet, throttle connection
- **Large datasets**: Test with 1000+ items
- **Concurrent actions**: Click submit 10 times rapidly
- **Errors**: Force API errors, test all error states
- **Empty**: Remove all data, test empty states

When edge cases are covered, hand off to `/impeccable polish` for the final pass.

## EXTENSION

### Edge-input test catalog (specific values)

A canonical bank of edge inputs to paste during testing:

| Class | Value to paste |
|---|---|
| Empty | (empty string) |
| Single char | `a` |
| Whitespace only | `   ` (3 spaces) |
| Very long Latin | `Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (100 a's) |
| Emoji | `Test name with emoji and flag` |
| RTL Hebrew | `שלום עולם, this is mixed RTL` |
| RTL Arabic | `مرحبا بالعالم` |
| CJK | `你好世界 こんにちは 안녕하세요` |
| Special chars | `<script>alert("xss")</script>` |
| Combining accents | `Ź̂̃` (Z with stacked accents) |
| URL | `https://example.com/path?query=1&other=2#hash` |
| Multi-line | `Line 1\nLine 2\nLine 3` |
| Very large number | `999999999999999999` |
| Decimal precision | `0.000000001` |

Test every form input with at least 3 of these (empty, very long, emoji) at minimum.

### API error status code prescribed responses

| Status | What happened | Show user | Recovery |
|---|---|---|---|
| 400 | Bad request | Inline validation errors near the offending fields | Allow correction and retry |
| 401 | Unauthenticated | Redirect to login; preserve user state if possible | Re-auth flow |
| 403 | Forbidden | "You don't have access to this. [Contact admin / request access]" | Action button |
| 404 | Not found | "We couldn't find this [resource]. [Back to list / search]" | Navigation |
| 408 / 504 | Timeout | "This is taking longer than expected. [Retry]" | Retry button |
| 429 | Rate limited | "Too many requests. Try again in [N] seconds." | Wait + auto-retry |
| 500-599 | Server error | "Something went wrong on our end. We're looking into it. [Retry / Contact support]" | Retry + support escape |
| Network error (no response) | Offline / connectivity | "You appear to be offline. [Retry when connected]" | Auto-retry on reconnect |

### i18n expansion budget per language

| Language | Expansion vs English | Implications |
|---|---|---|
| English | baseline | n/a |
| German | +30% | Avoid fixed-width text containers; especially in nav, buttons |
| French | +20% | Some pluralization complexity (1, more) |
| Finnish | +30-40% | Long compound words; allow word-wrap |
| Russian | +10-15% | Cyrillic chars taller; line-height needs slight bump |
| Arabic / Hebrew | similar length, RTL | Mirror layout direction; logical CSS properties |
| Chinese (simplified) | -30% chars but same visual width | Tighter line-height; characters are wider |
| Japanese | similar to Chinese; mixes scripts | Punctuation rendering subtle |
| Korean | similar to Chinese | Hangul width consistent |

Allocate 40% headroom in text containers as default; more for German-heavy markets.

## WHAT'S MISSING

- **No security hardening section.** Mentions "injection attacks" for server side but client-side XSS, CSRF tokens, CSP headers, SRI on third-party scripts not covered.
- **No browser version specifics.** "Test in target browsers" but no policy for which browsers to support (last 2 versions? Safari minimum? IE11?).
- **No offline storage strategy.** Service workers are named but no rule on what to cache, when to invalidate, how to handle conflicts on reconnect.
- **No mobile-app-specific hardening.** Push notifications, deep links, app-state restore, biometric auth - if this is a web app embedded in a native shell, those concerns are missing.
- **No load-testing prescription.** "Test with 1000+ items" but no actual load test harness recommended.
- **No internationalization handover.** Once you've hardened for i18n, who actually translates the strings? Workflow missing.
- **No "your error message is too AI-cute" check.** `clarify.md` covers this, but harden doesn't cross-reference.

#!/usr/bin/env bash
# Mutation controls for the image generation + verification unit (2026-07-29, Jonah).
#
# A passing suite proves nothing about whether its assertions CONSTRAIN anything. For each load-bearing
# behaviour below: verify the mutation ANCHOR exists exactly once (a mutation that silently fails to apply
# produces a fake "not caught" result and is worse than no check at all), apply it, run the suite that is
# supposed to catch it, require a SPECIFIC assertion message in the failure output, revert, and confirm the file
# is byte-identical to where it started.
#
# The thirty mutations map one-to-one onto the claims this unit makes: 1-14 the original claims, 15-26 the
# eight defects the 2026-07-29 Codex review found, 27-30 the two spend holes its RE-review found after that:
#   1  an unverified check can be folded into a verified verdict
#   2  a blank render is accepted
#   3  provenance is not checked, so a placeholder can be laundered as a real render
#   4  contrast gates on the average instead of the worst case
#   5  the paeth predictor is wrong, so decoded pixels are wrong
#   6  an interlaced png is decoded rather than refused
#   7  the fallback chain degrades to the offline placeholder
#   8  a superseded model id is accepted
#   9  an unpriced call gets a fabricated zero cost instead of a refusal
#  10  the per-run budget cap never rejects
#  11  the offline render does not mark itself synthetic
#  12  an unverified asset exits 0 through the verify subcommand
#  13  a failed asset is written into the cache
#  14  a non-verified sketch is offered downstream as a usable reference
#
# Exit codes:
#   0  every mutation was caught by the assertion that is supposed to catch it
#   3  a mutation ANCHOR was missing or ambiguous (the mutation never applied - the result is meaningless)
#   4  a mutation was NOT CAUGHT (an assertion does not actually constrain its behaviour)
#   5  a revert did not restore the original bytes
set -uo pipefail
cd "$(dirname "$0")"

LOG=/tmp/mutation-image.log
declare -i FAILURES=0
declare -i CAUGHT=0

# mutate <name> <file> <suite> <anchor> <replacement> <expected-substring-of-the-failure>
mutate() {
  local name="$1" file="$2" suite="$3" anchor="$4" repl="$5" expect="$6"
  local backup; backup=$(mktemp)
  cp "$file" "$backup"

  # ANCHOR CHECK - exactly one occurrence, or the mutation is not the mutation we think it is.
  local n; n=$(python3 - "$file" "$anchor" <<'PY'
import io,sys
print(io.open(sys.argv[1],encoding='utf-8').read().count(sys.argv[2]))
PY
)
  if [ "$n" != "1" ]; then
    echo "ANCHOR MISSING OR AMBIGUOUS ($n matches) for mutation: $name"
    echo "  file=$file"
    echo "  anchor=<<$anchor>>"
    rm -f "$backup"; exit 3
  fi

  python3 - "$file" "$anchor" "$repl" <<'PY'
import io,sys
p,a,r = sys.argv[1],sys.argv[2],sys.argv[3]
s = io.open(p,encoding='utf-8').read()
io.open(p,'w',encoding='utf-8').write(s.replace(a,r,1))
PY

  # The CLI suite spawns the bin, which loads dist/. A src mutation therefore needs a rebuild to reach it; a
  # bin mutation does not. ts-node suites read src directly and never need one.
  if [ "$suite" = "src/__tests__/image-cli.test.ts" ] && [[ "$file" == src/* ]]; then
    npx tsc >/dev/null 2>&1
  fi

  # Isolated HOME, as scripts/run-tests.ts does, so no warm developer state changes the outcome.
  local iso; iso=$(mktemp -d "${TMPDIR:-/tmp}/sc-mut-img-XXXXXX")
  HOME="$iso" npx ts-node "$suite" >"$LOG" 2>&1
  local rc=$?
  rm -rf "$iso"

  cp "$backup" "$file"
  if ! cmp -s "$backup" "$file"; then
    echo "REVERT FAILED for mutation: $name"
    rm -f "$backup"; exit 5
  fi
  rm -f "$backup"
  if [[ "$file" == src/* ]]; then npx tsc >/dev/null 2>&1; fi

  if [ $rc -eq 0 ]; then
    echo "NOT CAUGHT: $name"
    echo "  the suite still passed with the mutation applied, so nothing constrains this behaviour"
    FAILURES+=1
    return
  fi
  if ! grep -qF "$expect" "$LOG"; then
    echo "CAUGHT BY THE WRONG ASSERTION: $name"
    echo "  expected to see: $expect"
    echo "  actual failure:"; sed -n '1,6p' "$LOG" | sed 's/^/    /'
    FAILURES+=1
    return
  fi
  echo "caught: $name"
  CAUGHT+=1
}

VERIFY=src/image-asset-verify.ts
CODEC=src/image-png-codec.ts
CORE=src/image-generation.ts
BIN=bin/sidecoach-image.js
FLOW=src/flow-handler-design-references.ts

SUITE_VERIFY=src/__tests__/image-asset-verify.test.ts
SUITE_CODEC=src/__tests__/image-png-codec.test.ts
SUITE_CORE=src/__tests__/image-generation.test.ts
SUITE_CLI=src/__tests__/image-cli.test.ts
SUITE_FLOW=src/__tests__/image-flow-lens.test.ts

# 1. The three-value rule: drop the unverified arm of the fold, so unverified silently becomes verified.
mutate "unverified folds into verified" "$VERIFY" "$SUITE_VERIFY" \
  "  if (checks.some((c) => c.status === 'unverified')) return 'unverified';
" \
  "" \
  "an asset with an unverified check can never be verified"

# 2. Blank detection: force the pass branch.
mutate "blank render accepted" "$VERIFY" "$SUITE_VERIFY" \
  "        blankFailures.length === 0" \
  "        true" \
  "an all-white page fails the blank check"

# 3. Provenance: always agree.
mutate "provenance never checked" "$VERIFY" "$SUITE_VERIFY" \
  "  if (synthetic === expectSynthetic) {" \
  "  if (true) {" \
  "a marked placeholder claimed as a real render fails"

# 4. Contrast default: gate on the mean instead of the worst case.
mutate "contrast gates on the average" "$VERIFY" "$SUITE_VERIFY" \
  "            const mode = contract.placement.mode || 'worst';" \
  "            const mode = contract.placement.mode || 'mean';" \
  "white ink over a half-white image fails worst-case contrast"

# 5. Paeth predictor returns the wrong neighbour, so decoded pixels are wrong.
mutate "paeth predictor broken" "$CODEC" "$SUITE_CODEC" \
  "  if (pa <= pb && pa <= pc) return a;" \
  "  if (pa <= pb && pa <= pc) return b;" \
  "filter 4 row 4"

# 6. Interlaced png decoded instead of refused.
mutate "interlaced png not refused" "$CODEC" "$SUITE_CODEC" \
  "  if (interlace !== 0) {" \
  "  if (interlace !== 0 && false) {" \
  "interlaced must refuse, not decode"

# 7. The fallback chain degrades to the placeholder.
mutate "chain falls back to the placeholder" "$CORE" "$SUITE_CORE" \
  "export const AUTO_CHAIN: string[] = ['openai', 'nanobanana'];" \
  "export const AUTO_CHAIN: string[] = ['openai', 'nanobanana', 'offline'];" \
  "the chain NEVER falls back to the offline placeholder"

# 8. Superseded model ids accepted.
mutate "legacy model id accepted" "$CORE" "$SUITE_CORE" \
  "  if (spec.legacyModels.includes(model)) {" \
  "  if (spec.legacyModels.includes(model) && false) {" \
  "gemini-2.5-flash-image is refused as superseded"

# 9. An unpriced call gets a fabricated zero instead of a refusal.
mutate "unpriced call fabricates a zero" "$CORE" "$SUITE_CORE" \
  "      detail: \`no published per-image figure for \${spec.id}/\${req.model} at \${bucket}; operator declared this ceiling\`,
    };
  }
  return null;" \
  "      detail: \`no published per-image figure for \${spec.id}/\${req.model} at \${bucket}; operator declared this ceiling\`,
    };
  }
  return { usd: 0, basis: 'operator-declared', detail: 'mutated' };" \
  "an unpriced call has NO projection rather than a fabricated one"

# 10. The per-run budget cap never rejects. Shaped as a widened threshold rather than an `&& false` because
#     appending `&& false` to the guard makes the block unreachable and TypeScript then loses the narrowing
#     of caps.runUsd, so the suite would fail to COMPILE instead of failing its assertion - a compile error
#     proves nothing about whether the assertion constrains the cap.
mutate "per-run budget cap disabled" "$CORE" "$SUITE_CORE" \
  "  if (typeof caps.runUsd === 'number' && spentThisRun + projection.usd > caps.runUsd + eps) {" \
  "  if (typeof caps.runUsd === 'number' && spentThisRun + projection.usd > caps.runUsd + 1e9) {" \
  "the per-run cap counts what this run already spent"

# 11. The offline render stops marking itself synthetic.
mutate "offline render not marked synthetic" "$CORE" "$SUITE_CORE" \
  "      [SYNTHETIC_MARKER_KEY, 'offline-deterministic']," \
  "      ['sidecoach-not-the-marker', 'offline-deterministic']," \
  "the offline render stamps the synthetic marker into its bytes"

# 12. The verify subcommand stops distinguishing unverified from verified.
mutate "unverified exits 0 through verify" "$BIN" "$SUITE_CLI" \
  "  if (report.verdict === 'failed') return core.EXIT.VERIFY_FAILED;
  if (report.verdict === 'unverified') return core.EXIT.UNVERIFIED;
  return core.EXIT.OK;
}

// ---------------------------------------------------------------------------
// budget" \
  "  if (report.verdict === 'failed') return core.EXIT.VERIFY_FAILED;
  return core.EXIT.OK;
}

// ---------------------------------------------------------------------------
// budget" \
  "an undecodable format is UNVERIFIED with exit 3"

# 13. A failed asset gets written into the cache.
mutate "failed asset cached" "$BIN" "$SUITE_CLI" \
  "  if (report.verdict === 'verified' && useCache && result.cacheKey && !result.cached) {" \
  "  if (useCache && result.cacheKey && !result.cached) {" \
  "a failed asset is NOT cached"

# 14. A non-verified sketch is offered downstream.
mutate "non-verified sketch offered" "$FLOW" "$SUITE_FLOW" \
  "  return outcome !== null && outcome.status === 'verified' && typeof outcome.path === 'string' && outcome.path.length > 0;" \
  "  return outcome !== null && typeof outcome.path === 'string' && outcome.path.length > 0;" \
  "a FAILED plate is never offerable"

# ---------------------------------------------------------------------------
# Mutations 15-26 cover the eight defects the 2026-07-29 Codex review found and the fixes applied for them.
# A fix without a mutation control is a fix nobody can prove still holds.
# ---------------------------------------------------------------------------

# 15. The alpha check goes back to the see-through test, which misses uniform partial opacity.
mutate "opaque check misses uniform half-opacity" "$VERIFY" "$SUITE_VERIFY" \
  "        const hasAlpha = pixels.nonOpaqueFraction > 0;" \
  "        const hasAlpha = pixels.transparentFraction > 0;" \
  "a uniformly half-opaque image FAILS an opaque requirement"

# 16. Chunk CRCs stop being checked.
mutate "chunk crc not checked" "$CODEC" "$SUITE_CODEC" \
  "    if (declaredCrc !== actualCrc) {" \
  "    if (declaredCrc !== actualCrc && false) {" \
  "a chunk whose bytes no longer match its CRC is refused"

# 17. A stream with no IEND is accepted.
mutate "missing IEND accepted" "$CODEC" "$SUITE_CODEC" \
  "  if (!sawIend) return { ok: false, reason: 'missing-iend', detail: 'the chunk stream ended without an IEND chunk' };
" \
  "" \
  "a stream with no IEND is refused"

# 18. The IDAT size check goes back to "at least", accepting trailing pixel bytes.
mutate "trailing pixel bytes accepted" "$CODEC" "$SUITE_CODEC" \
  "  if (raw.length !== (stride + 1) * height) {" \
  "  if (raw.length < (stride + 1) * height) {" \
  "trailing pixel bytes are refused"

# 19. An out-of-range palette index synthesizes black instead of refusing.
mutate "palette index out of range synthesizes pixels" "$CODEC" "$SUITE_CODEC" \
  "          if (idx * 3 + 2 >= p.length) {" \
  "          if (idx * 3 + 2 >= p.length && false) {" \
  "an out-of-range palette index is refused"

# 20. The spec-legal depth table stops being consulted.
mutate "illegal bit depth for the color type accepted" "$CODEC" "$SUITE_CODEC" \
  "  if (!LEGAL_DEPTHS[colorType].includes(bitDepth)) {" \
  "  if (!LEGAL_DEPTHS[colorType].includes(bitDepth) && false) {" \
  "color type 3 at 16 bits is refused"

# 21. The IHDR compression-method field stops being validated.
mutate "undefined ihdr compression method accepted" "$CODEC" "$SUITE_CODEC" \
  "  if (view[26] !== 0) return { ok: false, reason: 'bad-ihdr-fields', detail: \`compression method \${view[26]}, only 0 is defined\` };
" \
  "" \
  "an undefined compression method is refused"

# 22. JPEG segment bounds stop being checked, so dimensions come from bytes outside the segment.
mutate "jpeg reads past its declared segment" "$VERIFY" "$SUITE_VERIFY" \
  "        if (segLen < 2 || pos + 2 + segLen > view.length) return null;" \
  "        if (segLen < 2) return null;" \
  "a jpeg segment that runs past the end of the file yields NO dimensions"

# 23. WebP chunk bounds stop being checked.
mutate "webp reads past its declared chunk" "$VERIFY" "$SUITE_VERIFY" \
  "        if (body + size > view.length) return null;
" \
  "" \
  "a webp chunk claiming more bytes than the file holds yields NO dimensions"

# 24. The spend ledger goes back to being switched off with the asset cache.
# Shaped as a SILENT skip, not a throw: throwing would trip the new untracked-spend guard and the mutation
# would be caught by the wrong assertion. The hole being reintroduced here is "the ledger is quietly not
# written under --no-cache", which is exactly what the original defect was.
mutate "ledger skipped under --no-cache" "$BIN" "$SUITE_CLI" \
  "        appendLedger(cacheDir, {" \
  "        if (useCache) appendLedger(cacheDir, {" \
  "a --no-cache run STILL records its spend in the ledger"

# 25. The post-call overrun check is removed, so a measured cost above the cap reports a clean success.
mutate "measured overrun not reported" "$BIN" "$SUITE_CLI" \
  "      const overrun = core.budgetCheck(result.cost, caps, spentBeforeThisCall, ledger);" \
  "      const overrun = null;" \
  "a measured cost above the cap exits 7"

# 26. An unmeasured cost is filed under the projection basis, where it reads as a measurement.
mutate "unmetered cost mislabelled" "$BIN" "$SUITE_CLI" \
  "          basis: 'unmetered-projection'," \
  "          basis: projection.basis," \
  "an unmeasured cost is labelled unmetered-projection"

# ---------------------------------------------------------------------------
# Mutations 27-30 cover the two remaining spend holes the Codex RE-review found after the first fix wave.
# ---------------------------------------------------------------------------

# 27. An unreadable ledger stops blocking a cumulative cap, so the cap is evaluated against zero prior spend.
mutate "cumulative cap runs on an unreadable ledger" "$BIN" "$SUITE_CLI" \
  "      if (read.status === 'unreadable' && typeof caps.totalUsd === 'number') {" \
  "      if (read.status === 'unreadable' && typeof caps.totalUsd === 'number' && false) {" \
  "a cumulative cap over an unreadable ledger refuses to spend"

# 28. An unreadable ledger is overwritten instead of moved aside, destroying whatever record it held.
mutate "unreadable ledger overwritten" "$BIN" "$SUITE_CLI" \
  "    const moved = quarantineLedger(cacheDir);" \
  "    const moved = 'mutated: not quarantined';" \
  "the unreadable ledger was quarantined, not destroyed"

# 29. A failed ledger write goes back to being a warning, so untracked spend exits 0.
mutate "untracked spend downgraded to a warning" "$BIN" "$SUITE_CLI" \
  "        result.ledgerWriteFailed = err && err.message ? err.message : String(err);" \
  "        result.ledgerWriteFailed = null;" \
  "spend that could not be recorded exits 9"

# 30. An issued-and-failed request leaves no trace.
mutate "failed request leaves no trace" "$BIN" "$SUITE_CLI" \
  "          appendAttempt(cacheDir, {" \
  "          if (false) appendAttempt(cacheDir, {" \
  "but the issued-and-failed request IS recorded"

echo ""
echo "mutation-check-image: $CAUGHT caught, $FAILURES uncaught-or-miscaught"
if [ $FAILURES -gt 0 ]; then exit 4; fi
echo "mutation-check-image: OK - every mutation was caught by the assertion that is supposed to catch it"

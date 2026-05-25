#!/usr/bin/env node

/**
 * Sidecoach Taste Check
 *
 * CLI wrapper around validateTaste() - inspects an HTML file (optionally with
 * an external CSS file) for structural taste failures that the 159-rule
 * extended-domain-validator does not catch (fabricated SVGs, translateY hovers,
 * inline-style bloat, hero radial blobs, hex literals in interactive states,
 * border-radius inconsistency).
 *
 * Exit codes:
 *   0 = no violations
 *   1 = one or more violations
 *   2 = usage / IO error
 */

const fs = require('fs');
const path = require('path');

let validateTaste;
let formatViolations;
try {
  ({ validateTaste, formatViolations } = require('../dist/taste-validator'));
} catch (err) {
  console.error(
    'taste-check: failed to load ../dist/taste-validator. Run `npm run build` in sidecoach/ first.\n'
  );
  console.error(err.message);
  process.exit(2);
}

function usage() {
  console.error('Usage: sidecoach-taste-check <html-file> [css-file]');
  console.error('');
  console.error('  <html-file>  Required. Path to HTML file to inspect.');
  console.error('  [css-file]   Optional. External stylesheet to inspect alongside inline styles.');
  console.error('');
  console.error('Exits 0 if no violations, 1 if any violations, 2 on usage / IO error.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    usage();
    process.exit(args.length === 0 ? 2 : 0);
  }

  const htmlPath = path.resolve(args[0]);
  const cssPath = args[1] ? path.resolve(args[1]) : undefined;

  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (err) {
    console.error(`taste-check: cannot read HTML file: ${htmlPath}`);
    console.error(err.message);
    process.exit(2);
  }

  let css;
  if (cssPath) {
    try {
      css = fs.readFileSync(cssPath, 'utf8');
    } catch (err) {
      console.error(`taste-check: cannot read CSS file: ${cssPath}`);
      console.error(err.message);
      process.exit(2);
    }
  }

  const violations = validateTaste(html, css);
  console.log(formatViolations(violations, htmlPath));
  process.exit(violations.length === 0 ? 0 : 1);
}

main();

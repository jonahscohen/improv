import { detectTechStack } from '../project-context';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sprint3-stack-'));
}

(() => {
  // Angular detection: angular.json at root
  const angularDir = makeTmpDir();
  fs.writeFileSync(path.join(angularDir, 'angular.json'), '{"projects":{}}');
  assertEq(detectTechStack(angularDir).framework, 'angular', 'angular.json detects as angular');

  // WordPress detection via wp-config.php
  const wpDir = makeTmpDir();
  fs.writeFileSync(path.join(wpDir, 'wp-config.php'), '<?php // WP config\n');
  assertEq(detectTechStack(wpDir).framework, 'wordpress', 'wp-config.php detects as wordpress');

  // WordPress detection via style.css with theme header
  const wpThemeDir = makeTmpDir();
  fs.writeFileSync(
    path.join(wpThemeDir, 'style.css'),
    '/*\nTheme Name: Yes And Theme\nAuthor: Yes And\n*/\n'
  );
  assertEq(detectTechStack(wpThemeDir).framework, 'wordpress', 'style.css with Theme Name detects as wordpress');

  // Drupal detection via composer.json with drupal/* requirement
  const drupalDir = makeTmpDir();
  fs.writeFileSync(
    path.join(drupalDir, 'composer.json'),
    JSON.stringify({ require: { 'drupal/core': '^10.0' } })
  );
  assertEq(detectTechStack(drupalDir).framework, 'drupal', 'composer.json with drupal/core detects as drupal');

  // Drupal detection via top-level *.info.yml
  const drupalInfoDir = makeTmpDir();
  fs.writeFileSync(path.join(drupalInfoDir, 'mymodule.info.yml'), 'name: Test Module\ntype: module\n');
  assertEq(detectTechStack(drupalInfoDir).framework, 'drupal', '*.info.yml detects as drupal');

  // HubSpot detection via theme.json with cms field
  const hubspotDir = makeTmpDir();
  fs.writeFileSync(
    path.join(hubspotDir, 'theme.json'),
    JSON.stringify({ cms: 'hubspot', template_types: ['page'] })
  );
  assertEq(detectTechStack(hubspotDir).framework, 'hubspot', 'theme.json with HubSpot cms field detects as hubspot');

  // HubSpot detection via hubl_modules/ dir
  const hubspotModulesDir = makeTmpDir();
  fs.mkdirSync(path.join(hubspotModulesDir, 'hubl_modules'));
  assertEq(detectTechStack(hubspotModulesDir).framework, 'hubspot', 'hubl_modules/ detects as hubspot');

  // PRIORITY: CMS detection wins over package.json sniff
  const priorityDir = makeTmpDir();
  fs.writeFileSync(path.join(priorityDir, 'wp-config.php'), '<?php\n');
  fs.writeFileSync(
    path.join(priorityDir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^18.0.0' } })
  );
  assertEq(detectTechStack(priorityDir).framework, 'wordpress', 'wp-config.php + react package.json -> wordpress (CMS priority)');

  // PRIORITY: angular.json wins over package.json sniff
  const angularPriorityDir = makeTmpDir();
  fs.writeFileSync(path.join(angularPriorityDir, 'angular.json'), '{}');
  fs.writeFileSync(
    path.join(angularPriorityDir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^18.0.0' } })
  );
  assertEq(detectTechStack(angularPriorityDir).framework, 'angular', 'angular.json + react package.json -> angular');

  // FALLBACK: empty dir returns vanilla (existing behavior preserved)
  const emptyDir = makeTmpDir();
  assertEq(detectTechStack(emptyDir).framework, 'vanilla', 'empty dir -> vanilla fallback');

  // FALLBACK: package.json without CMS marker still detects react
  const reactOnlyDir = makeTmpDir();
  fs.writeFileSync(
    path.join(reactOnlyDir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^18.0.0' } })
  );
  assertEq(detectTechStack(reactOnlyDir).framework, 'react', 'package.json with react and no CMS -> react');

  console.log('sprint3-motion-stack-detection PASS');
})();

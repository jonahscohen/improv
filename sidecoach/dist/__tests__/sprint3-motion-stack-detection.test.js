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
const project_context_1 = require("../project-context");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
function assertEq(actual, expected, label) {
    if (actual !== expected) {
        console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        process.exit(1);
    }
}
function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'sprint3-stack-'));
}
(() => {
    // Angular detection: angular.json at root
    const angularDir = makeTmpDir();
    fs.writeFileSync(path.join(angularDir, 'angular.json'), '{"projects":{}}');
    assertEq((0, project_context_1.detectTechStack)(angularDir).framework, 'angular', 'angular.json detects as angular');
    // WordPress detection via wp-config.php
    const wpDir = makeTmpDir();
    fs.writeFileSync(path.join(wpDir, 'wp-config.php'), '<?php // WP config\n');
    assertEq((0, project_context_1.detectTechStack)(wpDir).framework, 'wordpress', 'wp-config.php detects as wordpress');
    // WordPress detection via style.css with theme header
    const wpThemeDir = makeTmpDir();
    fs.writeFileSync(path.join(wpThemeDir, 'style.css'), '/*\nTheme Name: Yes And Theme\nAuthor: Yes And\n*/\n');
    assertEq((0, project_context_1.detectTechStack)(wpThemeDir).framework, 'wordpress', 'style.css with Theme Name detects as wordpress');
    // Drupal detection via composer.json with drupal/* requirement
    const drupalDir = makeTmpDir();
    fs.writeFileSync(path.join(drupalDir, 'composer.json'), JSON.stringify({ require: { 'drupal/core': '^10.0' } }));
    assertEq((0, project_context_1.detectTechStack)(drupalDir).framework, 'drupal', 'composer.json with drupal/core detects as drupal');
    // Drupal detection via top-level *.info.yml
    const drupalInfoDir = makeTmpDir();
    fs.writeFileSync(path.join(drupalInfoDir, 'mymodule.info.yml'), 'name: Test Module\ntype: module\n');
    assertEq((0, project_context_1.detectTechStack)(drupalInfoDir).framework, 'drupal', '*.info.yml detects as drupal');
    // HubSpot detection via theme.json with cms field
    const hubspotDir = makeTmpDir();
    fs.writeFileSync(path.join(hubspotDir, 'theme.json'), JSON.stringify({ cms: 'hubspot', template_types: ['page'] }));
    assertEq((0, project_context_1.detectTechStack)(hubspotDir).framework, 'hubspot', 'theme.json with HubSpot cms field detects as hubspot');
    // HubSpot detection via hubl_modules/ dir
    const hubspotModulesDir = makeTmpDir();
    fs.mkdirSync(path.join(hubspotModulesDir, 'hubl_modules'));
    assertEq((0, project_context_1.detectTechStack)(hubspotModulesDir).framework, 'hubspot', 'hubl_modules/ detects as hubspot');
    // PRIORITY: CMS detection wins over package.json sniff
    const priorityDir = makeTmpDir();
    fs.writeFileSync(path.join(priorityDir, 'wp-config.php'), '<?php\n');
    fs.writeFileSync(path.join(priorityDir, 'package.json'), JSON.stringify({ dependencies: { react: '^18.0.0' } }));
    assertEq((0, project_context_1.detectTechStack)(priorityDir).framework, 'wordpress', 'wp-config.php + react package.json -> wordpress (CMS priority)');
    // PRIORITY: angular.json wins over package.json sniff
    const angularPriorityDir = makeTmpDir();
    fs.writeFileSync(path.join(angularPriorityDir, 'angular.json'), '{}');
    fs.writeFileSync(path.join(angularPriorityDir, 'package.json'), JSON.stringify({ dependencies: { react: '^18.0.0' } }));
    assertEq((0, project_context_1.detectTechStack)(angularPriorityDir).framework, 'angular', 'angular.json + react package.json -> angular');
    // FALLBACK: empty dir returns vanilla (existing behavior preserved)
    const emptyDir = makeTmpDir();
    assertEq((0, project_context_1.detectTechStack)(emptyDir).framework, 'vanilla', 'empty dir -> vanilla fallback');
    // FALLBACK: package.json without CMS marker still detects react
    const reactOnlyDir = makeTmpDir();
    fs.writeFileSync(path.join(reactOnlyDir, 'package.json'), JSON.stringify({ dependencies: { react: '^18.0.0' } }));
    assertEq((0, project_context_1.detectTechStack)(reactOnlyDir).framework, 'react', 'package.json with react and no CMS -> react');
    console.log('sprint3-motion-stack-detection PASS');
})();
//# sourceMappingURL=sprint3-motion-stack-detection.test.js.map
import * as fs from 'fs';
import * as path from 'path';
import type { FlowExecutionContext, FlowExecutionResult } from './flow-handler';

interface ExtractedTokens {
  colors: Map<string, string>;
  fontFamilies: Set<string>;
  fontSizes: Set<string>;
  lineHeights: Set<string>;
  spacingValues: Set<string>;
}

export class DocumentCommandHandler {
  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const projectPath = context.projectPath || process.cwd();
    const designPath = path.join(projectPath, 'DESIGN.md');

    const tokens = this.scanProject(projectPath);
    const content = this.renderDesignMd(tokens);
    fs.writeFileSync(designPath, content, 'utf-8');

    return {
      flowId: 'document' as any,
      flowName: 'Sidecoach Document',
      status: 'success',
      message: `DESIGN.md written to ${designPath} from project HTML/CSS scan.`,
      guidance: [
        `Scanned ${projectPath}`,
        `Extracted ${tokens.colors.size} colors, ${tokens.fontFamilies.size} font families, ${tokens.fontSizes.size} font sizes, ${tokens.spacingValues.size} spacing values.`,
        'Output follows the Google design.md spec: YAML frontmatter for tokens, markdown sections for prose.',
      ],
      checklist: [
        { id: 'colors', label: 'Colors extracted', required: true, completed: tokens.colors.size > 0 } as any,
        { id: 'typography', label: 'Typography extracted', required: true, completed: tokens.fontFamilies.size > 0 || tokens.fontSizes.size > 0 } as any,
        { id: 'spacing', label: 'Spacing extracted', required: true, completed: tokens.spacingValues.size > 0 } as any,
        { id: 'sections', label: 'Required sections present', required: true, completed: true } as any,
      ],
      artifacts: [
        { type: 'reference', name: 'DESIGN.md', content },
      ],
    };
  }

  private scanProject(projectPath: string): ExtractedTokens {
    const tokens: ExtractedTokens = {
      colors: new Map(),
      fontFamilies: new Set(),
      fontSizes: new Set(),
      lineHeights: new Set(),
      spacingValues: new Set(),
    };

    const cssFiles = this.findFiles(projectPath, /\.css$/i, 3);
    for (const file of cssFiles) {
      const css = fs.readFileSync(file, 'utf-8');

      // CSS custom property color tokens
      for (const m of css.matchAll(/--(?:color|c)-([\w-]+):\s*(#[0-9a-f]{3,8}|rgb\([^)]+\)|hsl\([^)]+\))/gi)) {
        tokens.colors.set(m[1], m[2]);
      }

      // Standalone hex colors in declarations
      for (const m of css.matchAll(/#[0-9a-f]{6}\b/gi)) {
        const hex = m[0];
        if (!Array.from(tokens.colors.values()).includes(hex)) {
          tokens.colors.set(`color-${tokens.colors.size + 1}`, hex);
        }
      }

      // font-family declarations
      for (const m of css.matchAll(/font-family:\s*([^;]+);/gi)) {
        const families = m[1].split(',').map(f => f.trim().replace(/^['"]|['"]$/g, ''));
        families.forEach(f => { if (f && !f.toLowerCase().includes('sans-serif') && !f.toLowerCase().includes('serif')) tokens.fontFamilies.add(f); });
      }

      // font-size and line-height
      for (const m of css.matchAll(/font-size:\s*([^;]+);/gi)) {
        tokens.fontSizes.add(m[1].trim());
      }
      for (const m of css.matchAll(/line-height:\s*([^;]+);/gi)) {
        tokens.lineHeights.add(m[1].trim());
      }

      // Spacing custom properties
      for (const m of css.matchAll(/--(?:space|spacing|s)-([\w-]+):\s*([^;]+);/gi)) {
        tokens.spacingValues.add(m[2].trim());
      }
    }

    return tokens;
  }

  private findFiles(root: string, pattern: RegExp, maxDepth: number): string[] {
    const out: string[] = [];
    const walk = (dir: string, depth: number) => {
      if (depth > maxDepth) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, depth + 1);
        else if (entry.isFile() && pattern.test(entry.name)) out.push(full);
      }
    };
    walk(root, 0);
    return out;
  }

  private renderDesignMd(t: ExtractedTokens): string {
    const lines: string[] = [];

    // YAML frontmatter
    lines.push('---');
    lines.push('colors:');
    for (const [name, value] of t.colors.entries()) {
      lines.push(`  ${name}: "${value}"`);
    }
    lines.push('typography:');
    lines.push('  families:');
    for (const f of t.fontFamilies) {
      lines.push(`    - "${f}"`);
    }
    if (t.fontSizes.size > 0) {
      lines.push('  sizes:');
      for (const s of t.fontSizes) {
        lines.push(`    - "${s}"`);
      }
    }
    lines.push('spacing:');
    let i = 1;
    for (const s of t.spacingValues) {
      lines.push(`  step-${i++}: "${s}"`);
    }
    lines.push('---');
    lines.push('');

    // Body sections per Google spec canonical order
    lines.push('# Overview');
    lines.push('');
    lines.push('Design tokens extracted from project HTML/CSS. Use these tokens consistently in generated UI.');
    lines.push('');

    lines.push('# Colors');
    lines.push('');
    if (t.colors.size === 0) {
      lines.push('No color tokens detected.');
    } else {
      for (const [name, value] of t.colors.entries()) {
        lines.push(`- **${name}**: \`${value}\``);
      }
    }
    lines.push('');

    lines.push('# Typography');
    lines.push('');
    if (t.fontFamilies.size > 0) {
      lines.push('**Families:**');
      for (const f of t.fontFamilies) {
        lines.push(`- ${f}`);
      }
    }
    if (t.fontSizes.size > 0) {
      lines.push('');
      lines.push('**Sizes:**');
      for (const s of t.fontSizes) {
        lines.push(`- ${s}`);
      }
    }
    lines.push('');

    lines.push('# Layout');
    lines.push('');
    if (t.spacingValues.size > 0) {
      lines.push('**Spacing scale:**');
      for (const s of t.spacingValues) {
        lines.push(`- ${s}`);
      }
    } else {
      lines.push('No spacing tokens detected.');
    }
    lines.push('');

    lines.push('# Elevation');
    lines.push('');
    lines.push('No elevation tokens auto-detected. Add manually if the design system defines them.');
    lines.push('');

    lines.push('# Shapes');
    lines.push('');
    lines.push('No shape tokens auto-detected. Add border-radius and other shape values manually.');
    lines.push('');

    lines.push('# Components');
    lines.push('');
    lines.push('Component inventory should be added here as components stabilize.');
    lines.push('');

    lines.push("# Do's and Don'ts");
    lines.push('');
    lines.push("Add project-specific do's and don'ts based on the brand or product register.");
    lines.push('');

    return lines.join('\n');
  }
}

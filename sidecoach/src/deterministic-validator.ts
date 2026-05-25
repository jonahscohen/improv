import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { FlowId } from './types';
import { FlowExecutionContext } from './flow-handler';
import { FlowHistory } from './flow-history';

export interface ValidationViolation {
  rule: string;
  severity: 'blocking' | 'warning';
  message: string;
  fix?: string;
  debtCandidate?: {
    description: string;
    justification: string;
    dueWhen: string;
    estimatedCost: 'low' | 'medium' | 'high';
  };
}

export interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  message: string;
}

export class DeterministicValidator {
  validate(flowId: FlowId, context: FlowExecutionContext, history: FlowHistory): ValidationResult {
    const violations: ValidationViolation[] = [];
    const projectPath = context.projectPath || process.cwd();

    // Gate 1: All flows require PRODUCT.md with content >200 chars
    const productMdPath = path.join(projectPath, 'PRODUCT.md');
    if (!fs.existsSync(productMdPath)) {
      violations.push({
        rule: 'PRODUCT.md_exists',
        severity: 'blocking',
        message: 'PRODUCT.md not found at project root',
        fix: 'Run `/sidecoach teach` to generate PRODUCT.md with project context',
        debtCandidate: {
          description: 'Missing PRODUCT.md - project context required',
          justification: 'Auto-detected blocking prerequisite',
          dueWhen: 'before_next_design_flow',
          estimatedCost: 'medium',
        },
      });
    } else {
      const content = fs.readFileSync(productMdPath, 'utf-8');
      if (content.length < 200) {
        violations.push({
          rule: 'PRODUCT.md_content_length',
          severity: 'blocking',
          message: `PRODUCT.md exists but is incomplete (${content.length} chars, need >200)`,
          fix: 'Run `/sidecoach teach` to complete PRODUCT.md with brand, users, anti-references',
          debtCandidate: {
            description: 'PRODUCT.md stub - needs completion',
            justification: 'Auto-detected incomplete prerequisite',
            dueWhen: 'before_next_design_flow',
            estimatedCost: 'medium',
          },
        });
      }
    }

    // Gate 2: Tier 2+ flows (flowF onward) require DESIGN.md with required sections
    const tier2FlowIds = [
      'flowF_design_tokens',
      'flowG_component_implementation',
      'flowH_motion_integration',
      'flowI_accessibility',
      'flowJ_tactical_polish',
      'flowK_multi_lens_audit',
      'flowL_design_critique',
      'flowM_responsive_validation',
      'flowN_rapid_iteration_refined',
      'flowR_layout_optimization',
      'flowS_typography_excellence',
      'flowT_ambitious_motion',
    ];

    if (tier2FlowIds.includes(flowId)) {
      const designMdPath = path.join(projectPath, 'DESIGN.md');
      if (!fs.existsSync(designMdPath)) {
        violations.push({
          rule: 'DESIGN.md_exists',
          severity: 'blocking',
          message: 'DESIGN.md not found - required for implementation flows',
          fix: 'Run `/sidecoach document` to extract current design system',
          debtCandidate: {
            description: 'Missing DESIGN.md - design tokens required',
            justification: 'Auto-detected blocking prerequisite for implementation tier',
            dueWhen: 'before_tier2_flows',
            estimatedCost: 'high',
          },
        });
      } else {
        // Check for required YAML sections in DESIGN.md
        const designContent = fs.readFileSync(designMdPath, 'utf-8');
        const requiredSections = ['colors', 'typography', 'spacing'];
        const missingFrontmatterSections: string[] = [];

        // Simple check: look for yaml keys in frontmatter
        const frontmatterMatch = designContent.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          for (const section of requiredSections) {
            if (!frontmatter.includes(section)) {
              missingFrontmatterSections.push(section);
            }
          }
        }

        if (missingFrontmatterSections.length > 0) {
          violations.push({
            rule: 'DESIGN.md_sections',
            severity: 'blocking',
            message: `DESIGN.md missing required sections: ${missingFrontmatterSections.join(', ')}`,
            fix: `Update DESIGN.md frontmatter to include: ${missingFrontmatterSections.join(', ')}`,
            debtCandidate: {
              description: `DESIGN.md incomplete - missing sections: ${missingFrontmatterSections.join(', ')}`,
              justification: 'Auto-detected incomplete design tokens',
              dueWhen: 'before_implementation',
              estimatedCost: 'medium',
            },
          });
        }

        // Gate 3: DESIGN.md lint passes (with timeout + graceful degradation)
        try {
          execFileSync('npx', ['@google/design.md', 'lint', designMdPath], {
            timeout: 10000,
            stdio: 'pipe',
            cwd: projectPath,
          });
        } catch (error) {
          // Inspect both error.message and any captured stdout (the lint tool
          // returns JSON findings on stdout AND exits non-zero on errors).
          const errMsg = error instanceof Error ? error.message : String(error);
          const stdoutStr = (error as any)?.stdout ? String((error as any).stdout) : '';
          const stderrStr = (error as any)?.stderr ? String((error as any).stderr) : '';
          const combined = `${errMsg}\n${stdoutStr}\n${stderrStr}`;

          const isTimeout = combined.includes('timed out') || combined.includes('ETIMEDOUT');
          const isToolMissing = combined.includes('not found') || combined.includes('ENOENT');
          // Tool-internal errors: the lint tool itself crashed (e.g. parser bug,
          // not a content issue with the user's DESIGN.md). Degrade to warning
          // so the validator doesn't block flow execution on third-party tool bugs.
          const isToolInternalError =
            combined.includes('Unexpected error during model building') ||
            combined.includes('raw.match is not a function');

          if (isToolMissing) {
            // Tool not installed - degrade to warning
            violations.push({
              rule: 'DESIGN.md_lint_unavailable',
              severity: 'warning',
              message: '@google/design.md lint tool not available',
              fix: 'npm install @google/design.md to enable design validation',
            });
          } else if (isTimeout) {
            // Timeout - degrade to warning
            violations.push({
              rule: 'DESIGN.md_lint_timeout',
              severity: 'warning',
              message: 'Design.md lint check timed out (>10s)',
              fix: 'Reduce complexity of DESIGN.md or increase timeout',
            });
          } else if (isToolInternalError) {
            // Tool itself crashed (not a content issue) - degrade to warning
            violations.push({
              rule: 'DESIGN.md_lint_tool_error',
              severity: 'warning',
              message: 'Design.md lint tool crashed internally - cannot validate content',
              fix: 'File issue against @google/design.md; falling back to flow execution',
            });
          } else {
            // Actual lint failure - blocking
            violations.push({
              rule: 'DESIGN.md_lint_failed',
              severity: 'blocking',
              message: 'DESIGN.md lint check failed',
              fix: 'Run `npx @google/design.md lint DESIGN.md` to see errors',
              debtCandidate: {
                description: 'DESIGN.md lint errors - design tokens invalid',
                justification: 'Auto-detected validation failure',
                dueWhen: 'before_implementation',
                estimatedCost: 'medium',
              },
            });
          }
        }
      }
    }

    // Gate 4: Tier 3 (polish/QA) flows require at least one Tier 2 flow to have succeeded
    const tier3FlowIds = [
      'flowJ_tactical_polish',
      'flowK_multi_lens_audit',
      'flowL_design_critique',
      'flowM_responsive_validation',
      'flowN_rapid_iteration_refined',
    ];

    if (tier3FlowIds.includes(flowId)) {
      const tier2Flows = [
        'flowF_design_tokens',
        'flowG_component_implementation',
        'flowH_motion_integration',
        'flowI_accessibility',
      ];

      const tier2Succeeded = tier2Flows.some((f) => {
        const run = history.getLatestRun(f);
        return run && run.status === 'success';
      });

      if (!tier2Succeeded) {
        violations.push({
          rule: 'Tier2_flow_required',
          severity: 'blocking',
          message: `Tier 3 (polish/QA) flows require at least one Tier 2 (execution) flow to complete first`,
          fix: 'Run one of: flowF, flowG, flowH, flowI before this flow',
          debtCandidate: {
            description: 'Tier 3 flow attempted without Tier 2 execution',
            justification: 'Auto-detected phase sequence violation',
            dueWhen: 'enforce_phase_order',
            estimatedCost: 'low',
          },
        });
      }
    }

    // Gate 5: Tier 4/5 (specialized) flows require at least one Tier 3 flow to have succeeded
    const tier45FlowIds = [
      'flowQ_migration_special',
      'flowR_layout_optimization',
      'flowS_typography_excellence',
      'flowT_ambitious_motion',
    ];

    if (tier45FlowIds.includes(flowId)) {
      const tier3Flows = [
        'flowJ_tactical_polish',
        'flowK_multi_lens_audit',
        'flowL_design_critique',
        'flowM_responsive_validation',
        'flowN_rapid_iteration_refined',
        'flowO_clone_match_special',
        'flowP_constraint_design_special',
      ];

      const tier3Succeeded = tier3Flows.some((f) => {
        const run = history.getLatestRun(f);
        return run && run.status === 'success';
      });

      if (!tier3Succeeded) {
        violations.push({
          rule: 'Tier3_flow_required_for_Tier45',
          severity: 'blocking',
          message: `Tier 4/5 (specialized) flows require at least one Tier 3 (polish/QA) flow to complete first`,
          fix: 'Run one of: flowJ, flowK, flowL, flowM, flowN, flowO, flowP before this flow',
          debtCandidate: {
            description: 'Tier 4/5 flow attempted without Tier 3 completion',
            justification: 'Auto-detected phase sequence violation',
            dueWhen: 'enforce_phase_order',
            estimatedCost: 'low',
          },
        });
      }
    }

    // Gate 6: Motion flows (flowE, flowH, flowT) require GSAP or Lenis in package.json
    const motionFlowIds = ['flowE_motion_patterns', 'flowH_motion_integration', 'flowT_ambitious_motion'];

    if (motionFlowIds.includes(flowId)) {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
          const hasGsap = 'gsap' in deps;
          const hasLenis = 'lenis' in deps;

          if (!hasGsap && !hasLenis) {
            violations.push({
              rule: 'motion_library_required',
              severity: 'blocking',
              message: 'Motion flows require GSAP or Lenis in package.json',
              fix: 'npm install gsap (recommended) or lenis',
              debtCandidate: {
                description: 'Missing motion library dependency',
                justification: 'Auto-detected missing implementation dependency',
                dueWhen: 'before_motion_flows',
                estimatedCost: 'low',
              },
            });
          }
        } catch (error) {
          violations.push({
            rule: 'package_json_parse_error',
            severity: 'warning',
            message: 'Could not parse package.json',
            fix: 'Fix package.json syntax errors',
          });
        }
      }
    }

    // Determine overall validity
    const hasBlocking = violations.some((v) => v.severity === 'blocking');
    const valid = !hasBlocking;

    // Generate summary message
    const blockingCount = violations.filter((v) => v.severity === 'blocking').length;
    const warningCount = violations.filter((v) => v.severity === 'warning').length;

    let message = 'Validation ';
    if (valid) {
      message += 'passed';
      if (warningCount > 0) {
        message += ` (${warningCount} warning${warningCount > 1 ? 's' : ''})`;
      }
    } else {
      message += `failed: ${blockingCount} blocking issue${blockingCount > 1 ? 's' : ''}`;
      if (warningCount > 0) {
        message += `, ${warningCount} warning${warningCount > 1 ? 's' : ''}`;
      }
    }

    return { valid, violations, message };
  }
}

export function createValidator(): DeterministicValidator {
  return new DeterministicValidator();
}

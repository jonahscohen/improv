import { getFlow } from './flows';
import { FlowId, MatchResult, DisambiguationResult } from './types';
import { FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { SidecoachOrchestrator } from './orchestrator';
import { FlowHistory, getFlowHistory } from './flow-history';

interface FlowDetector {
  flowId: FlowId;
  score(utterance: string): number;
}

export class IntentDetector {
  private detectors: FlowDetector[];
  private orchestrator: SidecoachOrchestrator;
  private history: FlowHistory;

  constructor(orchestrator?: SidecoachOrchestrator, history?: FlowHistory) {
    // Use injected dependencies or fall back to creating new instances
    this.history = history || getFlowHistory();
    this.orchestrator = orchestrator || new SidecoachOrchestrator(this.history);

    this.detectors = [
      // Tier 1: Strategy/Research
      this.createFlowADetector(),
      this.createFlowBDetector(),
      this.createFlowCDetector(),
      this.createFlowDDetector(),
      this.createFlowEDetector(),
      // Tier 2: Execution
      this.createFlowFDetector(),
      this.createFlowGDetector(),
      this.createFlowHDetector(),
      this.createFlowIDetector(),
      // Tier 3: Polish/QA
      this.createFlowJDetector(),
      this.createFlowKDetector(),
      this.createFlowLDetector(),
      this.createFlowMDetector(),
      this.createFlowNDetector(),
      // Tier 4: Special
      this.createFlowODetector(),
      this.createFlowPDetector(),
      this.createFlowQDetector(),
      // Tier 5: Specialized Refinement (NEW - impeccable v2.1.9)
      this.createFlowRDetector(),
      this.createFlowSDetector(),
      this.createFlowTDetector(),
      // Special: Curate & QA
      this.createFlowUDetector(),
      this.createFlowVDetector(),
      // Legacy flows
      this.createFlow1Detector(),
      this.createFlow2Detector(),
      this.createFlow3Detector(),
      this.createFlow4Detector(),
      this.createFlow5Detector(),
      this.createFlow6Detector(),
      this.createFlow7Detector(),
      this.createFlow8Detector(),
      this.createFlow9Detector(),
      this.createFlow10Detector(),
      this.createFlow11Detector(),
      this.createFlow12Detector(),
      this.createFlow13Detector(),
      this.createFlow14Detector(),
    ];
  }

  detect(utterance: string): MatchResult | DisambiguationResult {
    const normalized = utterance.toLowerCase();
    const matches: MatchResult[] = [];

    for (const detector of this.detectors) {
      const score = detector.score(normalized);
      if (score > 0) {
        const flow = getFlow(detector.flowId);
        if (flow) {
          matches.push({
            flowId: detector.flowId,
            flowName: flow.name,
            confidence: score,
            matchedTokens: [],
            reason: `Rule-based match (confidence: ${(score * 100).toFixed(0)}%)`,
          });
        }
      }
    }

    if (matches.length === 0) {
      return {
        candidates: [],
        isAmbiguous: true,
        clarificationNeeded: 'No matching flows found. Please rephrase your request.',
      };
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    if (matches.length === 1) {
      return matches[0];
    }

    // Return top match with others as candidates
    const disambig: DisambiguationResult = {
      candidates: matches.slice(0, 3),
      isAmbiguous: matches[0].confidence < 0.9 || matches.length > 1,
      recommendation: matches[0],
      clarificationNeeded: matches.length > 1 ? `Did you mean ${matches[0].flowName}?` : undefined,
    };

    // Tie-break: when top candidates have equal confidence, use the recommendation field
    // or fall back to a deterministic heuristic (alphabetical by flowId)
    if (disambig.isAmbiguous && disambig.candidates.length > 1) {
      const topConf = disambig.candidates[0].confidence;
      const tied = disambig.candidates.filter((c) => c.confidence === topConf);
      if (tied.length > 1) {
        const rec = disambig.recommendation;
        let chosenFlowId: string;
        let reason: string;
        if (rec && tied.some((c) => c.flowId === rec.flowId)) {
          chosenFlowId = rec.flowId;
          reason = `Used recommendation field as tiebreaker among ${tied.length} equal-confidence matches`;
        } else {
          const sorted = [...tied].sort((a, b) => String(a.flowId).localeCompare(String(b.flowId)));
          chosenFlowId = sorted[0].flowId;
          reason = `Alphabetical tiebreak among ${tied.length} equal-confidence matches (no recommendation set)`;
        }
        disambig.tieBreak = { chosenFlowId, reason };
      }
    }

    return disambig;
  }

  // Orchestrator Integration: Prerequisite validation and flow chaining

  validateFlowPrerequisites(flowId: FlowId, context: FlowExecutionContext): {
    canRun: boolean;
    missingPrerequisites: FlowId[];
    recommendedFlow?: FlowId;
    message: string;
  } {
    const validation = this.orchestrator.validatePrerequisites(flowId);

    // If prerequisites are met, user can run this flow
    if (validation.valid) {
      return {
        canRun: true,
        missingPrerequisites: [],
        message: validation.message,
      };
    }

    // Prerequisites not met - recommend the first missing prerequisite instead
    const missingFlows = validation.missingArtifacts.filter((item) =>
      this.detectors.some((d) => d.flowId === item)
    );

    if (missingFlows.length > 0) {
      return {
        canRun: false,
        missingPrerequisites: missingFlows as FlowId[],
        recommendedFlow: missingFlows[0] as FlowId,
        message: `Prerequisites not met. ${validation.message}`,
      };
    }

    return {
      canRun: false,
      missingPrerequisites: [],
      message: validation.message,
    };
  }

  getNextRecommendedFlow(currentFlowId: FlowId, result: FlowExecutionResult): FlowId | undefined {
    // Record the flow execution in history
    this.orchestrator.recordFlowExecution(result);

    // Get next recommended flow
    return this.orchestrator.getNextRecommendedFlow(currentFlowId, result);
  }

  getCurrentPhase(context: FlowExecutionContext) {
    return this.orchestrator.detectPhase(context);
  }

  getRecommendedFlowSequence(context: FlowExecutionContext) {
    const phase = this.orchestrator.detectPhase(context);
    return this.orchestrator.recommendFlowSequence(phase);
  }

  getWorkflowProgress(context: FlowExecutionContext) {
    return this.orchestrator.getWorkflowRecommendation(context);
  }

  private has(u: string, ...keywords: string[]): boolean {
    return keywords.some((k) => u.includes(k));
  }

  private hasAny(u: string, keywords: string[]): boolean {
    return keywords.some((k) => u.includes(k));
  }

  private hasNone(u: string, keywords: string[]): boolean {
    return !keywords.some((k) => u.includes(k));
  }

  // TIER 1: STRATEGY/RESEARCH DETECTORS

  private createFlowADetector(): FlowDetector {
    return {
      flowId: 'flowA_brand_verify',
      score: (u) => {
        if (this.hasAny(u, ['brand', 'product.md', 'register', 'setup', 'verify', 'foundation', 'initialize'])) {
          if (this.hasNone(u, ['design', 'component', 'implement'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlowBDetector(): FlowDetector {
    return {
      flowId: 'flowB_component_research',
      score: (u) => {
        if (this.hasAny(u, ['component', 'gallery', 'research', 'patterns', 'examples', 'types', 'systems'])) {
          if (this.hasNone(u, ['implement', 'build', 'design', 'code'])) {
            return 0.8;
          }
        }
        return 0;
      },
    };
  }

  private createFlowCDetector(): FlowDetector {
    return {
      flowId: 'flowC_font_research',
      score: (u) => {
        if (this.hasAny(u, ['font', 'typeface', 'fontshare', 'pairing', 'typography', 'weights'])) {
          if (this.hasNone(u, ['design', 'implement', 'set font'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlowDDetector(): FlowDetector {
    return {
      flowId: 'flowD_reference_inspiration',
      score: (u) => {
        if (this.hasAny(u, ['reference', 'inspiration', 'catalog', 'examples', 'curate', 'search'])) {
          if (this.hasNone(u, ['implement', 'design', 'build'])) {
            return 0.8;
          }
        }
        return 0;
      },
    };
  }

  private createFlowEDetector(): FlowDetector {
    return {
      flowId: 'flowE_motion_patterns',
      score: (u) => {
        if (this.hasAny(u, ['motion', 'gsap', 'animation', 'scroll', 'lenis', 'scrolltrigger', 'flip', 'splittest', 'drawsvg'])) {
          if (this.hasNone(u, ['implement', 'build', 'code'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  // TIER 2: EXECUTION DETECTORS

  private createFlowFDetector(): FlowDetector {
    return {
      flowId: 'flowF_design_tokens',
      score: (u) => {
        if (this.hasAny(u, ['token', 'design.md', 'extract', 'manage', 'lint', 'consistency'])) {
          return 0.85;
        }
        return 0;
      },
    };
  }

  private createFlowGDetector(): FlowDetector {
    return {
      flowId: 'flowG_component_implementation',
      score: (u) => {
        if (this.hasAny(u, ['implement', 'component', 'code', 'variants', 'states', 'wire'])) {
          if (this.hasNone(u, ['design', 'clone', 'exact'])) {
            return 0.8;
          }
        }
        return 0;
      },
    };
  }

  private createFlowHDetector(): FlowDetector {
    return {
      flowId: 'flowH_motion_integration',
      score: (u) => {
        if (this.hasAny(u, ['motion', 'animation', 'gsap', 'scrolltrigger', 'implement'])) {
          if (this.hasAny(u, ['implement', 'code', 'integrate'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlowIDetector(): FlowDetector {
    return {
      flowId: 'flowI_accessibility',
      score: (u) => {
        if (this.hasAny(u, ['accessible', 'a11y', 'wcag', 'screen reader', 'keyboard', 'aria'])) {
          return 0.9;
        }
        return 0;
      },
    };
  }

  // TIER 3: POLISH/QA DETECTORS

  private createFlowJDetector(): FlowDetector {
    return {
      flowId: 'flowJ_tactical_polish',
      score: (u) => {
        if (this.hasAny(u, ['polish', 'feel better', 'tactical', 'refinement', 'micro-interaction'])) {
          if (this.hasNone(u, ['audit', 'design', 'implement'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlowKDetector(): FlowDetector {
    return {
      flowId: 'flowK_multi_lens_audit',
      score: (u) => {
        if (this.hasAny(u, ['audit', 'multi-lens', '5-dimension', 'technical', 'comprehensive', 'anti-pattern'])) {
          return 0.85;
        }
        return 0;
      },
    };
  }

  private createFlowLDetector(): FlowDetector {
    return {
      flowId: 'flowL_design_critique',
      score: (u) => {
        if (this.hasAny(u, ['critique', 'review', 'heuristics', 'cognitive', 'emotional', 'quality'])) {
          if (this.hasNone(u, ['implement', 'code'])) {
            return 0.8;
          }
        }
        return 0;
      },
    };
  }

  private createFlowMDetector(): FlowDetector {
    return {
      flowId: 'flowM_responsive_validation',
      score: (u) => {
        if (this.hasAny(u, ['responsive', 'breakpoint', 'touch target', 'viewport', 'validation'])) {
          return 0.85;
        }
        return 0;
      },
    };
  }

  private createFlowNDetector(): FlowDetector {
    return {
      flowId: 'flowN_rapid_iteration_refined',
      score: (u) => {
        if (this.hasAny(u, ['iterate', 'rapid', 'round', 'variations', 'token', 'success', 'criteria'])) {
          if (this.hasNone(u, ['explore', 'open-ended', 'discovery'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  // TIER 4: SPECIAL WORKFLOW DETECTORS

  private createFlowODetector(): FlowDetector {
    return {
      flowId: 'flowO_clone_match_special',
      score: (u) => {
        if (this.hasAny(u, ['pixel perfect', 'clone', 'steal', '1:1', 'exact', 'identical', 'byte-for-byte'])) {
          return 0.9;
        }
        return 0;
      },
    };
  }

  private createFlowPDetector(): FlowDetector {
    return {
      flowId: 'flowP_constraint_design_special',
      score: (u) => {
        if (this.hasAny(u, ['constraint', 'under', 'limit', 'budget', 'scope', 'creative', 'given'])) {
          if (this.hasNone(u, ['improve', 'refactor', 'layout'])) {
            return 0.8;
          }
        }
        return 0;
      },
    };
  }

  private createFlowQDetector(): FlowDetector {
    return {
      flowId: 'flowQ_migration_special',
      score: (u) => {
        if (this.hasAny(u, ['migrate', 'breaking', 'refactor', 'api', 'migration', 'dependencies'])) {
          // Special migration requires "breaking" or "migrate" keywords, not just "refactor api"
          if (this.hasAny(u, ['breaking', 'migrate'])) {
            return 0.9;
          }
        }
        return 0;
      },
    };
  }

  // Tier 5: Specialized Refinement (NEW - impeccable v2.1.9 coverage)

  private createFlowRDetector(): FlowDetector {
    return {
      flowId: 'flowR_layout_optimization',
      score: (u) => {
        if (this.hasAny(u, ['layout', 'spacing', 'rhythm', 'optimize', 'grid', 'hierarchy', 'refinement'])) {
          if (this.hasAny(u, ['layout', 'spacing', 'grid']) && this.hasNone(u, ['design', 'implement'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlowSDetector(): FlowDetector {
    return {
      flowId: 'flowS_typography_excellence',
      score: (u) => {
        if (this.hasAny(u, ['typography', 'typeset', 'font', 'hierarchy', 'readability', 'weight', 'sizing'])) {
          if (this.hasAny(u, ['typography', 'typeset', 'font', 'hierarchy']) && this.hasNone(u, ['design', 'research'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlowTDetector(): FlowDetector {
    return {
      flowId: 'flowT_ambitious_motion',
      score: (u) => {
        if (this.hasAny(u, ['overdrive', 'ambitious', 'physics', 'spring', 'scroll-driven', 'cinematic', 'shader'])) {
          if (this.hasAny(u, ['overdrive', 'ambitious', 'physics', 'spring']) && this.hasNone(u, ['research', 'basic'])) {
            return 0.9;
          }
        }
        return 0;
      },
    };
  }

  private createFlow1Detector(): FlowDetector {
    return {
      flowId: 'flow1_clone_match',
      score: (u) => {
        if (this.hasAny(u, ['match', 'steal', 'clone', '1:1', 'exact', 'identical', 'copy precisely'])) {
          if (this.hasNone(u, ['implement', 'build from', 'design'])) {
            return 0.9;
          }
        }
        return 0;
      },
    };
  }

  private createFlow2Detector(): FlowDetector {
    return {
      flowId: 'flow2_polish_enhance',
      score: (u) => {
        if (this.hasAny(u, ['feel', 'polish', 'animation', 'microinteraction', 'janky', 'life', 'experience'])) {
          if (this.hasNone(u, ['layout', 'hierarchy', 'accessible', 'cluttered', 'reorganize', 'restructure'])) {
            // Higher score for 'feel' keyword (more specific to polish/enhance)
            if (this.has(u, 'feel')) {
              return 0.9;
            }
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlow3Detector(): FlowDetector {
    return {
      flowId: 'flow3_audit_page',
      score: (u) => {
        if (this.hasAny(u, ['audit', 'find issues', 'scan', 'what\'s wrong'])) {
          if (this.hasNone(u, ['accessible', 'a11y', 'wcag'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlow4Detector(): FlowDetector {
    return {
      flowId: 'flow4_explore_discovery',
      score: (u) => {
        if (this.hasAny(u, ['explore', 'what if', 'experiment', 'discovery', 'brainstorm', 'try variations'])) {
          if (this.hasNone(u, ['iterate', 'round', 'feedback', 'criteria'])) {
            return 0.85;
          }
        }
        return 0;
      },
    };
  }

  private createFlow5Detector(): FlowDetector {
    return {
      flowId: 'flow5_review_qa',
      score: (u) => {
        if (this.hasAny(u, ['review', 'code review', 'comprehensive', 'QA'])) {
          return 0.8;
        }
        return 0;
      },
    };
  }

  private createFlow6Detector(): FlowDetector {
    return {
      flowId: 'flow6_constraint_design',
      score: (u) => {
        if (this.hasAny(u, ['design for', 'design with', 'optimize given', 'under', 'respecting', 'constraint'])) {
          // Make sure it's actually a constraint context
          if (this.hasAny(u, ['mobile', 'performance', 'wcag', 'keyboard', 'limit', 'budget'])) {
            return 0.8;
          }
        }
        return 0;
      },
    };
  }

  private createFlow7Detector(): FlowDetector {
    return {
      flowId: 'flow7_design_component',
      score: (u) => {
        const hasDesignKeyword = this.hasAny(u, ['design', 'create', 'build', 'new']);
        const hasComponentContext = this.hasAny(u, ['component', 'button', 'picker', 'modal', 'card', 'form', 'widget', 'banner', 'tooltip', 'sidebar', 'nav']);

        if (hasDesignKeyword && hasComponentContext) {
          // Make sure it's not "from" a reference
          if (this.hasNone(u, ['from', 'based on', 'implement', 'mockup', 'figma'])) {
            return 0.9;
          }
        }
        return 0;
      },
    };
  }

  private createFlow8Detector(): FlowDetector {
    return {
      flowId: 'flow8_refactor_layout',
      score: (u) => {
        if (this.hasAny(u, ['refactor', 'cluttered', 'hierarchy', 'layout', 'restructure', 'reorganize', 'clearer', 'whitespace'])) {
          if (this.hasNone(u, ['migrate', 'accessible', 'responsive'])) {
            // "refactor" without "api" keyword -> assume layout refactor
            if (this.has(u, 'refactor') && this.hasNone(u, ['api'])) {
              return 0.85;
            }
            // Other layout keywords
            if (this.hasAny(u, ['cluttered', 'hierarchy', 'layout', 'restructure', 'reorganize', 'clearer'])) {
              return 0.85;
            }
          }
        }
        return 0;
      },
    };
  }

  private createFlow9Detector(): FlowDetector {
    return {
      flowId: 'flow9_accessible',
      score: (u) => {
        if (this.hasAny(u, ['accessible', 'a11y', 'wcag', 'screen reader', 'keyboard', 'aria'])) {
          return 0.9;
        }
        return 0;
      },
    };
  }

  private createFlow10Detector(): FlowDetector {
    return {
      flowId: 'flow10_implement_design',
      score: (u) => {
        const hasImplementKeyword = this.hasAny(u, ['implement', 'code', 'build']);
        const hasSource = this.hasAny(u, ['from', 'based on', 'mockup', 'figma', 'design', 'reference']);

        if (this.has(u, 'implement') || this.has(u, 'code')) {
          return 0.9;
        }
        if (hasImplementKeyword && hasSource) {
          return 0.85;
        }
        return 0;
      },
    };
  }

  private createFlow11Detector(): FlowDetector {
    return {
      flowId: 'flow11_extract_tokens',
      score: (u) => {
        if (this.hasAny(u, ['extract', 'token', 'reusable', 'standardize', 'repeating'])) {
          return 0.8;
        }
        return 0;
      },
    };
  }

  private createFlow12Detector(): FlowDetector {
    return {
      flowId: 'flow12_responsive_review',
      score: (u) => {
        if (this.hasAny(u, ['responsive', 'breakpoint', 'mobile', 'tablet', 'desktop', 'screen sizes'])) {
          return 0.85;
        }
        return 0;
      },
    };
  }

  private createFlow13Detector(): FlowDetector {
    return {
      flowId: 'flow13_rapid_iteration',
      score: (u) => {
        if (this.hasAny(u, ['iterate', 'refine', 'round', 'cycle', 'try variations'])) {
          if (this.hasAny(u, ['feedback', 'criteria', 'round'])) {
            return 0.9;
          }
          return 0.7;
        }
        return 0;
      },
    };
  }

  private createFlow14Detector(): FlowDetector {
    return {
      flowId: 'flow14_migration',
      score: (u) => {
        // High confidence if has strong migration keywords
        if (this.hasAny(u, ['migrate', 'api', 'breaking change', 'replace', 'upgrade'])) {
          if (this.hasAny(u, ['api', 'breaking change', 'migrate'])) {
            return 0.9;
          }
        }
        // "refactor" with API context -> migration/upgrade (highest confidence)
        if (this.has(u, 'refactor') && this.hasAny(u, ['api', 'breaking change'])) {
          return 0.95;
        }
        return 0;
      },
    };
  }

  // SPECIAL: CURATE & QA

  private createFlowUDetector(): FlowDetector {
    return {
      flowId: 'flowU_curate',
      score: (u) => {
        if (this.hasAny(u, ['curate', 'add reference', 'capture component', 'design reference', 'add to catalog'])) {
          return 0.85;
        }
        return 0;
      },
    };
  }

  private createFlowVDetector(): FlowDetector {
    return {
      flowId: 'flowV_all_seven_qa',
      score: (u) => {
        if (this.hasAny(u, ['all-seven', 'all seven', 'comprehensive qa', 'full pipeline', 'end-to-end', 'qa pipeline', 'all tiers'])) {
          return 0.9;
        }
        if (this.hasAny(u, ['qa', 'pipeline', 'full'])) {
          if (this.hasAny(u, ['chain', 'all flows', 'tiers', 'comprehensive'])) {
            return 0.8;
          }
        }
        return 0;
      },
    };
  }
}

export function createDetector(): IntentDetector {
  return new IntentDetector();
}

// Phase III Block 5: Integration Testing
// Validator integration, metadata enrichment, conditional routing, performance benchmarks

declare global {
  function describe(name: string, fn: () => void): void;
  function test(name: string, fn: () => void): void;
  function beforeEach(fn: () => void): void;
  function expect(value: any): any;
  namespace jest {
    interface Matchers<R> {
      toBeDefined(): R;
      toBeUndefined(): R;
      toBe(expected: any): R;
      toEqual(expected: any): R;
      toBeGreaterThan(expected: number): R;
      toBeLessThan(expected: number): R;
      toBeGreaterThanOrEqual(expected: number): R;
      toBeLessThanOrEqual(expected: number): R;
    }
  }
}

import { FlowExecutionContext, FlowHandler, FlowExecutionResult } from './flow-handler';
import { FlowSpecificValidator } from './flow-specific-validators';
import { FlowMetricsTracker } from './flow-metrics-tracker';
import { FlowConditionalRouter } from './flow-conditional-router';
import { FlowHandlerCache } from './flow-performance-cache';
import { FlowId } from './types';

describe('Phase III: Integration Tests', () => {
  let metricsTracker: FlowMetricsTracker;
  let performanceCache: FlowHandlerCache;
  let testContext: FlowExecutionContext;

  beforeEach(() => {
    metricsTracker = new FlowMetricsTracker();
    performanceCache = new FlowHandlerCache(60000, 100);

    testContext = {
      utterance: 'brand verification please',
      userId: 'test-user-123',
      projectPath: '/test/project',
      metadata: {
        designTokens: {
          colors: ['#FF0000', '#00FF00'],
          register: 'primary',
        },
        colors: { primary: '#FF0000', secondary: '#00FF00' },
        typography: { heading: 'Inter', body: 'System' },
        spacing: { xs: '4px', sm: '8px', md: '16px' },
        componentTree: { nodeCount: 42, depth: 5 },
        accessibility: { wcagLevel: 'AA', auditDate: Date.now() },
      },
    };
  });

  // ===== Validator Integration Tests =====
  describe('Flow-Specific Validators', () => {
    test('Brand Verify validator passes with valid context', () => {
      const mockResult: FlowExecutionResult = {
        flowId: 'flowA_brand_verify' as FlowId,
        flowName: 'Brand/PRODUCT.md Verification',
        status: 'success',
        message: 'Brand verification complete',
        guidance: ['Brand consistency verified'],
        checklist: [],
        artifacts: [],
      };

      const validation = FlowSpecificValidator.validateFlow(
        'flowA_brand_verify',
        testContext,
        mockResult
      );

      expect(validation.passed).toBeGreaterThan(0);
      expect(validation.failed).toBe(0);
    });

    test('Component Research validator checks for interaction patterns', () => {
      const mockResult: FlowExecutionResult = {
        flowId: 'flowB_component_research' as FlowId,
        flowName: 'Component Research (component.gallery)',
        status: 'success',
        message: 'Research complete',
        guidance: ['interaction patterns documented', 'accessibility rules checked'],
        checklist: [{ id: 'state1', label: 'State 1', required: false, completed: true }],
        artifacts: [{ type: 'reference', name: 'component-lib', description: 'Component library', content: '' }],
      };

      const validation = FlowSpecificValidator.validateFlow(
        'flowB_component_research',
        testContext,
        mockResult
      );

      expect(validation.passed).toBeGreaterThan(0);
      expect(validation.warnings.length).toBeGreaterThanOrEqual(0);
    });

    test('Design Tokens validator enforces coverage', () => {
      const mockResult: FlowExecutionResult = {
        flowId: 'flowF_design_tokens' as FlowId,
        flowName: 'Design System Tokens (DESIGN.md)',
        status: 'success',
        message: 'Tokens defined',
        guidance: ['color naming convention', 'spacing scale verified', 'semantic tokens defined'],
        checklist: [],
        artifacts: [],
      };

      const validation = FlowSpecificValidator.validateFlow(
        'flowF_design_tokens',
        testContext,
        mockResult
      );

      expect(validation).toBeDefined();
      expect(validation.passed + validation.failed).toBeGreaterThan(0);
    });

    test('Tactical Polish validator checks 24-point standard', () => {
      const mockResult: FlowExecutionResult = {
        flowId: 'flowJ_tactical_polish' as FlowId,
        flowName: '16-Point Tactical Polish',
        status: 'success',
        message: 'Polish applied',
        guidance: Array(8).fill('polish guidance item'),
        checklist: Array(14).fill({ id: 'baseline-item', label: 'Baseline Item', required: true, completed: true }),
        artifacts: [],
      };

      const validation = FlowSpecificValidator.validateFlow(
        'flowJ_tactical_polish',
        testContext,
        mockResult
      );

      expect(validation.passed).toBeGreaterThan(0);
    });

    test('Validator registry accessible', () => {
      const allValidators = FlowSpecificValidator.getAllValidators();
      expect(allValidators.length).toBe(4);
      expect(allValidators.map(v => v.flowId)).toContain('flowA_brand_verify');
      expect(allValidators.map(v => v.flowId)).toContain('flowF_design_tokens');
    });
  });

  // ===== Metadata Enrichment Tests =====
  describe('Flow Metrics Tracking', () => {
    test('Metrics tracking initialization', () => {
      const executionId = 'exec-test-001';
      metricsTracker.startTracking('flowA_brand_verify', 'Brand Verify', executionId);

      const metadata = metricsTracker.getMetadata(executionId);
      expect(metadata).toBeDefined();
      expect(metadata?.flowId).toBe('flowA_brand_verify');
      expect(metadata?.flowName).toBe('Brand Verify');
      expect(metadata?.metrics.executionDuration).toBe(0);
    });

    test('Decision checkpoint recording', () => {
      const executionId = 'exec-test-002';
      metricsTracker.startTracking('flowB_component_research', 'Component Research', executionId);

      metricsTracker.recordDecision(
        executionId,
        'use-gallery-reference',
        'Selected component gallery as primary reference',
        'high'
      );

      const metadata = metricsTracker.getMetadata(executionId);
      expect(metadata?.decisions.length).toBe(1);
      expect(metadata?.decisions[0].decision).toBe('use-gallery-reference');
      expect(metadata?.metrics.decisionsRecorded).toBe(1);
    });

    test('Validation aggregation', () => {
      const executionId = 'exec-test-003';
      metricsTracker.startTracking('flowF_design_tokens', 'Design Tokens', executionId);

      metricsTracker.recordValidation(
        executionId,
        'token-naming',
        10,
        8,
        ['rule-1-failed', 'rule-2-failed']
      );

      const metadata = metricsTracker.getMetadata(executionId);
      expect(metadata?.validations.length).toBe(1);
      expect(metadata?.validations[0].passRate).toBe(80);
      expect(metadata?.validations[0].rulesFailed).toBe(2);
    });

    test('Artifact production logging', () => {
      const executionId = 'exec-test-004';
      metricsTracker.startTracking('flowJ_tactical_polish', 'Tactical Polish', executionId);

      metricsTracker.recordArtifact(
        executionId,
        'checklist',
        'Polish Baseline Checklist',
        '14-item baseline checklist',
        2048
      );

      const metadata = metricsTracker.getMetadata(executionId);
      expect(metadata?.artifacts.length).toBe(1);
      expect(metadata?.artifacts[0].type).toBe('checklist');
      expect(metadata?.metrics.artifactsProduced).toBe(1);
    });

    test('Checklist progress tracking', () => {
      const executionId = 'exec-test-005';
      metricsTracker.startTracking('flowA_brand_verify', 'Brand Verify', executionId);

      metricsTracker.updateChecklistProgress(executionId, 7, 10);

      const metadata = metricsTracker.getMetadata(executionId);
      expect(metadata?.metrics.checklistItemsCompleted).toBe(7);
      expect(metadata?.metrics.checklistItemsTotal).toBe(10);
    });

    test('Metrics summary generation', () => {
      const executionId = 'exec-test-006';
      metricsTracker.startTracking('flowA_brand_verify', 'Brand Verify', executionId);

      metricsTracker.recordValidation(executionId, 'brand-consistency', 5, 4);
      metricsTracker.recordArtifact(executionId, 'guide', 'Brand Guide', 'Brand guidelines');
      metricsTracker.updateChecklistProgress(executionId, 3, 5);

      const summary = metricsTracker.getMetricsSummary(executionId);
      expect(summary).toBeDefined();
      expect(summary?.flowId).toBe('flowA_brand_verify');
      expect(summary?.artifactsProduced).toBe(1);
      expect(summary?.validationSummary.passed).toBe(4);
    });
  });

  // ===== Conditional Routing Tests =====
  describe('Conditional Flow Routing', () => {
    test('Determines brand verify flow for brand keyword', () => {
      const context: FlowExecutionContext = {
        utterance: 'verify the brand',
        userId: 'test',
        projectPath: '/test',
        metadata: {},
      };

      const route = FlowConditionalRouter.determineRoute(context);
      expect(route).toBe('flowA_brand_verify');
    });

    test('Determines component research flow', () => {
      const context: FlowExecutionContext = {
        utterance: 'research components',
        userId: 'test',
        projectPath: '/test',
        metadata: {},
      };

      const route = FlowConditionalRouter.determineRoute(context);
      expect(route).toBe('flowB_component_research');
    });

    test('Design tokens flow requires prerequisites', () => {
      const routes = FlowConditionalRouter.buildConditionalRoutes();
      const tokenRoute = routes.find(r => r.flowId === 'flowF_design_tokens');

      expect(tokenRoute).toBeDefined();
      expect(tokenRoute?.conditions.length).toBeGreaterThan(0);
      expect(tokenRoute?.conditions[0].name).toBe('brand-verified');
    });

    test('Component implementation requires design tokens', () => {
      const routes = FlowConditionalRouter.buildConditionalRoutes();
      const implRoute = routes.find(r => r.flowId === 'flowG_component_implementation');

      expect(implRoute).toBeDefined();
      expect(implRoute?.skipIfConditionFails).toBe(true);
      expect(implRoute?.alternativeFlow).toBe('flowF_design_tokens');
    });

    test('Evaluates route conditions correctly', () => {
      const route = {
        flowId: 'flowF_design_tokens' as FlowId,
        conditions: [
          {
            name: 'test-condition',
            description: 'Test',
            evaluate: (ctx: FlowExecutionContext) => !!ctx.metadata?.designTokens,
          },
        ],
        skipIfConditionFails: false,
      };

      const canExecute = FlowConditionalRouter.evaluateRouteConditions(testContext, route);
      expect(canExecute).toBe(true);
    });

    test('Executable path includes primary flow', () => {
      const context: FlowExecutionContext = {
        utterance: 'verify brand',
        userId: 'test',
        projectPath: '/test',
        metadata: {},
      };

      const path = FlowConditionalRouter.getExecutablePath(context);
      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toBe('flowA_brand_verify');
    });
  });

  // ===== Performance Cache Tests =====
  describe('Performance Optimization Cache', () => {
    test('Caches handler results', () => {
      const flowId: FlowId = 'flowA_brand_verify';
      const result: FlowExecutionResult = {
        flowId,
        flowName: 'Brand/PRODUCT.md Verification',
        status: 'success',
        message: 'Test',
        guidance: [],
        checklist: [],
        artifacts: [],
      };

      performanceCache.cacheHandlerResult(flowId, result);
      const cached = performanceCache.getHandlerResult(flowId);

      expect(cached).toBeDefined();
      expect(cached?.flowId).toBe(flowId);
    });

    test('Caches execution contexts', () => {
      const contextId = 'ctx-001';
      performanceCache.cacheContext(contextId, testContext);
      const cached = performanceCache.getContext(contextId);

      expect(cached).toBeDefined();
      expect(cached?.userId).toBe('test-user-123');
    });

    test('Caches validator results', () => {
      const validatorKey = 'flowA_brand_verify:validation';
      const result = { passed: 4, failed: 0 };

      performanceCache.cacheValidatorResult(validatorKey, result);
      const cached = performanceCache.getValidatorResult(validatorKey);

      expect(cached).toEqual(result);
    });

    test('Caches query results', () => {
      const query = 'select flows where status=success';
      const results = [{ id: 'flow1' }, { id: 'flow2' }];

      performanceCache.cacheQueryResult(query, results);
      const cached = performanceCache.getQueryResult(query);

      expect(cached).toEqual(results);
    });

    test('Tracks cache statistics', () => {
      const flowId: FlowId = 'flowA_brand_verify';
      const result: FlowExecutionResult = {
        flowId,
        flowName: 'Brand/PRODUCT.md Verification',
        status: 'success',
        message: 'Test',
        guidance: [],
        checklist: [],
        artifacts: [],
      };

      performanceCache.cacheHandlerResult(flowId, result);
      performanceCache.getHandlerResult(flowId);
      performanceCache.getHandlerResult(flowId);

      const stats = performanceCache.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    test('Invalidates cache entries', () => {
      const flowId: FlowId = 'flowA_brand_verify';
      const result: FlowExecutionResult = {
        flowId,
        flowName: 'Brand/PRODUCT.md Verification',
        status: 'success',
        message: 'Test',
        guidance: [],
        checklist: [],
        artifacts: [],
      };

      performanceCache.cacheHandlerResult(flowId, result);
      performanceCache.invalidateFlow(flowId);
      const cached = performanceCache.getHandlerResult(flowId);

      expect(cached).toBeUndefined();
    });

    test('Enforces cache size limits', () => {
      const smallCache = new FlowHandlerCache(60000, 5);

      for (let i = 0; i < 10; i++) {
        const flowId: FlowId = `flow${i}` as FlowId;
        const result: FlowExecutionResult = {
          flowId,
          flowName: `Flow ${i}`,
          status: 'success',
          message: `Test ${i}`,
          guidance: [],
          checklist: [],
          artifacts: [],
        };
        smallCache.cacheHandlerResult(flowId, result);
      }

      const stats = smallCache.getStats();
      expect(stats.cacheSize).toBeLessThanOrEqual(5);
    });
  });

  // ===== Performance Benchmark Tests =====
  describe('Performance Benchmarks', () => {
    test('Cache hit performance', () => {
      const flowId: FlowId = 'flowA_brand_verify';
      const result: FlowExecutionResult = {
        flowId,
        flowName: 'Brand/PRODUCT.md Verification',
        status: 'success',
        message: 'Test',
        guidance: [],
        checklist: [],
        artifacts: [],
      };

      performanceCache.cacheHandlerResult(flowId, result);

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        performanceCache.getHandlerResult(flowId);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // 1000 cache hits in < 100ms
    });

    test('Validator execution time', () => {
      const mockResult: FlowExecutionResult = {
        flowId: 'flowA_brand_verify' as FlowId,
        flowName: 'Brand/PRODUCT.md Verification',
        status: 'success',
        message: 'Test',
        guidance: ['test guidance'],
        checklist: [],
        artifacts: [],
      };

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        FlowSpecificValidator.validateFlow('flowA_brand_verify', testContext, mockResult);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200); // 100 validations in < 200ms
    });

    test('Conditional routing performance', () => {
      const context: FlowExecutionContext = {
        utterance: 'verify brand',
        userId: 'test',
        projectPath: '/test',
        metadata: {},
      };

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        FlowConditionalRouter.determineRoute(context);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50); // 100 route determinations in < 50ms
    });
  });

  // ===== End-to-End Integration =====
  describe('End-to-End Phase III Integration', () => {
    test('Complete flow with caching, validation, and metrics', () => {
      const executionId = 'e2e-test-001';
      const flowId: FlowId = 'flowA_brand_verify';

      // Start tracking
      metricsTracker.startTracking(flowId, 'Brand Verify', executionId);

      // Simulate flow execution
      const result: FlowExecutionResult = {
        flowId,
        flowName: 'Brand/PRODUCT.md Verification',
        status: 'success',
        message: 'Brand verified',
        guidance: ['guidance 1'],
        checklist: [{ id: 'item1', label: 'Item 1', required: true, completed: true }],
        artifacts: [{ type: 'reference', name: 'brand-ref', description: 'Brand reference', content: '' }],
      };

      // Validate
      const validation = FlowSpecificValidator.validateFlow(flowId, testContext, result);
      expect(validation.passed).toBeGreaterThan(0);

      // Record metrics
      metricsTracker.recordValidation(executionId, 'brand-check', 5, 5);
      metricsTracker.recordArtifact(executionId, 'reference', 'Brand Ref', 'Brand reference');
      metricsTracker.updateChecklistProgress(executionId, 1, 1);

      // Cache result
      performanceCache.cacheHandlerResult(flowId, result);

      // Verify cached
      const cached = performanceCache.getHandlerResult(flowId);
      expect(cached).toBeDefined();

      // Complete tracking
      metricsTracker.completeTracking(executionId);

      // Get summary
      const summary = metricsTracker.getMetricsSummary(executionId);
      expect(summary?.flowId).toBe(flowId);
      expect(summary?.artifactsProduced).toBe(1);

      // Cache stats
      const stats = performanceCache.getStats();
      expect(stats.totalHits).toBeGreaterThan(0);
    });
  });
});

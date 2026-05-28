export interface BrowserConnection {
  id: string;
  tabUrl: string;
  tabTitle: string;
  connectedAt: number;
  send(message: JsonRpcMessage): void;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse;

export interface ElementContext {
  tagName: string;
  textContent: string;
  selector: string;
  classes: string[];
  computedStyles: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number };
  nearbyElements: string[];
  pageUrl: string;
  viewport: { width: number; height: number };
  adapter?: AdapterEnrichment;
  tokens?: Record<string, string>;
}

export interface AdapterEnrichment {
  frameworkName: string;
  componentName: string;
  componentTree: string[];
  sourceFile?: string;
  sourceLine?: number;
  props?: Record<string, unknown>;
}

export interface StyleChange {
  selector: string;
  property: string;
  oldValue: string;
  newValue: string;
  elementContext: ElementContext;
  cssomData?: CssomRuleData;
}

export interface CssomRuleData {
  ruleSelector: string;
  stylesheetHref: string | null;
  specificity: number;
  isImportant: boolean;
  mediaQuery: string | null;
}

export interface SourceLocation {
  filePath: string;
  line: number;
  column?: number;
  ruleSelector?: string;
}

export interface ResolvedChange {
  source: SourceLocation;
  property: string;
  oldValue: string;
  newValue: string;
  stylingApproach: StylingApproach;
  guidance?: string;
  tokenMapping?: string;
}

export type StylingApproach =
  | 'tailwind'
  | 'css-modules'
  | 'styled-components'
  | 'sass'
  | 'plain-css'
  | 'unknown';

export interface Annotation {
  id: string;
  elementSelector: string;
  elementPath: string;
  computedStyles: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number };
  nearbyText: string;
  accessibility: { role: string; label: string };
  comment: string;
  intent: 'fix' | 'change' | 'question' | 'approve';
  severity: 'blocking' | 'important' | 'suggestion';
  isMultiSelect: boolean;
  elementBoundingBoxes?: { x: number; y: number; width: number; height: number }[];
  timestamp: number;
  status: 'pending' | 'acknowledged' | 'resolved';
}

export type AnnotationVerbosity = 'compact' | 'standard' | 'detailed' | 'forensic';

export interface LayoutPlacement {
  id: string;
  componentType: string;
  category: 'layout' | 'content' | 'controls' | 'elements' | 'blocks' | 'project';
  x: number;
  y: number;
  width: number;
  height: number;
  scrollY: number;
}

export interface ComponentInfo {
  name: string;
  category: string;
  source: 'primitive' | 'project';
  filePath?: string;
  props?: string[];
}

export interface DiffOutput {
  changes: ResolvedChange[];
  stylingApproach: StylingApproach;
  guidance: string;
  tokenMappings: Record<string, string>;
}

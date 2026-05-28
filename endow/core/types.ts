export interface EndowAdapter {
  name: string;
  enrichElement(domNode: HTMLElement): AdapterEnrichment | null;
  getComponentTree(domNode: HTMLElement): string[];
  freeze?(): void;
  unfreeze?(): void;
}

export interface AdapterEnrichment {
  frameworkName: string;
  componentName: string;
  componentTree: string[];
  sourceFile?: string;
  sourceLine?: number;
  props?: Record<string, unknown>;
}

export type EndowMode = 'manipulate' | 'prompt' | 'annotate' | 'layout';

export interface SelectedElement {
  domNode: HTMLElement;
  selector: string;
  tagName: string;
  textContent: string;
  classes: string[];
  computedStyles: Record<string, string>;
  boundingBox: DOMRect;
  adapterData: AdapterEnrichment[];
}

export interface PendingChange {
  id: string;
  selector: string;
  property: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
}

export interface AnnotationData {
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
}

export interface LayoutPlacementData {
  id: string;
  componentType: string;
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scrollY: number;
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

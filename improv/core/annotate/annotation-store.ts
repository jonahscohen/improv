import { AnnotationData } from '../types.js';

export interface AddParams {
  elementSelector: string;
  comment: string;
  intent: 'fix' | 'change' | 'question' | 'approve';
  severity: 'blocking' | 'important' | 'suggestion';
  elementPath?: string;
  computedStyles?: Record<string, string>;
  boundingBox?: { x: number; y: number; width: number; height: number };
  nearbyText?: string;
  accessibility?: { role: string; label: string };
  isMultiSelect?: boolean;
  elementBoundingBoxes?: { x: number; y: number; width: number; height: number }[];
}

interface StoredAnnotation extends AnnotationData {
  status: 'pending' | 'resolved' | 'acknowledged';
}

export class AnnotationStore {
  private annotations: StoredAnnotation[] = [];
  private nextId = 1;

  add(params: AddParams): string {
    const id = `ann-${this.nextId++}`;
    const annotation: StoredAnnotation = {
      id,
      elementSelector: params.elementSelector,
      comment: params.comment,
      intent: params.intent,
      severity: params.severity,
      elementPath: params.elementPath ?? '',
      computedStyles: params.computedStyles ?? {},
      boundingBox: params.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 },
      nearbyText: params.nearbyText ?? '',
      accessibility: params.accessibility ?? { role: '', label: '' },
      isMultiSelect: params.isMultiSelect ?? false,
      elementBoundingBoxes: params.elementBoundingBoxes,
      timestamp: Date.now(),
      status: 'pending',
    };
    this.annotations.push(annotation);
    return id;
  }

  resolve(id: string): void {
    const annotation = this.annotations.find(a => a.id === id);
    if (annotation) annotation.status = 'resolved';
  }

  acknowledge(id: string): void {
    const annotation = this.annotations.find(a => a.id === id);
    if (annotation) annotation.status = 'acknowledged';
  }

  getAll(): StoredAnnotation[] {
    return [...this.annotations];
  }

  getPending(): StoredAnnotation[] {
    return this.annotations.filter(a => a.status === 'pending');
  }

  get(id: string): StoredAnnotation | undefined {
    return this.annotations.find(a => a.id === id);
  }

  clear(): void {
    this.annotations = [];
  }

  count(): number {
    return this.annotations.length;
  }

  pendingCount(): number {
    return this.annotations.filter(a => a.status === 'pending').length;
  }
}

import type { ComponentType } from 'react';

export type OgmaAnnotationStatus = 'open' | 'queued' | 'addressed';

export interface OgmaPrototypeScreenProps {
  review: OgmaReviewDefinition;
  screen: OgmaPrototypeScreen;
}

export interface OgmaPrototypeScreen {
  id: string;
  title: string;
  description?: string;
  width?: number;
  height?: number;
  component: ComponentType<OgmaPrototypeScreenProps>;
}

export interface OgmaReviewMetadata {
  agent?: string;
  iteration?: string;
  source?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface OgmaReviewDefinition {
  title: string;
  description?: string;
  screens: OgmaPrototypeScreen[];
  notes?: string;
  metadata?: OgmaReviewMetadata;
}

export interface OgmaAnnotation {
  id: string;
  screenId: string;
  x: number;
  y: number;
  title: string;
  detail: string;
  status: OgmaAnnotationStatus;
  action: string;
  createdAt: string;
  updatedAt: string;
}

export interface OgmaReviewSession {
  reviewId: string;
  annotations: OgmaAnnotation[];
  updatedAt: string;
}

export interface OgmaClientConfig {
  cwd: string;
  dataDir: string;
  defaultDesignDir: string;
  reviewUrl: string;
  skillUrl: string;
  serverStartedAt: string;
}

export interface OgmaServerStatus {
  packageName: '@hcgstudio/ogma';
  version: string;
  cwd: string;
  dataDir: string;
  designEntry: string;
  historyPath: string;
  notesPath: string;
  reviewUrl: string;
  skillUrl: string;
  snapshotsDir: string;
  serverStartedAt: string;
}

export interface OgmaFeedbackExport {
  reviewId: string;
  generatedAt: string;
  reviewUrl: string;
  annotations: Array<{
    id: string;
    screenId: string;
    title: string;
    detail: string;
    status: OgmaAnnotationStatus;
    action: string;
    location: {
      x: number;
      y: number;
    };
  }>;
}

export interface OgmaSessionHistoryEntry {
  id: string;
  annotationCount: number;
  counts: Record<OgmaAnnotationStatus, number>;
  reviewId: string;
  updatedAt: string;
}

export interface OgmaViewportSnapshot {
  id: string;
  annotations: OgmaAnnotation[];
  createdAt: string;
  reviewId: string;
  reviewUrl: string;
  screenId: string;
  viewportMode: string;
}

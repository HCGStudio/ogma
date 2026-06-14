import type { ComponentType } from 'react';
import type { OgmaPrototypeScreen, OgmaPrototypeScreenProps, OgmaReviewDefinition } from '../types.js';
import { createDefaultOgmaReview, MissingScreen } from './defaultReview.js';

interface ReviewModuleShape {
  default?: unknown;
  review?: unknown;
  ogmaReview?: unknown;
  screens?: unknown;
  title?: unknown;
  description?: unknown;
  notes?: unknown;
  metadata?: unknown;
}

function slugify(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeScreen(value: unknown, index: number): OgmaPrototypeScreen | null {
  if (!isObject(value)) {
    return null;
  }

  const title = typeof value.title === 'string' ? value.title : `Screen ${index + 1}`;
  const component = (
    typeof value.component === 'function'
      ? (value.component as ComponentType)
      : typeof value.Component === 'function'
        ? (value.Component as ComponentType)
        : MissingScreen
  ) as ComponentType<OgmaPrototypeScreenProps>;

  return {
    id: typeof value.id === 'string' ? slugify(value.id, `screen-${index + 1}`) : slugify(title, `screen-${index + 1}`),
    title,
    description: typeof value.description === 'string' ? value.description : undefined,
    width: typeof value.width === 'number' ? value.width : undefined,
    height: typeof value.height === 'number' ? value.height : undefined,
    component
  };
}

function pickReviewCandidate(moduleValue: ReviewModuleShape) {
  return moduleValue.default ?? moduleValue.review ?? moduleValue.ogmaReview ?? moduleValue;
}

export function normalizeReviewModule(moduleValue: unknown, productNotes = ''): OgmaReviewDefinition {
  const fallback = createDefaultOgmaReview();

  if (!isObject(moduleValue)) {
    return { ...fallback, notes: productNotes || fallback.notes };
  }

  const candidate = pickReviewCandidate(moduleValue);

  if (!isObject(candidate) || !Array.isArray(candidate.screens)) {
    return { ...fallback, notes: productNotes || fallback.notes };
  }

  const screens = candidate.screens
    .map((screen, index) => normalizeScreen(screen, index))
    .filter((screen): screen is OgmaPrototypeScreen => screen !== null);

  if (screens.length === 0) {
    return { ...fallback, notes: productNotes || fallback.notes };
  }

  return {
    title: typeof candidate.title === 'string' ? candidate.title : fallback.title,
    description:
      typeof candidate.description === 'string' ? candidate.description : fallback.description,
    screens,
    notes: productNotes || (typeof candidate.notes === 'string' ? candidate.notes : fallback.notes),
    metadata: isObject(candidate.metadata) ? candidate.metadata : fallback.metadata
  };
}

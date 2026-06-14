import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OgmaReviewSession } from '../types.js';
import { DEFAULT_DESIGN_DIR, DEFAULT_PRODUCT_NOTES, DEFAULT_REVIEW_SOURCE } from './templates.js';

export interface OgmaResolvedProject {
  cwd: string;
  createdPaths: string[];
  dataDir: string;
  defaultDesignDir: string;
  designEntry: string;
  existingPaths: string[];
  feedbackPath: string;
  historyPath: string;
  notesPath: string;
  sessionPath: string;
  snapshotsDir: string;
}

const reviewEntryNames = ['review.tsx', 'review.jsx', 'ogma.review.tsx', 'ogma.review.jsx'];

function nowIso() {
  return new Date().toISOString();
}

function emptySession(): OgmaReviewSession {
  return {
    reviewId: 'ogma-review',
    annotations: [],
    updatedAt: nowIso()
  };
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function pathIsFile(filePath: string) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return Boolean(path.extname(filePath));
  }
}

async function ensureDirectory(dirPath: string, project: Pick<OgmaResolvedProject, 'createdPaths' | 'existingPaths'>) {
  if (await fileExists(dirPath)) {
    await mkdir(dirPath, { recursive: true });
    project.existingPaths.push(dirPath);
    return;
  }

  await mkdir(dirPath, { recursive: true });
  project.createdPaths.push(dirPath);
}

async function ensureFile(
  filePath: string,
  contents: string,
  project: Pick<OgmaResolvedProject, 'createdPaths' | 'existingPaths'>
) {
  if (await fileExists(filePath)) {
    project.existingPaths.push(filePath);
    return;
  }

  await writeFile(filePath, contents, 'utf8');
  project.createdPaths.push(filePath);
}

async function resolveReviewTarget(cwd: string, target = DEFAULT_DESIGN_DIR) {
  const absoluteTarget = path.resolve(cwd, target);

  if (await pathIsFile(absoluteTarget)) {
    return {
      designDir: path.dirname(absoluteTarget),
      designEntry: absoluteTarget
    };
  }

  for (const entryName of reviewEntryNames) {
    const candidate = path.join(absoluteTarget, entryName);

    if (await fileExists(candidate)) {
      return {
        designDir: absoluteTarget,
        designEntry: candidate
      };
    }
  }

  return {
    designDir: absoluteTarget,
    designEntry: path.join(absoluteTarget, reviewEntryNames[0] ?? 'review.tsx')
  };
}

export async function ensureOgmaProject({
  cwd,
  review
}: {
  cwd: string;
  review?: string;
}): Promise<OgmaResolvedProject> {
  const { designDir, designEntry } = await resolveReviewTarget(cwd, review);
  const dataDir = path.join(cwd, '.ogma');
  const notesPath = path.join(designDir, 'product-notes.md');
  const sessionPath = path.join(dataDir, 'session.json');
  const feedbackPath = path.join(dataDir, 'feedback.json');
  const historyPath = path.join(dataDir, 'history.json');
  const snapshotsDir = path.join(dataDir, 'snapshots');
  const project = {
    createdPaths: [],
    existingPaths: []
  };

  await ensureDirectory(designDir, project);
  await ensureDirectory(dataDir, project);
  await ensureDirectory(snapshotsDir, project);
  await ensureFile(designEntry, DEFAULT_REVIEW_SOURCE, project);
  await ensureFile(notesPath, DEFAULT_PRODUCT_NOTES, project);
  await ensureFile(sessionPath, `${JSON.stringify(emptySession(), null, 2)}\n`, project);
  await ensureFile(historyPath, '[]\n', project);

  return {
    cwd,
    createdPaths: project.createdPaths,
    dataDir,
    defaultDesignDir: path.relative(cwd, designDir) || '.',
    designEntry,
    existingPaths: project.existingPaths,
    feedbackPath,
    historyPath,
    notesPath,
    sessionPath,
    snapshotsDir
  };
}

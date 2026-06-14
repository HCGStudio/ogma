import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import type {
  OgmaAnnotation,
  OgmaAnnotationStatus,
  OgmaClientConfig,
  OgmaFeedbackExport,
  OgmaReviewSession,
  OgmaServerStatus,
  OgmaSessionHistoryEntry,
  OgmaViewportSnapshot
} from '../types.js';
import { ensureOgmaProject, type OgmaResolvedProject } from './project.js';
import { DEFAULT_SKILL_URL } from './templates.js';

type NextFunction = (error?: unknown) => void;

export interface OgmaStartOptions {
  cwd: string;
  host: string;
  open: boolean;
  packageRoot: string;
  port: number;
  review?: string;
  skillUrl?: string;
}

interface PackageManifest {
  version?: string;
}

function toPosixPath(value: string) {
  return value.split(path.sep).join('/');
}

function fsImportSpecifier(value: string) {
  return `/@fs/${toPosixPath(value)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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

async function readPackageVersion(packageRoot: string) {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(packageRoot, 'package.json'), 'utf8')
    ) as PackageManifest;

    return manifest.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function sendText(response: ServerResponse, statusCode: number, value: string, contentType = 'text/plain') {
  response.statusCode = statusCode;
  response.setHeader('content-type', `${contentType}; charset=utf-8`);
  response.end(value);
}

function isStatus(value: unknown): value is OgmaAnnotationStatus {
  return value === 'open' || value === 'queued' || value === 'addressed';
}

function sanitizeAnnotation(value: unknown): OgmaAnnotation | null {
  if (!isObject(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id : '';
  const screenId = typeof value.screenId === 'string' ? value.screenId : '';
  const statusValue = isStatus(value.status) ? value.status : 'open';

  if (!id || !screenId) {
    return null;
  }

  return {
    id,
    screenId,
    x: typeof value.x === 'number' ? value.x : 50,
    y: typeof value.y === 'number' ? value.y : 50,
    title: typeof value.title === 'string' ? value.title : 'Untitled feedback',
    detail: typeof value.detail === 'string' ? value.detail : '',
    status: statusValue,
    action: typeof value.action === 'string' ? value.action : 'Update the referenced JSX screen.',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : nowIso(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso()
  };
}

function sanitizeSession(value: unknown): OgmaReviewSession {
  if (!isObject(value)) {
    return emptySession();
  }

  const annotations = Array.isArray(value.annotations)
    ? value.annotations
        .map((annotation) => sanitizeAnnotation(annotation))
        .filter((annotation): annotation is OgmaAnnotation => annotation !== null)
    : [];

  return {
    reviewId: typeof value.reviewId === 'string' ? value.reviewId : 'ogma-review',
    annotations,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso()
  };
}

async function readSession(project: OgmaResolvedProject) {
  try {
    return sanitizeSession(JSON.parse(await readFile(project.sessionPath, 'utf8')));
  } catch {
    const session = emptySession();
    await writeSession(project, session);
    return session;
  }
}

async function writeSession(project: OgmaResolvedProject, session: OgmaReviewSession) {
  await writeFile(project.sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  await appendHistory(project, session);
}

function countByStatus(annotations: OgmaAnnotation[]): Record<OgmaAnnotationStatus, number> {
  return {
    addressed: annotations.filter((annotation) => annotation.status === 'addressed').length,
    open: annotations.filter((annotation) => annotation.status === 'open').length,
    queued: annotations.filter((annotation) => annotation.status === 'queued').length
  };
}

async function readHistory(project: OgmaResolvedProject): Promise<OgmaSessionHistoryEntry[]> {
  try {
    const value = JSON.parse(await readFile(project.historyPath, 'utf8'));
    return Array.isArray(value) ? (value as OgmaSessionHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

async function appendHistory(project: OgmaResolvedProject, session: OgmaReviewSession) {
  const history = await readHistory(project);
  const entry: OgmaSessionHistoryEntry = {
    id: `${Date.now()}`,
    annotationCount: session.annotations.length,
    counts: countByStatus(session.annotations),
    reviewId: session.reviewId,
    updatedAt: session.updatedAt
  };

  history.push(entry);
  await writeFile(project.historyPath, `${JSON.stringify(history.slice(-50), null, 2)}\n`, 'utf8');
}

function buildFeedbackExport(
  session: OgmaReviewSession,
  reviewUrl: string
): OgmaFeedbackExport {
  return {
    reviewId: session.reviewId,
    generatedAt: nowIso(),
    reviewUrl,
    annotations: session.annotations.map((annotation) => ({
      id: annotation.id,
      screenId: annotation.screenId,
      title: annotation.title,
      detail: annotation.detail,
      status: annotation.status,
      action: annotation.action,
      location: {
        x: annotation.x,
        y: annotation.y
      }
    }))
  };
}

function sessionFromFeedbackExport(value: unknown): OgmaReviewSession {
  if (!isObject(value) || !Array.isArray(value.annotations)) {
    return emptySession();
  }

  const timestamp = nowIso();
  const annotations = value.annotations
    .map((item) => {
      if (!isObject(item)) {
        return null;
      }

      return sanitizeAnnotation({
        id: item.id,
        screenId: item.screenId,
        x: isObject(item.location) && typeof item.location.x === 'number' ? item.location.x : 50,
        y: isObject(item.location) && typeof item.location.y === 'number' ? item.location.y : 50,
        title: item.title,
        detail: item.detail,
        status: item.status,
        action: item.action,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    })
    .filter((annotation): annotation is OgmaAnnotation => annotation !== null);

  return {
    reviewId: typeof value.reviewId === 'string' ? value.reviewId : 'ogma-review',
    annotations,
    updatedAt: timestamp
  };
}

function sanitizeSnapshot(value: unknown, reviewUrl: string): OgmaViewportSnapshot {
  const timestamp = nowIso();

  if (!isObject(value)) {
    return {
      id: `${Date.now()}`,
      annotations: [],
      createdAt: timestamp,
      reviewId: 'ogma-review',
      reviewUrl,
      screenId: 'unknown',
      viewportMode: 'desktop'
    };
  }

  const annotations = Array.isArray(value.annotations)
    ? value.annotations
        .map((annotation) => sanitizeAnnotation(annotation))
        .filter((annotation): annotation is OgmaAnnotation => annotation !== null)
    : [];

  return {
    id: typeof value.id === 'string' ? value.id : `${Date.now()}`,
    annotations,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : timestamp,
    reviewId: typeof value.reviewId === 'string' ? value.reviewId : 'ogma-review',
    reviewUrl,
    screenId: typeof value.screenId === 'string' ? value.screenId : 'unknown',
    viewportMode: typeof value.viewportMode === 'string' ? value.viewportMode : 'desktop'
  };
}

function createIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ogma Review</title>
  </head>
  <body>
    <div id="ogma-root"></div>
    <script type="module" src="/src/viewer/client.tsx"></script>
  </body>
</html>
`;
}

function createRuntimePlugin({
  config,
  packageRoot,
  project,
  status
}: {
  config: OgmaClientConfig;
  packageRoot: string;
  project: OgmaResolvedProject;
  status: OgmaServerStatus;
}): Plugin {
  const sourceRoot = path.join(packageRoot, 'src');
  const designModuleId = 'virtual:ogma-design';
  const configModuleId = 'virtual:ogma-config';
  const resolvedDesignModuleId = `\0${designModuleId}`;
  const resolvedConfigModuleId = `\0${configModuleId}`;

  return {
    name: 'ogma-runtime',
    resolveId(id) {
      if (id === designModuleId) {
        return resolvedDesignModuleId;
      }

      if (id === configModuleId) {
        return resolvedConfigModuleId;
      }

      return null;
    },
    load(id) {
      if (id === resolvedDesignModuleId) {
        const reviewImport = fsImportSpecifier(project.designEntry);
        const notesImport = `${fsImportSpecifier(project.notesPath)}?raw`;
        const normalizerImport = fsImportSpecifier(path.join(sourceRoot, 'viewer/normalizeReviewModule.ts'));

        return [
          `import * as reviewModule from ${JSON.stringify(reviewImport)};`,
          `import productNotes from ${JSON.stringify(notesImport)};`,
          `import { normalizeReviewModule } from ${JSON.stringify(normalizerImport)};`,
          'export const review = normalizeReviewModule(reviewModule, productNotes);'
        ].join('\n');
      }

      if (id === resolvedConfigModuleId) {
        return `export const runtimeConfig = ${JSON.stringify(config, null, 2)};`;
      }

      return null;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next: NextFunction) => {
        try {
          await handleRequest({ next, project, request, response, server, status });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    }
  };
}

async function handleRequest({
  next,
  project,
  request,
  response,
  server,
  status
}: {
  next: NextFunction;
  project: OgmaResolvedProject;
  request: IncomingMessage;
  response: ServerResponse;
  server: ViteDevServer;
  status: OgmaServerStatus;
}) {
  const url = new URL(request.url ?? '/', 'http://ogma.local');

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/review')) {
    const html = await server.transformIndexHtml(url.pathname, createIndexHtml());
    sendText(response, 200, html, 'text/html');
    return;
  }

  if (!url.pathname.startsWith('/api/ogma')) {
    next();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/ogma/status') {
    sendJson(response, 200, status);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/ogma/session') {
    sendJson(response, 200, await readSession(project));
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/ogma/session') {
    const session = sanitizeSession(JSON.parse(await readRequestBody(request)));
    await writeSession(project, session);
    sendJson(response, 200, session);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/ogma/feedback') {
    sendJson(response, 200, buildFeedbackExport(await readSession(project), status.reviewUrl));
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/ogma/feedback') {
    const session = sessionFromFeedbackExport(JSON.parse(await readRequestBody(request)));
    await writeSession(project, session);
    sendJson(response, 200, session);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/ogma/feedback/export') {
    const exportData = buildFeedbackExport(await readSession(project), status.reviewUrl);
    await writeFile(project.feedbackPath, `${JSON.stringify(exportData, null, 2)}\n`, 'utf8');
    sendJson(response, 200, {
      path: project.feedbackPath,
      feedback: exportData
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/ogma/history') {
    sendJson(response, 200, await readHistory(project));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/ogma/snapshots') {
    const snapshot = sanitizeSnapshot(JSON.parse(await readRequestBody(request)), status.reviewUrl);
    const fileName = `${snapshot.createdAt.replace(/[^0-9a-z]/gi, '-')}-${snapshot.screenId}.json`;
    const snapshotPath = path.join(project.snapshotsDir, fileName);

    await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    sendJson(response, 200, {
      path: snapshotPath,
      snapshot
    });
    return;
  }

  sendJson(response, 404, {
    error: `Unknown Ogma API route: ${request.method ?? 'GET'} ${url.pathname}`
  });
}

function openBrowser(url: string) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();
}

function resolveReviewUrl(server: ViteDevServer) {
  const localUrl = server.resolvedUrls?.local[0] ?? 'http://localhost:4317/';
  return new URL('/review', localUrl).toString();
}

export function getPackageRootFromImportMeta(metaUrl: string) {
  return path.dirname(path.dirname(fileURLToPath(metaUrl)));
}

export async function startOgmaServer(options: OgmaStartOptions) {
  const project = await ensureOgmaProject({
    cwd: options.cwd,
    review: options.review
  });
  const requireFromPackage = createRequire(path.join(options.packageRoot, 'package.json'));
  const version = await readPackageVersion(options.packageRoot);
  const startedAt = nowIso();
  const runtimeConfig: OgmaClientConfig = {
    cwd: options.cwd,
    dataDir: project.dataDir,
    defaultDesignDir: project.defaultDesignDir,
    reviewUrl: `http://localhost:${options.port}/review`,
    skillUrl: options.skillUrl ?? DEFAULT_SKILL_URL,
    serverStartedAt: startedAt
  };
  const status: OgmaServerStatus = {
    packageName: '@hcgstudio/ogma',
    version,
    cwd: options.cwd,
    dataDir: project.dataDir,
    designEntry: project.designEntry,
    historyPath: project.historyPath,
    notesPath: project.notesPath,
    reviewUrl: runtimeConfig.reviewUrl,
    skillUrl: runtimeConfig.skillUrl,
    snapshotsDir: project.snapshotsDir,
    serverStartedAt: startedAt
  };
  const server = await createServer({
    appType: 'custom',
    clearScreen: false,
    plugins: [
      createRuntimePlugin({
        config: runtimeConfig,
        packageRoot: options.packageRoot,
        project,
        status
      })
    ],
    resolve: {
      alias: [
        {
          find: '@hcgstudio/ogma/styles.css',
          replacement: path.join(options.packageRoot, 'src/viewer/styles.css')
        },
        {
          find: '@hcgstudio/ogma',
          replacement: path.join(options.packageRoot, 'src/index.ts')
        },
        {
          find: 'react/jsx-runtime',
          replacement: requireFromPackage.resolve('react/jsx-runtime')
        },
        {
          find: 'react/jsx-dev-runtime',
          replacement: requireFromPackage.resolve('react/jsx-dev-runtime')
        },
        {
          find: 'react-dom/client',
          replacement: requireFromPackage.resolve('react-dom/client')
        },
        {
          find: 'react',
          replacement: requireFromPackage.resolve('react')
        },
        {
          find: 'lucide-react',
          replacement: requireFromPackage.resolve('lucide-react')
        }
      ],
      dedupe: ['@hcgstudio/ogma', 'react', 'react-dom', 'lucide-react']
    },
    root: options.packageRoot,
    server: {
      fs: {
        allow: [options.cwd, options.packageRoot, path.dirname(project.designEntry), project.dataDir]
      },
      host: options.host,
      port: options.port,
      strictPort: false
    }
  });

  await server.listen();

  runtimeConfig.reviewUrl = resolveReviewUrl(server);
  status.reviewUrl = runtimeConfig.reviewUrl;

  console.log('');
  console.log('Ogma review server ready');
  console.log(`  Review URL: ${status.reviewUrl}`);
  console.log(`  Skill URL:  ${status.skillUrl}`);
  console.log(`  Designs:    ${project.designEntry}`);
  console.log(`  Notes:      ${project.notesPath}`);
  console.log(`  Feedback:   ${project.sessionPath}`);
  console.log(`  History:    ${project.historyPath}`);
  console.log('');

  if (options.open) {
    openBrowser(status.reviewUrl);
  }

  return {
    project,
    reviewUrl: status.reviewUrl,
    server,
    status
  };
}

export async function assertPackageInstalledFromCwd(cwd: string) {
  const require = createRequire(path.join(cwd, 'package.json'));
  const missing: string[] = [];

  for (const specifier of ['react', 'react-dom/client', 'vite']) {
    try {
      require.resolve(specifier);
    } catch {
      missing.push(specifier);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing runtime dependencies: ${missing.join(', ')}. Run npm install -D @hcgstudio/ogma react react-dom vite.`
    );
  }
}

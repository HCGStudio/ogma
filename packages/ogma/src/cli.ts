#!/usr/bin/env node
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { OgmaResolvedProject } from './node/project.js';
import { DEFAULT_DESIGN_DIR, DEFAULT_SKILL_URL } from './node/templates.js';

interface ParsedArgs {
  command: string;
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('-') ? args.shift() ?? 'start' : 'start';
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];

    if (!item?.startsWith('--')) {
      continue;
    }

    const [rawName, rawValue] = item.slice(2).split('=', 2);
    const name = rawName ?? '';

    if (name.startsWith('no-')) {
      flags.set(name.slice(3), false);
      continue;
    }

    if (rawValue !== undefined) {
      flags.set(name, rawValue);
      continue;
    }

    const next = args[index + 1];

    if (next && !next.startsWith('--')) {
      flags.set(name, next);
      index += 1;
    } else {
      flags.set(name, true);
    }
  }

  return { command, flags };
}

function stringFlag(flags: Map<string, string | boolean>, name: string, fallback?: string) {
  const value = flags.get(name);
  return typeof value === 'string' ? value : fallback;
}

function numberFlag(flags: Map<string, string | boolean>, name: string, fallback: number) {
  const value = Number(stringFlag(flags, name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

function booleanFlag(flags: Map<string, string | boolean>, name: string, fallback: boolean) {
  const value = flags.get(name);
  return typeof value === 'boolean' ? value : fallback;
}

function displayPath(cwd: string, targetPath: string) {
  const relativePath = path.relative(cwd, targetPath);

  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
    ? relativePath
    : targetPath;
}

function printScaffoldResult(project: OgmaResolvedProject) {
  console.log('Ogma scaffold ready');

  if (project.createdPaths.length > 0) {
    console.log('  Created:');

    for (const createdPath of project.createdPaths) {
      console.log(`    - ${displayPath(project.cwd, createdPath)}`);
    }
  } else {
    console.log('  Created: none');
  }

  console.log(`  Designs:  ${displayPath(project.cwd, project.designEntry)}`);
  console.log(`  Notes:    ${displayPath(project.cwd, project.notesPath)}`);
  console.log(`  Feedback: ${displayPath(project.cwd, project.sessionPath)}`);
}

function printHelp() {
  console.log(`Ogma local design review

Usage:
  ogma scaffold [--review designs/ogma]
  ogma start [--review designs/ogma] [--port 4317] [--host localhost] [--no-open]
  ogma init [--review designs/ogma]
  ogma skill-url

Commands:
  scaffold  Create the JSX review scaffold and local Ogma data files.
  start      Create missing design files and launch the local review server.
  init       Alias for scaffold.
  skill-url  Print the public Ogma skill URL.

Options:
  --review <path>     Design directory or review entry file. Default: ${DEFAULT_DESIGN_DIR}
  --port <number>     Preferred local port. Default: 4317
  --host <host>       Host for the local server. Default: localhost
  --skill-url <url>   Override the URL shown to agents.
  --open / --no-open  Open the browser after startup. Default: --open
`);
}

async function checkRuntimeDependencies() {
  const major = Number(process.versions.node.split('.')[0] ?? '0');

  if (major < 18) {
    throw new Error('Ogma requires Node.js 18 or newer.');
  }

  const require = createRequire(path.join(packageRoot(), 'package.json'));
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

function packageRoot() {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (flags.has('help') || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'skill-url') {
    console.log(stringFlag(flags, 'skill-url', DEFAULT_SKILL_URL));
    return;
  }

  await checkRuntimeDependencies();

  const cwd = process.cwd();
  const review = stringFlag(flags, 'review');

  if (command === 'init' || command === 'scaffold') {
    const { ensureOgmaProject } = await import('./node/project.js');
    const project = await ensureOgmaProject({ cwd, review });
    printScaffoldResult(project);
    return;
  }

  if (command !== 'start') {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const { startOgmaServer } = await import('./node/server.js');

  await startOgmaServer({
    cwd,
    host: stringFlag(flags, 'host', 'localhost') ?? 'localhost',
    open: booleanFlag(flags, 'open', true),
    packageRoot: packageRoot(),
    port: numberFlag(flags, 'port', 4317),
    review,
    skillUrl: stringFlag(flags, 'skill-url', DEFAULT_SKILL_URL)
  });
}

main().catch((error: unknown) => {
  console.error('');
  console.error(`[ogma] ${error instanceof Error ? error.message : String(error)}`);
  console.error('');
  process.exitCode = 1;
});

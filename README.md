# Ogma

Ogma is an open-source, local-first design viewer for AI-assisted product design review.

The npm package is `@hcgstudio/ogma`. It provides a Node CLI, a local review server, a React JSX prototype viewer, pinned annotations, stable feedback IDs, a feedback queue, and a URL-based skill contract for Codex and Claude Code.

## For Human: Agent Skill

Install: Copy the following to your code agent:

```text
Install Skill: https://raw.githubusercontent.com/hcgstudio/ogma/main/docs/skills/ogma/SKILL.md
```

The skill explains how agents should create JSX screens, write product notes, install `@hcgstudio/ogma`, start the local review server, and preserve feedback IDs such as `OG-001` when applying edits.

## Install And Start

```bash
npm install -D @hcgstudio/ogma
npx ogma scaffold
npx ogma start
```

The default review URL is `http://localhost:4317/review`. `scaffold` creates missing Ogma files without overwriting existing work. `start` also creates missing files before launching the server:

- `designs/ogma/review.tsx` for JSX prototype screens
- `designs/ogma/product-notes.md` for product design notes
- `.ogma/session.json` for persisted annotations and feedback IDs

## Commands

```bash
npx ogma scaffold
npx ogma scaffold --review designs/ogma
npx ogma init
npx ogma start --review designs/ogma
npx ogma start --review designs/ogma --port 4317 --no-open
npx ogma skill-url
```

Feedback can be read from `.ogma/session.json` or `http://localhost:4317/api/ogma/feedback`.
Session history is stored in `.ogma/history.json`, and viewport snapshots are stored in `.ogma/snapshots`.

## Repository

```bash
corepack enable
yarn install
yarn typecheck
yarn dev
```

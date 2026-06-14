# @hcgstudio/ogma

Local-first design review for AI-generated React JSX prototypes.

```bash
npm install -D @hcgstudio/ogma
npx ogma scaffold
npx ogma start
```

Ogma creates `designs/ogma/review.tsx`, `designs/ogma/product-notes.md`, and `.ogma/session.json` when they do not exist. `scaffold` prepares those files without launching a server; `start` also creates missing files before opening `http://localhost:4317/review`.

## Agent Skill URL

Give this URL to Codex, Claude Code, or another coding agent:

```text
https://raw.githubusercontent.com/hcgstudio/ogma/main/docs/skills/ogma/SKILL.md
```

Install: Copy the following to your code agent:

```text
Read: https://raw.githubusercontent.com/hcgstudio/ogma/main/docs/skills/ogma/SKILL.md
```

The skill tells agents how to write JSX screens, update product notes, install Ogma, start the local server, and preserve feedback IDs such as `OG-001`.

## Commands

```bash
npx ogma scaffold
npx ogma scaffold --review designs/ogma
npx ogma init
npx ogma start --review designs/ogma
npx ogma skill-url
```

Feedback is stored locally in `.ogma/session.json`, exported for agents from `/api/ogma/feedback`, imported with `PUT /api/ogma/feedback`, tracked in `.ogma/history.json`, and snapshotted in `.ogma/snapshots`.

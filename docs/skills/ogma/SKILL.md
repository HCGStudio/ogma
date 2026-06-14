---
name: ogma-design-review
description: Create and revise JSX product prototypes for Ogma design review. Use when an agent needs to scaffold Ogma review files, generate reviewable React JSX screens, write product design notes, start @hcgstudio/ogma locally, hand a review URL to a human, or apply Ogma feedback IDs such as OG-001 after review.
---

# Ogma Design Review

Use Ogma when the user wants a local, AI-generated product prototype that a human can review with pinned feedback.

## Scaffold Workspace

Install Ogma if the project does not already have it:

```bash
npm install -D @hcgstudio/ogma
```

Create missing review files without overwriting existing work:

```bash
npx ogma scaffold --review designs/ogma
```

Use `npx ogma init --review designs/ogma` only for older Ogma versions; it is an alias for `scaffold`.

## Design Pass

1. Create or update `designs/ogma/review.tsx`.
2. Export a default `defineOgmaReview({ title, description, metadata, screens })`.
3. Put each reviewable state in `screens`, with a stable `id`, human title, optional description, and React component.
4. Write product rationale, states, constraints, and open decisions in `designs/ogma/product-notes.md`.
5. Use plain React JSX and local CSS/classes where useful. Keep the prototype inspectable and easy to patch.

Minimal `review.tsx`:

```tsx
import { defineOgmaReview } from '@hcgstudio/ogma';

function Dashboard() {
  return <main>Reviewable dashboard state</main>;
}

export default defineOgmaReview({
  title: 'Checkout redesign',
  metadata: {
    agent: 'codex',
    iteration: '1'
  },
  screens: [
    {
      id: 'dashboard',
      title: 'Dashboard',
      component: Dashboard
    }
  ]
});
```

## Start Review

Start the local review server:

```bash
npx ogma start --review designs/ogma
```

Give the user the printed review URL, usually `http://localhost:4317/review`.

## Feedback Loop

1. Read feedback from `.ogma/session.json` or `http://localhost:4317/api/ogma/feedback`.
2. Treat IDs such as `OG-001` as stable. Do not rename them.
3. Patch the matching JSX screen and update `designs/ogma/product-notes.md` when the product decision changes.
4. In the final response, list each feedback ID and the file or screen changed for it.
5. Leave addressed status changes to the reviewer unless the user explicitly asks you to update the queue file.

Use `.ogma/history.json` for local session history. Use `.ogma/snapshots` when the reviewer saved viewport snapshots.

## Codex Prompt

```text
Use the Ogma skill. Install @hcgstudio/ogma if needed, run npx ogma scaffold --review designs/ogma, create JSX screens in designs/ogma/review.tsx, write product notes in designs/ogma/product-notes.md, start npx ogma start --review designs/ogma, and give me the review URL.
```

## Claude Code Prompt

```text
Use the Ogma skill URL. Scaffold the Ogma review workspace, generate the prototype as React JSX screens plus product notes, run @hcgstudio/ogma locally for review, and preserve Ogma feedback IDs when applying edits.
```

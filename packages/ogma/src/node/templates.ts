export const DEFAULT_SKILL_URL =
  'https://raw.githubusercontent.com/hcgstudio/ogma/main/docs/skills/ogma/SKILL.md';

export const DEFAULT_DESIGN_DIR = 'designs/ogma';

export const DEFAULT_REVIEW_SOURCE = `import { defineOgmaReview, type OgmaPrototypeScreenProps } from '@hcgstudio/ogma';

function DashboardPrototype() {
  return (
    <div className="ogma-demo-screen">
      <aside className="ogma-demo-sidebar">
        <div className="ogma-demo-brand">O</div>
        <span className="ogma-demo-nav is-active">Overview</span>
        <span className="ogma-demo-nav">Signals</span>
        <span className="ogma-demo-nav">Queue</span>
        <span className="ogma-demo-nav">Settings</span>
      </aside>
      <main className="ogma-demo-content">
        <div className="ogma-demo-header">
          <div>
            <p>Dashboard</p>
            <h2>Atlas Brief</h2>
          </div>
          <button type="button">Review ready</button>
        </div>
        <div className="ogma-demo-grid">
          <section className="ogma-demo-card is-wide">
            <div className="ogma-demo-card-title" />
            <div className="ogma-demo-chart">
              {[42, 68, 53, 81, 61, 75, 88].map((value) => (
                <span key={value} style={{ height: \`\${value}%\` }} />
              ))}
            </div>
          </section>
          <section className="ogma-demo-card is-accent">
            <strong>91%</strong>
            <p>Review confidence</p>
          </section>
          <section className="ogma-demo-card">
            <div className="ogma-demo-list-row" />
            <div className="ogma-demo-list-row is-medium" />
            <div className="ogma-demo-list-row is-short" />
          </section>
          <section className="ogma-demo-card is-action">
            <strong>2</strong>
            <p>Copy edits before approval</p>
          </section>
        </div>
      </main>
    </div>
  );
}

function DesignSpecPrototype({ screen }: OgmaPrototypeScreenProps) {
  return (
    <div className="ogma-spec-screen">
      <header>
        <p>{screen.title}</p>
        <h2>Decision System</h2>
      </header>
      <div className="ogma-spec-grid">
        {['Information density', 'Review confidence', 'Agent handoff', 'Mobile parity'].map(
          (item, index) => (
            <section key={item}>
              <span>{\`0\${index + 1}\`}</span>
              <h3>{item}</h3>
              <p>Prototype state prepared for pinned reviewer feedback and agent follow-up.</p>
            </section>
          )
        )}
      </div>
    </div>
  );
}

function MobileNavigationPrototype() {
  return (
    <div className="ogma-mobile-screen">
      <div className="ogma-phone">
        <header>
          <span>Ogma</span>
          <button type="button">New</button>
        </header>
        <main>
          <section>
            <p>Mobile nav</p>
            <h2>Design queue</h2>
          </section>
          <div className="ogma-phone-list">
            <span />
            <span />
            <span />
          </div>
        </main>
        <nav>
          <span className="is-active" />
          <span />
          <span />
        </nav>
      </div>
    </div>
  );
}

export default defineOgmaReview({
  title: 'Ogma starter review',
  description: 'Replace these JSX screens with the product states the reviewer should inspect.',
  metadata: {
    agent: 'starter',
    iteration: '0',
    source: 'designs/ogma/review.tsx'
  },
  screens: [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Desktop review surface',
      component: DashboardPrototype
    },
    {
      id: 'design-spec',
      title: 'Design spec',
      description: 'Design rationale and product decisions',
      component: DesignSpecPrototype
    },
    {
      id: 'mobile-navigation',
      title: 'Mobile nav',
      description: 'Compact navigation state',
      component: MobileNavigationPrototype,
      width: 390
    }
  ]
});
`;

export const DEFAULT_PRODUCT_NOTES = `# Product Design Notes

## Intent

Replace this starter note with product-specific design rationale, interaction states, and open decisions.

## Review Loop

- Keep JSX prototype screens in this directory.
- Keep reviewer feedback IDs, such as OG-001, in agent change summaries.
- Update this file whenever the product direction changes.
`;

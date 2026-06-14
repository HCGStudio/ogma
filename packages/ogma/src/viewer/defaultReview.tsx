import type { OgmaReviewDefinition, OgmaPrototypeScreenProps } from '../types.js';

function DashboardScreen() {
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
                <span key={value} style={{ height: `${value}%` }} />
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

function DesignSpecScreen() {
  return (
    <div className="ogma-spec-screen">
      <header>
        <p>Design spec</p>
        <h2>Decision System</h2>
      </header>
      <div className="ogma-spec-grid">
        {['Information density', 'Review confidence', 'Agent handoff', 'Mobile parity'].map(
          (item, index) => (
            <section key={item}>
              <span>{`0${index + 1}`}</span>
              <h3>{item}</h3>
              <p>Prototype state prepared for pinned reviewer feedback and agent follow-up.</p>
            </section>
          )
        )}
      </div>
    </div>
  );
}

function CheckoutFlowScreen() {
  return (
    <div className="ogma-flow-screen">
      <header>
        <p>Checkout flow</p>
        <h2>Approve Plan</h2>
      </header>
      <div className="ogma-flow-columns">
        {['Cart', 'Review', 'Confirm'].map((step, index) => (
          <section key={step}>
            <span>{index + 1}</span>
            <h3>{step}</h3>
            <div className="ogma-flow-line" />
            <button type="button">{index === 2 ? 'Approve' : 'Continue'}</button>
          </section>
        ))}
      </div>
    </div>
  );
}

function MobileNavigationScreen() {
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

export function createDefaultOgmaReview(): OgmaReviewDefinition {
  return {
    title: 'Ogma starter review',
    description: 'A local starter review used until an agent writes project-specific JSX screens.',
    notes:
      'Use this starter review to confirm Ogma is running, then replace it with product-specific JSX screens and product notes in designs/ogma.',
    metadata: {
      source: 'ogma-default',
      updatedAt: new Date().toISOString()
    },
    screens: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        description: 'Main review workspace for desktop inspection.',
        component: DashboardScreen
      },
      {
        id: 'design-spec',
        title: 'Design spec',
        description: 'Product decisions and design rationale.',
        component: DesignSpecScreen
      },
      {
        id: 'checkout-flow',
        title: 'Checkout flow',
        description: 'Interaction state for a step-based product path.',
        component: CheckoutFlowScreen
      },
      {
        id: 'mobile-navigation',
        title: 'Mobile nav',
        description: 'Compact viewport state for mobile review.',
        component: MobileNavigationScreen,
        width: 390
      }
    ]
  };
}

export function MissingScreen({ screen }: OgmaPrototypeScreenProps) {
  return (
    <div className="ogma-empty-screen">
      <h2>{screen.title}</h2>
      <p>This screen is missing a React component export.</p>
    </div>
  );
}

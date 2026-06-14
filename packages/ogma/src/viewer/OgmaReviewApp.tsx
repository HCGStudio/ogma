import {
  Bot,
  Camera,
  CheckCircle2,
  CircleDot,
  Clipboard,
  Code2,
  Copy,
  Download,
  Eye,
  FileText,
  Laptop,
  MessageCirclePlus,
  MessageSquareText,
  MousePointer2,
  RefreshCcw,
  Send,
  Server,
  Settings2,
  Smartphone,
  Tablet,
  TerminalSquare,
  Upload
} from 'lucide-react';
import {
  Component,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type {
  OgmaAnnotation,
  OgmaAnnotationStatus,
  OgmaClientConfig,
  OgmaFeedbackExport,
  OgmaReviewDefinition,
  OgmaReviewSession,
  OgmaServerStatus,
  OgmaViewportSnapshot
} from '../types.js';

type WorkspaceView = 'setup' | 'review' | 'handoff' | 'feedback';
type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface OgmaReviewAppProps {
  config: OgmaClientConfig;
  review: OgmaReviewDefinition;
}

const API_ROOT = '/api/ogma';

const viewItems: Array<{ id: WorkspaceView; label: string; icon: typeof Eye }> = [
  { id: 'setup', label: 'Setup', icon: Settings2 },
  { id: 'review', label: 'Review', icon: Eye },
  { id: 'handoff', label: 'Agents', icon: Bot },
  { id: 'feedback', label: 'Feedback', icon: MessageSquareText }
];

const viewportItems: Array<{ id: ViewportMode; label: string; icon: typeof Laptop }> = [
  { id: 'desktop', label: 'Desktop', icon: Laptop },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'mobile', label: 'Mobile', icon: Smartphone }
];

function classNames(...names: Array<string | false | undefined>) {
  return names.filter(Boolean).join(' ');
}

function reviewIdFor(review: OgmaReviewDefinition) {
  return review.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ogma-review';
}

function nowIso() {
  return new Date().toISOString();
}

function nextFeedbackId(annotations: OgmaAnnotation[]) {
  const next =
    annotations.reduce((highest, annotation) => {
      const match = /^OG-(\d+)$/.exec(annotation.id);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0) + 1;

  return `OG-${next.toString().padStart(3, '0')}`;
}

function createFallbackSession(reviewId: string): OgmaReviewSession {
  return {
    reviewId,
    annotations: [],
    updatedAt: nowIso()
  };
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function writeJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json'
    },
    method: 'PUT'
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function buildFeedbackExport(
  reviewId: string,
  reviewUrl: string,
  annotations: OgmaAnnotation[]
): OgmaFeedbackExport {
  return {
    reviewId,
    generatedAt: nowIso(),
    reviewUrl,
    annotations: annotations.map((annotation) => ({
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

function buildAgentPrompt(exportData: OgmaFeedbackExport) {
  const activeItems = exportData.annotations.filter((item) => item.status !== 'addressed');
  const ids = activeItems.map((item) => item.id).join(', ') || 'no open feedback';

  return [
    'Use the Ogma feedback queue to update the JSX prototype and product notes.',
    `Review URL: ${exportData.reviewUrl}`,
    `Feedback IDs: ${ids}`,
    'Preserve each feedback ID in your change summary and mark which JSX screen changed.',
    '',
    JSON.stringify({ ...exportData, annotations: activeItems }, null, 2)
  ].join('\n');
}

interface BoundaryProps {
  boundaryKey: string;
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

class PrototypeErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidUpdate(previousProps: BoundaryProps) {
    if (previousProps.boundaryKey !== this.props.boundaryKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="ogma-render-error">
          <h2>Prototype render error</h2>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export function OgmaReviewApp({ config, review }: OgmaReviewAppProps) {
  const reviewId = useMemo(() => reviewIdFor(review), [review]);
  const [activeView, setActiveView] = useState<WorkspaceView>('review');
  const [activeScreenId, setActiveScreenId] = useState(review.screens[0]?.id ?? '');
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotations, setAnnotations] = useState<OgmaAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [serverStatus, setServerStatus] = useState<OgmaServerStatus | null>(null);
  const [notice, setNotice] = useState('Ready');

  useEffect(() => {
    const firstScreenId = review.screens[0]?.id ?? '';

    if (!review.screens.some((screen) => screen.id === activeScreenId)) {
      setActiveScreenId(firstScreenId);
    }
  }, [activeScreenId, review.screens]);

  useEffect(() => {
    let mounted = true;

    readJson<OgmaReviewSession>('/session')
      .then((session) => {
        if (!mounted) {
          return;
        }

        setAnnotations(session.annotations);
        setSelectedId(session.annotations[0]?.id ?? null);
        setSessionLoaded(true);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        const fallback = createFallbackSession(reviewId);
        setAnnotations(fallback.annotations);
        setSessionLoaded(true);
      });

    readJson<OgmaServerStatus>('/status')
      .then((status) => {
        if (mounted) {
          setServerStatus(status);
        }
      })
      .catch(() => {
        if (mounted) {
          setServerStatus(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [reviewId]);

  const saveSession = useCallback(
    async (nextAnnotations: OgmaAnnotation[]) => {
      const session: OgmaReviewSession = {
        reviewId,
        annotations: nextAnnotations,
        updatedAt: nowIso()
      };

      await writeJson<OgmaReviewSession>('/session', session);
    },
    [reviewId]
  );

  useEffect(() => {
    if (!sessionLoaded) {
      return undefined;
    }

    const handle = window.setTimeout(() => {
      saveSession(annotations).catch(() => setNotice('Session is local-only until the server API is reachable'));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [annotations, saveSession, sessionLoaded]);

  const activeScreen = review.screens.find((screen) => screen.id === activeScreenId) ?? review.screens[0];
  const activeAnnotations = annotations.filter((annotation) => annotation.screenId === activeScreen?.id);
  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId) ?? null;
  const counts = useMemo(
    () => ({
      addressed: annotations.filter((annotation) => annotation.status === 'addressed').length,
      open: annotations.filter((annotation) => annotation.status === 'open').length,
      queued: annotations.filter((annotation) => annotation.status === 'queued').length
    }),
    [annotations]
  );

  function mutateAnnotation(id: string, patch: Partial<OgmaAnnotation>) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === id ? { ...annotation, ...patch, updatedAt: nowIso() } : annotation
      )
    );
  }

  function addAnnotation(event: MouseEvent<HTMLDivElement>) {
    if (!annotationMode || !activeScreen) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest('[data-ogma-pin]')) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Number((((event.clientX - bounds.left) / bounds.width) * 100).toFixed(1));
    const y = Number((((event.clientY - bounds.top) / bounds.height) * 100).toFixed(1));
    const id = nextFeedbackId(annotations);
    const timestamp = nowIso();
    const annotation: OgmaAnnotation = {
      id,
      screenId: activeScreen.id,
      x: Math.min(98, Math.max(2, x)),
      y: Math.min(98, Math.max(2, y)),
      title: 'New review note',
      detail: 'Captured directly on the prototype.',
      status: 'open',
      action: `Update ${activeScreen.title} JSX and product notes for this feedback.`,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    setAnnotations((current) => [...current, annotation]);
    setSelectedId(id);
    setNotice(`${id} added`);
  }

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setNotice(`${label} copied`);
  }

  function selectAnnotation(annotation: OgmaAnnotation, view: WorkspaceView = 'review') {
    setSelectedId(annotation.id);
    setActiveScreenId(annotation.screenId);
    setActiveView(view);
  }

  function markSelectedAddressed() {
    if (selectedAnnotation) {
      mutateAnnotation(selectedAnnotation.id, { status: 'addressed' });
      setNotice(`${selectedAnnotation.id} marked addressed`);
    }
  }

  function sendEditsToAgent() {
    const queued = annotations.map((annotation) =>
      annotation.status === 'open'
        ? { ...annotation, status: 'queued' as const, updatedAt: nowIso() }
        : annotation
    );
    const exportData = buildFeedbackExport(reviewId, config.reviewUrl, queued);

    setAnnotations(queued);
    void copyText(buildAgentPrompt(exportData), 'Agent edit prompt');
  }

  function exportFeedback() {
    const exportData = buildFeedbackExport(reviewId, config.reviewUrl, annotations);
    void copyText(JSON.stringify(exportData, null, 2), 'Feedback JSON');
  }

  function importFeedback(text: string) {
    const parsed = JSON.parse(text) as OgmaFeedbackExport;
    const timestamp = nowIso();
    const imported = parsed.annotations.map((annotation) => ({
      id: annotation.id,
      screenId: annotation.screenId,
      x: annotation.location.x,
      y: annotation.location.y,
      title: annotation.title,
      detail: annotation.detail,
      status: annotation.status,
      action: annotation.action,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    setAnnotations(imported);
    setSelectedId(imported[0]?.id ?? null);
    setNotice(`${imported.length} feedback items imported`);
  }

  function saveSnapshot() {
    if (!activeScreen) {
      return;
    }

    const snapshot: OgmaViewportSnapshot = {
      id: `${Date.now()}`,
      annotations: activeAnnotations,
      createdAt: nowIso(),
      reviewId,
      reviewUrl: config.reviewUrl,
      screenId: activeScreen.id,
      viewportMode
    };

    postJson('/snapshots', snapshot)
      .then(() => setNotice('Viewport snapshot saved'))
      .catch(() => setNotice('Snapshot could not be saved'));
  }

  return (
    <div className="ogma-shell">
      <aside className="ogma-nav" aria-label="Ogma workspace">
        <div className="ogma-mark" aria-label="Ogma">
          <span>O</span>
        </div>
        <div className="ogma-nav-list">
          {viewItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={classNames('ogma-nav-item', activeView === item.id && 'is-active')}
                key={item.id}
                onClick={() => setActiveView(item.id)}
                title={item.label}
                type="button"
              >
                <Icon aria-hidden="true" size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="ogma-main">
        <header className="ogma-topbar">
          <div>
            <p className="ogma-eyebrow">@hcgstudio/ogma</p>
            <h1>{review.title}</h1>
          </div>
          <div className="ogma-topbar-actions">
            <div className={classNames('ogma-status-pill', serverStatus ? 'is-online' : 'is-offline')}>
              <CircleDot aria-hidden="true" size={15} />
              <span>{serverStatus ? 'server active' : 'local preview'}</span>
            </div>
            <button
              className="ogma-icon-button"
              onClick={() => void copyText(config.reviewUrl, 'Review URL')}
              title="Copy review URL"
              type="button"
            >
              <Copy aria-hidden="true" size={18} />
            </button>
            <button
              className="ogma-filled-button"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RefreshCcw aria-hidden="true" size={18} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {activeView === 'setup' && (
          <SetupView
            config={config}
            notice={notice}
            onCopy={copyText}
            serverStatus={serverStatus}
          />
        )}
        {activeView === 'review' && activeScreen && (
          <ReviewView
            activeAnnotations={activeAnnotations}
            activeScreen={activeScreen}
            annotationMode={annotationMode}
            counts={counts}
            onAddAnnotation={addAnnotation}
            onMarkAddressed={markSelectedAddressed}
            onMutateAnnotation={mutateAnnotation}
            onSaveSnapshot={saveSnapshot}
            onScreenChange={setActiveScreenId}
            onSelectAnnotation={selectAnnotation}
            onToggleAnnotationMode={() => setAnnotationMode((value) => !value)}
            onViewportChange={setViewportMode}
            review={review}
            selectedAnnotation={selectedAnnotation}
            viewportMode={viewportMode}
          />
        )}
        {activeView === 'handoff' && (
          <HandoffView config={config} onCopy={copyText} reviewUrl={config.reviewUrl} />
        )}
        {activeView === 'feedback' && (
          <FeedbackView
            annotations={annotations}
            counts={counts}
            onExportFeedback={exportFeedback}
            onImportFeedback={importFeedback}
            onSelectAnnotation={(annotation) => selectAnnotation(annotation, 'review')}
            onSendEdits={sendEditsToAgent}
            selectedId={selectedAnnotation?.id ?? null}
          />
        )}
      </main>
    </div>
  );
}

interface SetupViewProps {
  config: OgmaClientConfig;
  notice: string;
  onCopy: (value: string, label: string) => Promise<void>;
  serverStatus: OgmaServerStatus | null;
}

function SetupView({ config, notice, onCopy, serverStatus }: SetupViewProps) {
  const commands = [
    'npm install -D @hcgstudio/ogma',
    'npx ogma start',
    `npx ogma start --review ${config.defaultDesignDir}`
  ];

  return (
    <div className="ogma-workspace-grid ogma-setup-grid">
      <section className="ogma-panel">
        <div className="ogma-section-heading">
          <div>
            <p className="ogma-eyebrow">Local setup</p>
            <h2>Install, start, hand off</h2>
          </div>
          <button
            className="ogma-tonal-button"
            onClick={() => void onCopy(config.skillUrl, 'Skill URL')}
            type="button"
          >
            <Clipboard aria-hidden="true" size={18} />
            <span>Skill URL</span>
          </button>
        </div>

        <div className="ogma-command-stack">
          {commands.map((command) => (
            <CommandLine command={command} key={command} onCopy={onCopy} />
          ))}
        </div>
      </section>

      <aside className="ogma-side-panel">
        <div className="ogma-panel-title">
          <Server aria-hidden="true" size={20} />
          <h3>Runtime</h3>
        </div>
        <dl className="ogma-runtime-list">
          <div>
            <dt>Review URL</dt>
            <dd>{config.reviewUrl}</dd>
          </div>
          <div>
            <dt>Design directory</dt>
            <dd>{config.defaultDesignDir}</dd>
          </div>
          <div>
            <dt>Session store</dt>
            <dd>{config.dataDir}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{serverStatus ? 'Dependencies ready' : notice}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function CommandLine({
  command,
  onCopy
}: {
  command: string;
  onCopy: (value: string, label: string) => Promise<void>;
}) {
  return (
    <div className="ogma-command-line">
      <TerminalSquare aria-hidden="true" size={18} />
      <code>{command}</code>
      <button
        className="ogma-icon-button is-compact"
        onClick={() => void onCopy(command, 'Command')}
        title="Copy command"
        type="button"
      >
        <Copy aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

interface ReviewViewProps {
  activeAnnotations: OgmaAnnotation[];
  activeScreen: OgmaReviewDefinition['screens'][number];
  annotationMode: boolean;
  counts: Record<OgmaAnnotationStatus, number>;
  onAddAnnotation: (event: MouseEvent<HTMLDivElement>) => void;
  onMarkAddressed: () => void;
  onMutateAnnotation: (id: string, patch: Partial<OgmaAnnotation>) => void;
  onSaveSnapshot: () => void;
  onScreenChange: (screenId: string) => void;
  onSelectAnnotation: (annotation: OgmaAnnotation) => void;
  onToggleAnnotationMode: () => void;
  onViewportChange: (mode: ViewportMode) => void;
  review: OgmaReviewDefinition;
  selectedAnnotation: OgmaAnnotation | null;
  viewportMode: ViewportMode;
}

function ReviewView({
  activeAnnotations,
  activeScreen,
  annotationMode,
  counts,
  onAddAnnotation,
  onMarkAddressed,
  onMutateAnnotation,
  onSaveSnapshot,
  onScreenChange,
  onSelectAnnotation,
  onToggleAnnotationMode,
  onViewportChange,
  review,
  selectedAnnotation,
  viewportMode
}: ReviewViewProps) {
  const ScreenComponent = activeScreen.component;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [a11yIssueCount, setA11yIssueCount] = useState(0);
  const screenStyle = {
    '--ogma-screen-width': `${activeScreen.width ?? 1040}px`
  } as CSSProperties;

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const unlabeledControls = Array.from(frame.querySelectorAll('button, a')).filter((control) => {
      const element = control as HTMLElement;
      const hasName =
        element.textContent?.trim() ||
        element.getAttribute('aria-label') ||
        element.getAttribute('title');

      return !hasName;
    });
    const imagesWithoutAlt = Array.from(frame.querySelectorAll('img')).filter(
      (image) => !(image as HTMLImageElement).alt
    );

    setA11yIssueCount(unlabeledControls.length + imagesWithoutAlt.length);
  }, [activeAnnotations.length, activeScreen.id]);

  return (
    <div className="ogma-workspace-grid ogma-review-grid">
      <section className="ogma-canvas-panel">
        <div className="ogma-review-toolbar">
          <div className="ogma-segmented-control" aria-label="Prototype screen">
            {review.screens.map((screen) => (
              <button
                className={classNames(activeScreen.id === screen.id && 'is-active')}
                key={screen.id}
                onClick={() => onScreenChange(screen.id)}
                type="button"
              >
                {screen.title}
              </button>
            ))}
          </div>
          <div className="ogma-tool-strip">
            {viewportItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  aria-pressed={viewportMode === item.id}
                  className={classNames('ogma-icon-button', viewportMode === item.id && 'is-active')}
                  key={item.id}
                  onClick={() => onViewportChange(item.id)}
                  title={item.label}
                  type="button"
                >
                  <Icon aria-hidden="true" size={18} />
                </button>
              );
            })}
            <button
              aria-pressed={!annotationMode}
              className={classNames('ogma-icon-button', !annotationMode && 'is-active')}
              onClick={onToggleAnnotationMode}
              title="Pointer"
              type="button"
            >
              <MousePointer2 aria-hidden="true" size={18} />
            </button>
            <button
              aria-pressed={annotationMode}
              className={classNames('ogma-icon-button', annotationMode && 'is-active')}
              onClick={onToggleAnnotationMode}
              title="Add annotation"
              type="button"
            >
              <MessageCirclePlus aria-hidden="true" size={18} />
            </button>
            <button
              className="ogma-icon-button"
              onClick={onSaveSnapshot}
              title="Save viewport snapshot"
              type="button"
            >
              <Camera aria-hidden="true" size={18} />
            </button>
            <div className={classNames('ogma-a11y-pill', a11yIssueCount === 0 && 'is-clear')}>
              <span>A11y</span>
              <strong>{a11yIssueCount}</strong>
            </div>
          </div>
        </div>

        <div
          className={classNames('ogma-prototype-stage', `is-${viewportMode}`, annotationMode && 'is-annotating')}
          onClick={onAddAnnotation}
          role="presentation"
          style={screenStyle}
        >
          <div className="ogma-prototype-frame" ref={frameRef}>
            <PrototypeErrorBoundary boundaryKey={activeScreen.id}>
              <ScreenComponent review={review} screen={activeScreen} />
            </PrototypeErrorBoundary>
            {activeAnnotations.map((annotation) => (
              <button
                className={classNames(
                  'ogma-annotation-pin',
                  `is-${annotation.status}`,
                  selectedAnnotation?.id === annotation.id && 'is-selected'
                )}
                data-ogma-pin=""
                key={annotation.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectAnnotation(annotation);
                }}
                style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
                title={annotation.title}
                type="button"
              >
                {annotation.id.replace('OG-', '')}
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="ogma-side-panel">
        <div className="ogma-panel-title">
          <MessageSquareText aria-hidden="true" size={20} />
          <h3>Annotation queue</h3>
        </div>
        <div className="ogma-metric-row">
          <Metric label="Open" value={counts.open} tone="open" />
          <Metric label="Queued" value={counts.queued} tone="queued" />
          <Metric label="Addressed" value={counts.addressed} tone="addressed" />
        </div>
        {selectedAnnotation ? (
          <AnnotationEditor
            annotation={selectedAnnotation}
            onMarkAddressed={onMarkAddressed}
            onMutateAnnotation={onMutateAnnotation}
          />
        ) : (
          <div className="ogma-empty-state">
            <MessageCirclePlus aria-hidden="true" size={22} />
            <p>No annotation selected.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Metric({
  label,
  tone,
  value
}: {
  label: string;
  tone: OgmaAnnotationStatus;
  value: number;
}) {
  return (
    <div className={classNames('ogma-metric', `is-${tone}`)}>
      <strong>{value.toString().padStart(2, '0')}</strong>
      <span>{label}</span>
    </div>
  );
}

function AnnotationEditor({
  annotation,
  onMarkAddressed,
  onMutateAnnotation
}: {
  annotation: OgmaAnnotation;
  onMarkAddressed: () => void;
  onMutateAnnotation: (id: string, patch: Partial<OgmaAnnotation>) => void;
}) {
  return (
    <article className="ogma-annotation-editor">
      <div className="ogma-editor-topline">
        <span className={classNames('ogma-status-dot', `is-${annotation.status}`)} />
        <strong>{annotation.id}</strong>
        <span>{annotation.screenId}</span>
      </div>
      <label>
        <span>Title</span>
        <input
          onChange={(event) => onMutateAnnotation(annotation.id, { title: event.target.value })}
          value={annotation.title}
        />
      </label>
      <label>
        <span>Detail</span>
        <textarea
          onChange={(event) => onMutateAnnotation(annotation.id, { detail: event.target.value })}
          rows={4}
          value={annotation.detail}
        />
      </label>
      <label>
        <span>Expected agent action</span>
        <textarea
          onChange={(event) => onMutateAnnotation(annotation.id, { action: event.target.value })}
          rows={3}
          value={annotation.action}
        />
      </label>
      <label>
        <span>Status</span>
        <select
          onChange={(event) =>
            onMutateAnnotation(annotation.id, {
              status: event.target.value as OgmaAnnotationStatus
            })
          }
          value={annotation.status}
        >
          <option value="open">Open</option>
          <option value="queued">Queued</option>
          <option value="addressed">Addressed</option>
        </select>
      </label>
      <div className="ogma-editor-actions">
        <button className="ogma-tonal-button" onClick={onMarkAddressed} type="button">
          <CheckCircle2 aria-hidden="true" size={18} />
          <span>Addressed</span>
        </button>
        <button
          className="ogma-icon-button"
          onClick={() => void navigator.clipboard.writeText(annotation.id)}
          title="Copy feedback ID"
          type="button"
        >
          <Copy aria-hidden="true" size={17} />
        </button>
      </div>
    </article>
  );
}

function HandoffView({
  config,
  onCopy,
  reviewUrl
}: {
  config: OgmaClientConfig;
  onCopy: (value: string, label: string) => Promise<void>;
  reviewUrl: string;
}) {
  const prompts = [
    {
      agent: 'Codex',
      body: `Install/read the Ogma skill from ${config.skillUrl}. Create JSX screens in ${config.defaultDesignDir}, update product notes, install @hcgstudio/ogma if needed, start the review server, and give me the review URL.`
    },
    {
      agent: 'Claude Code',
      body: `Use the Ogma skill at ${config.skillUrl}. Generate the prototype as JSX screens plus product notes, run @hcgstudio/ogma locally, and preserve Ogma feedback IDs when applying reviewer edits.`
    },
    {
      agent: 'Tool-agnostic',
      body: `Follow the Ogma contract: JSX screens, product notes, review metadata, local server, stable feedback IDs, and a final review URL. Current review URL: ${reviewUrl}`
    }
  ];

  return (
    <div className="ogma-workspace-grid ogma-handoff-grid">
      <section className="ogma-panel">
        <div className="ogma-section-heading">
          <div>
            <p className="ogma-eyebrow">Agent handoff</p>
            <h2>Codex and Claude Code prompts</h2>
          </div>
          <button
            className="ogma-filled-button"
            onClick={() => void onCopy(config.skillUrl, 'Skill URL')}
            type="button"
          >
            <Copy aria-hidden="true" size={18} />
            <span>Copy URL</span>
          </button>
        </div>
        <div className="ogma-agent-grid">
          {prompts.map((prompt) => (
            <article className="ogma-agent-card" key={prompt.agent}>
              <div className="ogma-agent-card-top">
                <Bot aria-hidden="true" size={20} />
                <h3>{prompt.agent}</h3>
              </div>
              <p>{prompt.body}</p>
              <button
                className="ogma-tonal-button"
                onClick={() => void onCopy(prompt.body, `${prompt.agent} prompt`)}
                type="button"
              >
                <Clipboard aria-hidden="true" size={18} />
                <span>Copy prompt</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <aside className="ogma-side-panel">
        <div className="ogma-panel-title">
          <Code2 aria-hidden="true" size={20} />
          <h3>Contract</h3>
        </div>
        <div className="ogma-contract-list">
          {[
            'JSX prototype screens',
            'Product design notes',
            'Review metadata',
            'Feedback IDs in edits'
          ].map((item, index) => (
            <div className="ogma-contract-item" key={item}>
              <span>{index + 1}</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function FeedbackView({
  annotations,
  counts,
  onExportFeedback,
  onImportFeedback,
  onSelectAnnotation,
  onSendEdits,
  selectedId
}: {
  annotations: OgmaAnnotation[];
  counts: Record<OgmaAnnotationStatus, number>;
  onExportFeedback: () => void;
  onImportFeedback: (text: string) => void;
  onSelectAnnotation: (annotation: OgmaAnnotation) => void;
  onSendEdits: () => void;
  selectedId: string | null;
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="ogma-workspace-grid ogma-feedback-grid">
      <section className="ogma-panel">
        <div className="ogma-section-heading">
          <div>
            <p className="ogma-eyebrow">Feedback queue</p>
            <h2>Agent-ready review notes</h2>
          </div>
          <div className="ogma-inline-actions">
            <input
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';

                if (!file) {
                  return;
                }

                file
                  .text()
                  .then(onImportFeedback)
                  .catch(() => undefined);
              }}
              ref={importInputRef}
              type="file"
            />
            <button
              className="ogma-tonal-button"
              onClick={() => importInputRef.current?.click()}
              type="button"
            >
              <Upload aria-hidden="true" size={18} />
              <span>Import JSON</span>
            </button>
            <button className="ogma-tonal-button" onClick={onExportFeedback} type="button">
              <Download aria-hidden="true" size={18} />
              <span>Export JSON</span>
            </button>
            <button className="ogma-filled-button" onClick={onSendEdits} type="button">
              <Send aria-hidden="true" size={18} />
              <span>Send edits</span>
            </button>
          </div>
        </div>
        <div className="ogma-feedback-table" role="table">
          <div className="ogma-feedback-row is-heading" role="row">
            <span>ID</span>
            <span>Location</span>
            <span>Status</span>
            <span>Expected action</span>
          </div>
          {annotations.map((annotation) => (
            <button
              className={classNames('ogma-feedback-row', selectedId === annotation.id && 'is-selected')}
              key={annotation.id}
              onClick={() => onSelectAnnotation(annotation)}
              role="row"
              type="button"
            >
              <span>{annotation.id}</span>
              <span>{annotation.title}</span>
              <span className={classNames('ogma-status-chip', `is-${annotation.status}`)}>
                {annotation.status}
              </span>
              <span>{annotation.action}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="ogma-side-panel">
        <div className="ogma-panel-title">
          <FileText aria-hidden="true" size={20} />
          <h3>Summary</h3>
        </div>
        <div className="ogma-summary-list">
          <Metric label="Open notes" value={counts.open} tone="open" />
          <Metric label="AI edits" value={counts.queued} tone="queued" />
          <Metric label="Accepted" value={counts.addressed} tone="addressed" />
        </div>
      </aside>
    </div>
  );
}

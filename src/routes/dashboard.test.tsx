import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { getVerdict } from "@/lib/apgar";
import { PROCRASTINATION_TYPES, type ProcrastinationType } from "@/lib/procrastination";

// ── Firebase mocks ────────────────────────────────────────────────────────────

const mockGetDocs = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("firebase/firestore", () => ({
  collection: vi.fn().mockReturnValue("col-ref"),
  query: vi.fn().mockReturnValue("query-ref"),
  where: vi.fn().mockReturnValue("where-ref"),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: vi.fn().mockReturnValue("doc-ref"),
  getDoc: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
  getAuth: vi.fn().mockReturnValue({}),
  onAuthStateChanged: vi.fn(),
}));

vi.mock("@/integrations/firebase/client", () => ({
  auth: {},
  db: {},
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => ({ component: (c: unknown) => c }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeApgarResult = (id: string, score: number, daysAgo = 0) => ({
  id,
  score,
  scores: { A1: 2, P: 2, G: 1, A2: 1, R: 0 },
  createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

const makeProcResult = (types: ProcrastinationType[], daysAgo = 0) => ({
  id: "proc-1",
  types,
  createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

const makeSnapshot = (docs: { id: string; [k: string]: unknown }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d })),
});

// ── Minimal Dashboard ─────────────────────────────────────────────────────────

interface ApgarResult { id: string; score: number; scores: Record<string, number>; createdAt: string }
interface ProcResult { id: string; types: string[]; createdAt: string }

function Dashboard() {
  const { user, loading, displayName, isAdmin } = mockUseAuth();
  const [results, setResults] = useState<ApgarResult[]>([]);
  const [procResults, setProcResults] = useState<ProcResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      mockGetDocs("apgar_results"),
      mockGetDocs("procrastination_results"),
    ]).then(([apgarSnap, procSnap]: [ReturnType<typeof makeSnapshot>, ReturnType<typeof makeSnapshot>]) => {
      setResults(apgarSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ApgarResult)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setProcResults(procSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ProcResult)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoadingResults(false);
    });
  }, [user]);

  const lastProcrastination = procResults[0] ?? null;

  if (loading || !user) return null;

  return (
    <div>
      <h1>{displayName || user.email}</h1>
      {isAdmin && <a href="/admin" aria-label="Администрирование">admin</a>}

      <section aria-label="APGAR карточка">
        <p>APGAR-тест</p>
        <a href="/test">Пройти тест</a>
      </section>

      <section aria-label="Прокрастинация карточка">
        <p>Тип прокрастинатора</p>
        {lastProcrastination ? (
          <>
            {(lastProcrastination.types as ProcrastinationType[]).map((t) => (
              <span key={t} data-testid="proc-emoji">{PROCRASTINATION_TYPES[t]?.emoji}</span>
            ))}
            <p data-testid="proc-title">
              {(lastProcrastination.types as ProcrastinationType[]).map((t) => PROCRASTINATION_TYPES[t]?.title).join(" + ")}
            </p>
            <a href="/procrastination">Пройти снова</a>
          </>
        ) : (
          <>
            <p>Узнайте свой тип</p>
            <a href="/procrastination">Пройти тест</a>
          </>
        )}
      </section>

      <section aria-label="Рекомендации">
        <h2>Рекомендации</h2>
        {!results[0] && !procResults[0] ? (
          <p data-testid="advice-empty">Пройдите хотя бы один тест, чтобы получить персональные рекомендации.</p>
        ) : (
          <div>
            {results[0] && (() => {
              const v = getVerdict(results[0].score);
              return (
                <div data-testid="apgar-advice">
                  <span data-testid="advice-score">{results[0].score}</span>
                  <span data-testid="advice-verdict">{v.short}</span>
                  <p data-testid="advice-description">{v.description}</p>
                </div>
              );
            })()}
            {procResults[0] && (() => {
              const types = procResults[0].types as ProcrastinationType[];
              const info = PROCRASTINATION_TYPES[types[0]];
              return (
                <div data-testid="proc-advice">
                  <span data-testid="advice-proc-emoji">{info.emoji}</span>
                  <span data-testid="advice-proc-title">{types.map((t) => PROCRASTINATION_TYPES[t].title).join(" + ")}</span>
                  {info.tools.map((tool, i) => <p key={i} data-testid="advice-tool">{tool}</p>)}
                </div>
              );
            })()}
          </div>
        )}
      </section>

      <section aria-label="История прохождений">
        <h2>История APGAR</h2>
        {loadingResults ? (
          <p>Загрузка...</p>
        ) : results.length === 0 ? (
          <p>Пока нет результатов — пройдите первый тест!</p>
        ) : (
          <ul>
            {results.map((r) => {
              const v = getVerdict(r.score);
              return (
                <li key={r.id}>
                  <span data-testid={`score-${r.id}`}>{r.score}</span>
                  <span>{v.short}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="История прокрастинатора">
        <h2>История типа прокрастинатора</h2>
        {loadingResults ? (
          <p>Загрузка...</p>
        ) : procResults.length === 0 ? (
          <p data-testid="proc-history-empty">Пока нет результатов — пройдите тест!</p>
        ) : (
          <ul>
            {procResults.map((r) => {
              const types = r.types as ProcrastinationType[];
              return (
                <li key={r.id}>
                  <span data-testid="proc-history-emoji">{types.map((t) => PROCRASTINATION_TYPES[t]?.emoji).join("")}</span>
                  <span data-testid="proc-history-title">{types.map((t) => PROCRASTINATION_TYPES[t]?.title).join(" + ")}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { uid: "user-123", email: "test@example.com" },
    loading: false,
    displayName: "Тест Юзер",
    isAdmin: false,
  });
  mockGetDocs.mockResolvedValue(makeSnapshot([]));
});

// ── Two-card layout ───────────────────────────────────────────────────────────

describe("Dashboard — two test cards", () => {
  it("renders the APGAR card section", () => {
    render(<Dashboard />);
    expect(screen.getByRole("region", { name: "APGAR карточка" })).toBeInTheDocument();
  });

  it("renders the procrastination card section", () => {
    render(<Dashboard />);
    expect(screen.getByRole("region", { name: "Прокрастинация карточка" })).toBeInTheDocument();
  });

  it("APGAR card has a link to /test", () => {
    render(<Dashboard />);
    expect(screen.getAllByRole("link", { name: /пройти тест/i }).some((l) => l.getAttribute("href") === "/test")).toBe(true);
  });
});

// ── Procrastination card — no result ─────────────────────────────────────────

describe("Dashboard — procrastination card (no previous result)", () => {
  it("shows 'Узнайте свой тип' when no procrastination result", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Узнайте свой тип")).toBeInTheDocument());
  });

  it("shows 'Пройти тест' link to /procrastination", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /пройти тест/i }).some((l) => l.getAttribute("href") === "/procrastination")).toBe(true);
    });
  });

  it("does NOT show 'Пройти снова' when no result", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByText("Пройти снова")).not.toBeInTheDocument());
  });
});

// ── Procrastination card — has result ────────────────────────────────────────

describe("Dashboard — procrastination card (has previous result)", () => {
  beforeEach(() => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([makeProcResult(["cleaner"])]));
      return Promise.resolve(makeSnapshot([]));
    });
  });

  it("shows the type emoji", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("proc-emoji").textContent).toBe(PROCRASTINATION_TYPES["cleaner"].emoji));
  });

  it("shows the type title", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("proc-title").textContent).toBe(PROCRASTINATION_TYPES["cleaner"].title));
  });

  it("shows 'Пройти снова' link to /procrastination", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Пройти снова" });
      expect(link).toHaveAttribute("href", "/procrastination");
    });
  });

  it("does NOT show 'Узнайте свой тип' when result exists", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByText("Узнайте свой тип")).not.toBeInTheDocument());
  });

  it("shows both emojis when two types tied", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([makeProcResult(["cleaner", "panicker"])]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByTestId("proc-emoji")).toHaveLength(2));
  });

  it("shows 'Type1 + Type2' title for tied result", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([makeProcResult(["cleaner", "panicker"])]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("proc-title").textContent).toBe(
        `${PROCRASTINATION_TYPES["cleaner"].title} + ${PROCRASTINATION_TYPES["panicker"].title}`,
      );
    });
  });
});

// ── APGAR history section ─────────────────────────────────────────────────────

describe("Dashboard — APGAR history", () => {
  it("shows 'Загрузка...' initially", () => {
    mockGetDocs.mockReturnValue(new Promise(() => {}));
    render(<Dashboard />);
    expect(within(screen.getByRole("region", { name: "История прохождений" })).getByText(/загрузка/i)).toBeInTheDocument();
  });

  it("shows empty-state when user has no APGAR results", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(within(screen.getByRole("region", { name: "История прохождений" })).getByText(/пока нет результатов/i)).toBeInTheDocument();
    });
  });

  it("renders a list item for each APGAR result", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "apgar_results") return Promise.resolve(makeSnapshot([makeApgarResult("r1", 10), makeApgarResult("r2", 5)]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(within(screen.getByRole("region", { name: "История прохождений" })).getAllByRole("listitem")).toHaveLength(2);
    });
  });

  it("displays correct score for each result", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "apgar_results") return Promise.resolve(makeSnapshot([makeApgarResult("r1", 10), makeApgarResult("r2", 5)]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("score-r1").textContent).toBe("10");
      expect(screen.getByTestId("score-r2").textContent).toBe("5");
    });
  });

  it("shows 'Рутинная поддержка' in APGAR history for score 10", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "apgar_results") return Promise.resolve(makeSnapshot([makeApgarResult("r1", 10)]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(within(screen.getByRole("region", { name: "История прохождений" })).getByText(/рутинная поддержка/i)).toBeInTheDocument();
    });
  });
});

// ── Advice panel ─────────────────────────────────────────────────────────────

describe("Dashboard — advice panel", () => {
  it("shows empty-state when no tests taken", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("advice-empty")).toBeInTheDocument());
  });

  it("shows APGAR advice block when has APGAR result", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "apgar_results") return Promise.resolve(makeSnapshot([makeApgarResult("r1", 10)]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("apgar-advice")).toBeInTheDocument());
  });

  it("advice shows correct APGAR score", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "apgar_results") return Promise.resolve(makeSnapshot([makeApgarResult("r1", 8)]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("advice-score").textContent).toBe("8"));
  });

  it("advice shows verdict label", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "apgar_results") return Promise.resolve(makeSnapshot([makeApgarResult("r1", 10)]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("advice-verdict").textContent).toMatch(/рутинная поддержка/i));
  });

  it("shows procrastination advice block when has proc result", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([makeProcResult(["cleaner"])]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("proc-advice")).toBeInTheDocument());
  });

  it("proc advice shows type emoji", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([makeProcResult(["cleaner"])]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("advice-proc-emoji").textContent).toBe(PROCRASTINATION_TYPES["cleaner"].emoji));
  });

  it("proc advice shows exactly 3 tools", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([makeProcResult(["cleaner"])]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByTestId("advice-tool")).toHaveLength(3));
  });

  it("shows both APGAR and proc advice when both tests taken", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "apgar_results") return Promise.resolve(makeSnapshot([makeApgarResult("r1", 7)]));
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([makeProcResult(["timer"])]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("apgar-advice")).toBeInTheDocument();
      expect(screen.getByTestId("proc-advice")).toBeInTheDocument();
    });
  });
});

// ── Procrastination history ───────────────────────────────────────────────────

describe("Dashboard — procrastination history", () => {
  it("shows empty-state when no proc results", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("proc-history-empty")).toBeInTheDocument());
  });

  it("renders a list item for each procrastination result", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([
        { id: "p1", types: ["cleaner"], createdAt: new Date().toISOString() },
        { id: "p2", types: ["panicker"], createdAt: new Date().toISOString() },
      ]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByTestId("proc-history-emoji")).toHaveLength(2));
  });

  it("shows correct emoji for each history item", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([
        { id: "p1", types: ["cleaner"], createdAt: new Date().toISOString() },
      ]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("proc-history-emoji").textContent).toBe(PROCRASTINATION_TYPES["cleaner"].emoji));
  });

  it("shows correct title for each history item", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "procrastination_results") return Promise.resolve(makeSnapshot([
        { id: "p1", types: ["sleeper"], createdAt: new Date().toISOString() },
      ]));
      return Promise.resolve(makeSnapshot([]));
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("proc-history-title").textContent).toBe(PROCRASTINATION_TYPES["sleeper"].title));
  });
});

// ── Admin link ────────────────────────────────────────────────────────────────

describe("Dashboard — admin link", () => {
  it("does NOT show admin link for regular user", () => {
    render(<Dashboard />);
    expect(screen.queryByRole("link", { name: /администрирование/i })).not.toBeInTheDocument();
  });

  it("shows admin link when isAdmin=true", () => {
    mockUseAuth.mockReturnValue({ user: { uid: "u1", email: "admin@example.com" }, loading: false, displayName: "Admin", isAdmin: true });
    render(<Dashboard />);
    expect(screen.getByRole("link", { name: /администрирование/i })).toBeInTheDocument();
  });
});

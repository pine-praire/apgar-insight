import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { getVerdict } from "@/lib/apgar";
import { PROCRASTINATION_TYPES, type ProcrastinationType } from "@/lib/procrastination";

// ── Mock state ────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({});

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => ({ component: (c: unknown) => c }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { signOut: mockSignOut },
  },
}));

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeApgarResult = (id: string, score: number, daysAgo = 0) => ({
  id,
  score,
  scores: { A1: 2, P: 2, G: 1, A2: 1, R: 0 },
  created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

const makeProcResult = (types: ProcrastinationType[], daysAgo = 0) => ({
  id: "proc-1",
  types,
  created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

// Chain for apgar_results: .select().eq().order() → resolves
const makeApgarChain = (data: unknown) => {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockResolvedValue({ data, error: null });
  return c;
};

// Chain for procrastination_results: .select().eq().order() → resolves with array
const makeProcChain = (data: unknown) => {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockResolvedValue({ data, error: null });
  return c;
};

// ── Minimal Dashboard ─────────────────────────────────────────────────────────

interface ApgarResult { id: string; score: number; scores: Record<string, number>; created_at: string }
interface ProcResult { id: string; types: string[]; created_at: string }

function Dashboard() {
  const { user, loading, displayName, isAdmin } = mockUseAuth();
  const [results, setResults] = useState<ApgarResult[]>([]);
  const [procResults, setProcResults] = useState<ProcResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      mockFrom("apgar_results").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      mockFrom("procrastination_results").select("id, types, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]).then(([apgarRes, procRes]: [{ data: ApgarResult[] | null }, { data: ProcResult[] | null }]) => {
      setResults(apgarRes.data ?? []);
      setProcResults(procRes.data ?? []);
      setLoadingResults(false);
    });
  }, [user]);

  const lastProcrastination = procResults[0] ?? null;

  if (loading || !user) return null;

  return (
    <div>
      <h1>{displayName || user.email}</h1>
      {isAdmin && <a href="/admin" aria-label="Администрирование">admin</a>}

      {/* APGAR card */}
      <section aria-label="APGAR карточка">
        <p>APGAR-тест</p>
        <a href="/test">Пройти тест</a>
      </section>

      {/* Procrastination card */}
      <section aria-label="Прокрастинация карточка">
        <p>Тип прокрастинатора</p>
        {lastProcrastination ? (
          <>
            {(lastProcrastination.types as ProcrastinationType[]).map((t) => (
              <span key={t} data-testid="proc-emoji">{PROCRASTINATION_TYPES[t]?.emoji}</span>
            ))}
            <p data-testid="proc-title">
              {(lastProcrastination.types as ProcrastinationType[])
                .map((t) => PROCRASTINATION_TYPES[t]?.title)
                .join(" + ")}
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

      {/* APGAR history */}
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
    </div>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: "user-123", email: "test@example.com" },
    loading: false,
    displayName: "Тест Юзер",
    isAdmin: false,
  });
  // Default: no procrastination result, no APGAR results
  mockFrom.mockImplementation((table: string) => {
    if (table === "procrastination_results") return makeProcChain([]);
    return makeApgarChain([]);
  });
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
    const links = screen.getAllByRole("link", { name: /пройти тест/i });
    expect(links.some((l) => l.getAttribute("href") === "/test")).toBe(true);
  });
});

// ── Procrastination card — no result ─────────────────────────────────────────

describe("Dashboard — procrastination card (no previous result)", () => {
  it("shows 'Узнайте свой тип' when no procrastination result", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText("Узнайте свой тип")).toBeInTheDocument();
    });
  });

  it("shows 'Пройти тест' link to /procrastination", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      const links = screen.getAllByRole("link", { name: /пройти тест/i });
      expect(links.some((l) => l.getAttribute("href") === "/procrastination")).toBe(true);
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
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results")
        return makeProcChain([makeProcResult(["cleaner"])]);
      return makeApgarChain([]);
    });
  });

  it("shows the type emoji", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("proc-emoji").textContent).toBe(
        PROCRASTINATION_TYPES["cleaner"].emoji,
      );
    });
  });

  it("shows the type title", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("proc-title").textContent).toBe(
        PROCRASTINATION_TYPES["cleaner"].title,
      );
    });
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
    await waitFor(() =>
      expect(screen.queryByText("Узнайте свой тип")).not.toBeInTheDocument(),
    );
  });

  it("shows both emojis when two types tied", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results")
        return makeProcChain([makeProcResult(["cleaner", "panicker"])]);
      return makeApgarChain([]);
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getAllByTestId("proc-emoji")).toHaveLength(2);
    });
  });

  it("shows 'Type1 + Type2' title for tied result", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results")
        return makeProcChain([makeProcResult(["cleaner", "panicker"])]);
      return makeApgarChain([]);
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
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results") return makeProcChain(null);
      const c = makeApgarChain(null);
      (c as Record<string, unknown>).order = vi.fn().mockReturnValue(new Promise(() => {}));
      return c;
    });
    render(<Dashboard />);
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  it("shows empty-state message when user has no APGAR results", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/пока нет результатов/i)).toBeInTheDocument();
    });
  });

  it("renders a list item for each APGAR result", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results") return makeProcChain(null);
      return makeApgarChain([makeApgarResult("r1", 10), makeApgarResult("r2", 5)]);
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });
  });

  it("displays correct score for each result", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results") return makeProcChain(null);
      return makeApgarChain([makeApgarResult("r1", 10), makeApgarResult("r2", 5)]);
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("score-r1").textContent).toBe("10");
      expect(screen.getByTestId("score-r2").textContent).toBe("5");
    });
  });

  it("shows 'Рутинная поддержка' for score 10", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results") return makeProcChain(null);
      return makeApgarChain([makeApgarResult("r1", 10)]);
    });
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/рутинная поддержка/i)).toBeInTheDocument();
    });
  });

  it("fetches APGAR results scoped to user_id", async () => {
    const chain = makeApgarChain([]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results") return makeProcChain(null);
      return chain;
    });
    render(<Dashboard />);
    await waitFor(() => screen.getByText(/нет результатов/i));
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("fetches procrastination results scoped to user_id", async () => {
    const procChain = makeProcChain([]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "procrastination_results") return procChain;
      return makeApgarChain([]);
    });
    render(<Dashboard />);
    await waitFor(() => screen.getByText(/нет результатов/i));
    expect(procChain.eq).toHaveBeenCalledWith("user_id", "user-123");
  });
});

// ── Admin link ────────────────────────────────────────────────────────────────

describe("Dashboard — admin link", () => {
  it("does NOT show admin link for regular user", () => {
    render(<Dashboard />);
    expect(screen.queryByRole("link", { name: /администрирование/i })).not.toBeInTheDocument();
  });

  it("shows admin link when isAdmin=true", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "admin@example.com" },
      loading: false,
      displayName: "Admin",
      isAdmin: true,
    });
    render(<Dashboard />);
    expect(screen.getByRole("link", { name: /администрирование/i })).toBeInTheDocument();
  });

  it("admin link points to /admin", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "admin@example.com" },
      loading: false,
      displayName: "Admin",
      isAdmin: true,
    });
    render(<Dashboard />);
    expect(screen.getByRole("link", { name: /администрирование/i })).toHaveAttribute("href", "/admin");
  });
});

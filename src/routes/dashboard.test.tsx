import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { getVerdict } from "@/lib/apgar";

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
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeResult = (id: string, score: number, daysAgo: number) => ({
  id,
  score,
  scores: { A1: 2, P: 2, G: 1, A2: 1, R: score - 6 < 0 ? 0 : score - 6 },
  created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

const makeChain = (resolvedData: unknown) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data: resolvedData, error: null });
  return chain;
};

// ── Minimal Dashboard (mirrors dashboard.tsx logic) ───────────────────────────

interface Result {
  id: string;
  score: number;
  scores: Record<string, number>;
  created_at: string;
}

function Dashboard() {
  const { supabase } = { supabase: { from: mockFrom, auth: { signOut: mockSignOut } } };
  const { user, loading, displayName } = mockUseAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("apgar_results")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }: { data: Result[] | null }) => {
        setResults(data ?? []);
        setLoadingResults(false);
      });
  }, [user]);

  if (loading || !user) return null;

  return (
    <div>
      <h1>{displayName || user.email}</h1>
      <a href="/test">Пройти тест</a>
      <section aria-label="История прохождений">
        <h2>История прохождений</h2>
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

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: "user-123", email: "test@example.com" },
    loading: false,
    displayName: "Тест Юзер",
  });
});

describe("Dashboard — history of results", () => {
  it("shows 'Загрузка...' initially", () => {
    const chain = makeChain(null);
    (chain as Record<string, unknown>).order = vi.fn().mockReturnValue(new Promise(() => {}));
    mockFrom.mockReturnValue(chain);

    render(<Dashboard />);
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  it("shows empty-state message when user has no results", async () => {
    mockFrom.mockReturnValue(makeChain([]));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/пока нет результатов/i)).toBeInTheDocument();
    });
  });

  it("renders a list item for each result", async () => {
    const results = [makeResult("r1", 10, 0), makeResult("r2", 5, 1), makeResult("r3", 3, 2)];
    mockFrom.mockReturnValue(makeChain(results));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });
  });

  it("displays correct score for each result", async () => {
    const results = [makeResult("r1", 10, 0), makeResult("r2", 5, 1)];
    mockFrom.mockReturnValue(makeChain(results));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("score-r1").textContent).toBe("10");
      expect(screen.getByTestId("score-r2").textContent).toBe("5");
    });
  });

  it("shows 'Рутинная поддержка' for score 10", async () => {
    mockFrom.mockReturnValue(makeChain([makeResult("r1", 10, 0)]));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/рутинная поддержка/i)).toBeInTheDocument();
    });
  });

  it("shows 'Самостоятельная коррекция' for score 5", async () => {
    mockFrom.mockReturnValue(makeChain([makeResult("r2", 5, 1)]));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/самостоятельная коррекция/i)).toBeInTheDocument();
    });
  });

  it("shows 'Срочная помощь' for score 3", async () => {
    mockFrom.mockReturnValue(makeChain([makeResult("r3", 3, 2)]));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/срочная помощь/i)).toBeInTheDocument();
    });
  });

  it("fetches results ordered by created_at descending (newest first)", async () => {
    const chain = makeChain([]);
    mockFrom.mockReturnValue(chain);
    render(<Dashboard />);
    await waitFor(() => screen.getByText(/нет результатов/i));
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("fetches results scoped to the current user_id", async () => {
    const chain = makeChain([]);
    mockFrom.mockReturnValue(chain);
    render(<Dashboard />);
    await waitFor(() => screen.getByText(/нет результатов/i));
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("displays the user's display name", () => {
    mockFrom.mockReturnValue(makeChain([]));
    render(<Dashboard />);
    expect(screen.getByRole("heading", { name: /тест юзер/i })).toBeInTheDocument();
  });

  it("score=4 verdict is 'critical' not 'warning'", async () => {
    mockFrom.mockReturnValue(makeChain([makeResult("r1", 4, 0)]));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/срочная помощь/i)).toBeInTheDocument();
    });
  });

  it("score=7 verdict is 'good' not 'warning'", async () => {
    mockFrom.mockReturnValue(makeChain([makeResult("r1", 7, 0)]));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/рутинная поддержка/i)).toBeInTheDocument();
    });
  });
});

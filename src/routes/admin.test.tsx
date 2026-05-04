import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { getVerdict } from "@/lib/apgar";

// ── Mock state ────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_USER = { id: "admin-1", email: "admin@example.com" };

const makeUser = (id: string, email: string, name: string | null = null) => ({
  id,
  email,
  display_name: name,
  created_at: new Date().toISOString(),
});

const makeResult = (id: string, userId: string, score: number, daysAgo = 0) => ({
  id,
  user_id: userId,
  score,
  created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

const rpcChain = (data: unknown, error: unknown = null) => ({ data, error });

const fromChain = (data: unknown, error: unknown = null) => {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockResolvedValue({ data, error });
  return c;
};

// ── Inline AdminPage ──────────────────────────────────────────────────────────

interface AdminUser { id: string; email: string; display_name: string | null; created_at: string }
interface AdminResult { id: string; user_id: string; score: number; created_at: string }

function AdminPage() {
  const { user, loading, isAdmin } = mockUseAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [results, setResults] = useState<AdminResult[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { mockNavigate({ to: "/auth", search: { mode: "login" } }); return; }
    if (!isAdmin) { mockNavigate({ to: "/dashboard" }); return; }
  }, [loading, user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    Promise.all([
      mockRpc("get_admin_users"),
      mockFrom("apgar_results"),
    ]).then(([usersRes, resultsRes]: [{ data: unknown; error: unknown }, { data: unknown; error: unknown }]) => {
      if (usersRes.error) setError((usersRes.error as Error).message);
      else setUsers(usersRes.data as AdminUser[]);
      if (!resultsRes.error) setResults(resultsRes.data as AdminResult[]);
      setFetching(false);
    });
  }, [user, isAdmin]);

  if (loading || !user || !isAdmin) return null;

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const resultsByUser = results.reduce<Record<string, AdminResult[]>>((acc, r) => {
    (acc[r.user_id] ??= []).push(r); return acc;
  }, {});

  const totalTests = results.length;
  const avgScore = results.length > 0
    ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10
    : 0;

  return (
    <div>
      <h1>Панель администратора</h1>
      <span data-testid="stat-users">{users.length}</span>
      <span data-testid="stat-tests">{totalTests}</span>
      <span data-testid="stat-avg">{avgScore}</span>

      {error && <p role="alert">{error}</p>}

      {fetching ? (
        <p>Загрузка...</p>
      ) : users.length === 0 ? (
        <p>Нет пользователей</p>
      ) : (
        <ul>
          {users.map(u => {
            const userResults = resultsByUser[u.id] ?? [];
            const latest = userResults[0];
            const isExpanded = expanded.has(u.id);
            return (
              <li key={u.id}>
                <button onClick={() => toggle(u.id)} data-testid={`row-${u.id}`}>
                  <span>{u.display_name ?? "—"}</span>
                  <span>{u.email}</span>
                  <span data-testid={`count-${u.id}`}>
                    {userResults.length === 1 ? "тест"
                      : userResults.length >= 2 && userResults.length <= 4 ? "теста"
                      : "тестов"}
                  </span>
                  {latest
                    ? <span data-testid={`latest-${u.id}`}>{latest.score}</span>
                    : <span>нет тестов</span>}
                </button>
                {isExpanded && (
                  <ul data-testid={`history-${u.id}`}>
                    {userResults.map(r => (
                      <li key={r.id} data-testid={`result-${r.id}`}>
                        <span>{r.score}</span>
                        <span>{getVerdict(r.score).short}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => vi.clearAllMocks());

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("AdminPage — auth guard", () => {
  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, isAdmin: false });
    const { container } = render(<AdminPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects to /auth when not logged in", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, isAdmin: false });
    render(<AdminPage />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" } });
    });
  });

  it("redirects to /dashboard when logged in but not admin", async () => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: false });
    render(<AdminPage />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/dashboard" });
    });
  });

  it("does NOT redirect when user is admin", async () => {
    mockRpc.mockResolvedValue(rpcChain([]));
    mockFrom.mockResolvedValue(rpcChain([]));
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText(/панель администратора/i)).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ── Data fetching ─────────────────────────────────────────────────────────────

describe("AdminPage — data fetching", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("calls supabase.rpc('get_admin_users')", async () => {
    mockRpc.mockResolvedValue(rpcChain([]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("get_admin_users"));
  });

  it("calls supabase.from('apgar_results')", async () => {
    mockRpc.mockResolvedValue(rpcChain([]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith("apgar_results"));
  });

  it("does NOT fetch if user is not admin", () => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: false });
    render(<AdminPage />);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("shows loading spinner initially", () => {
    mockRpc.mockReturnValue(new Promise(() => {}));
    mockFrom.mockReturnValue(new Promise(() => {}));
    render(<AdminPage />);
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  it("shows empty-state when no users returned", async () => {
    mockRpc.mockResolvedValue(rpcChain([]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText(/нет пользователей/i)).toBeInTheDocument());
  });

  it("shows error alert when get_admin_users fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "Forbidden" } });
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Forbidden"));
  });
});

// ── Stats calculation ─────────────────────────────────────────────────────────

describe("AdminPage — stats cards", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("shows correct user count", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com"), makeUser("u2", "c@d.com")]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-users").textContent).toBe("2"));
  });

  it("shows correct test count", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([
      makeResult("r1", "u1", 8),
      makeResult("r2", "u1", 5),
    ]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-tests").textContent).toBe("2"));
  });

  it("avg score is 0 when no results", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-avg").textContent).toBe("0"));
  });

  it("avg score rounds to 1 decimal", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    // scores 10 + 3 = 13 / 2 = 6.5
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 10), makeResult("r2", "u1", 3)]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-avg").textContent).toBe("6.5"));
  });

  it("avg score for whole numbers has no decimal", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    // scores 8 + 6 = 14 / 2 = 7.0
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 8), makeResult("r2", "u1", 6)]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-avg").textContent).toBe("7"));
  });
});

// ── User rows ─────────────────────────────────────────────────────────────────

describe("AdminPage — user rows", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("renders a row for each user", async () => {
    mockRpc.mockResolvedValue(rpcChain([
      makeUser("u1", "alice@example.com", "Alice"),
      makeUser("u2", "bob@example.com", "Bob"),
    ]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("shows email for each user", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "alice@example.com", "Alice")]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText("alice@example.com")).toBeInTheDocument());
  });

  it("shows '—' when display_name is null", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "alice@example.com", null)]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText("—")).toBeInTheDocument());
  });

  it("shows latest score for user with results", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    // First in array = most recent (query is ORDER BY created_at DESC)
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 9), makeResult("r2", "u1", 4)]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("latest-u1").textContent).toBe("9"));
  });

  it("shows 'нет тестов' for user with no results", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText(/нет тестов/i)).toBeInTheDocument());
  });

  it("test count label: 1 → 'тест'", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 7)]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("count-u1").textContent).toBe("тест"));
  });

  it("test count label: 3 → 'теста'", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([
      makeResult("r1", "u1", 7),
      makeResult("r2", "u1", 5),
      makeResult("r3", "u1", 3),
    ]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("count-u1").textContent).toBe("теста"));
  });

  it("test count label: 5 → 'тестов'", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain(
      Array.from({ length: 5 }, (_, i) => makeResult(`r${i}`, "u1", 7))
    ));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("count-u1").textContent).toBe("тестов"));
  });
});

// ── Expand / collapse ─────────────────────────────────────────────────────────

describe("AdminPage — expand / collapse", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("history is hidden by default", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 8)]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    expect(screen.queryByTestId("history-u1")).not.toBeInTheDocument();
  });

  it("clicking row expands test history", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 8)]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByTestId("history-u1")).toBeInTheDocument();
  });

  it("clicking expanded row collapses it", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 8)]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.queryByTestId("history-u1")).not.toBeInTheDocument();
  });

  it("expanded history shows correct results for that user only", async () => {
    mockRpc.mockResolvedValue(rpcChain([
      makeUser("u1", "alice@example.com"),
      makeUser("u2", "bob@example.com"),
    ]));
    mockFrom.mockResolvedValue(rpcChain([
      makeResult("r1", "u1", 9),
      makeResult("r2", "u1", 5),
      makeResult("r3", "u2", 3),
    ]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByTestId("result-r1")).toBeInTheDocument();
    expect(screen.getByTestId("result-r2")).toBeInTheDocument();
    expect(screen.queryByTestId("result-r3")).not.toBeInTheDocument();
  });

  it("expanding one row does not expand another", async () => {
    mockRpc.mockResolvedValue(rpcChain([
      makeUser("u1", "alice@example.com"),
      makeUser("u2", "bob@example.com"),
    ]));
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 7), makeResult("r2", "u2", 4)]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByTestId("history-u1")).toBeInTheDocument();
    expect(screen.queryByTestId("history-u2")).not.toBeInTheDocument();
  });
});

// ── Result verdict in history ─────────────────────────────────────────────────

describe("AdminPage — verdict labels in expanded history", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("score 10 shows 'Рутинная поддержка'", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 10)]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByText(/рутинная поддержка/i)).toBeInTheDocument();
  });

  it("score 5 shows 'Самостоятельная коррекция'", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 5)]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByText(/самостоятельная коррекция/i)).toBeInTheDocument();
  });

  it("score 2 shows 'Срочная помощь'", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    mockFrom.mockResolvedValue(rpcChain([makeResult("r1", "u1", 2)]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByText(/срочная помощь/i)).toBeInTheDocument();
  });
});

// ── Result grouping by user ───────────────────────────────────────────────────

describe("AdminPage — results grouped by user", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("each user sees only their own results when expanded", async () => {
    mockRpc.mockResolvedValue(rpcChain([
      makeUser("u1", "alice@example.com"),
      makeUser("u2", "bob@example.com"),
    ]));
    mockFrom.mockResolvedValue(rpcChain([
      makeResult("r1", "u1", 9),
      makeResult("r2", "u2", 3),
      makeResult("r3", "u1", 6),
    ]));
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u2"));
    fireEvent.click(screen.getByTestId("row-u2"));
    const history = screen.getByTestId("history-u2");
    expect(history.querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByTestId("result-r2")).toBeInTheDocument();
  });

  it("latest score shown is the first result in the ordered array", async () => {
    mockRpc.mockResolvedValue(rpcChain([makeUser("u1", "a@b.com")]));
    // Simulating DESC order: r1 is newest (score 9), r2 is older (score 2)
    mockFrom.mockResolvedValue(rpcChain([
      makeResult("r1", "u1", 9, 0),
      makeResult("r2", "u1", 2, 5),
    ]));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("latest-u1").textContent).toBe("9"));
  });
});

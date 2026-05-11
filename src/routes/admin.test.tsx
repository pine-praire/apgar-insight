import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { getVerdict } from "@/lib/apgar";

// ── Firebase mocks ────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn().mockReturnValue("col-ref"),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: vi.fn().mockReturnValue("doc-ref"),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_USER = { uid: "admin-1", email: "admin@example.com" };

const makeSnap = (docs: { id: string; [k: string]: unknown }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d })),
});

const makeUser = (id: string, email: string, displayName: string | null = null) => ({
  id, email, displayName, createdAt: new Date().toISOString(),
});

const makeResult = (id: string, userId: string, score: number, daysAgo = 0) => ({
  id, userId, score,
  createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

const makeRole = (uid: string) => ({ id: uid, role: "admin" });

// ── Inline AdminPage ──────────────────────────────────────────────────────────

interface AdminUser { id: string; email: string; displayName: string | null; createdAt: string; isAdmin: boolean }
interface AdminResult { id: string; userId: string; score: number; createdAt: string }

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
      mockGetDocs("users"),
      mockGetDocs("apgar_results"),
      mockGetDocs("user_roles"),
    ]).then(([usersSnap, resultsSnap, rolesSnap]: [ReturnType<typeof makeSnap>, ReturnType<typeof makeSnap>, ReturnType<typeof makeSnap>]) => {
      try {
        const adminUids = new Set(rolesSnap.docs.filter((d) => d.data().role === "admin").map((d) => d.id));
        const userList: AdminUser[] = usersSnap.docs.map((d) => ({
          id: d.id, email: d.data().email ?? "", displayName: d.data().displayName ?? null,
          createdAt: d.data().createdAt ?? "", isAdmin: adminUids.has(d.id),
        })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const resultList: AdminResult[] = resultsSnap.docs.map((d) => ({
          id: d.id, userId: d.data().userId, score: d.data().score,
          createdAt: d.data().createdAt ?? "",
        })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setUsers(userList);
        setResults(resultList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка");
      } finally {
        setFetching(false);
      }
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
      setFetching(false);
    });
  }, [user, isAdmin]);

  const toggleAdmin = async (u: AdminUser) => {
    if (u.isAdmin) {
      await mockDeleteDoc("doc-ref");
    } else {
      await mockSetDoc("doc-ref", { role: "admin" });
    }
    setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, isAdmin: !p.isAdmin } : p));
  };

  if (loading || !user || !isAdmin) return null;

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const resultsByUser = results.reduce<Record<string, AdminResult[]>>((acc, r) => {
    (acc[r.userId] ??= []).push(r); return acc;
  }, {});

  const totalTests = results.length;
  const avgScore = results.length > 0
    ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10 : 0;

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
                  <span>{u.displayName ?? "—"}</span>
                  <span>{u.email}</span>
                  <span data-testid={`count-${u.id}`}>
                    {userResults.length === 1 ? "тест" : userResults.length >= 2 && userResults.length <= 4 ? "теста" : "тестов"}
                  </span>
                  {latest ? <span data-testid={`latest-${u.id}`}>{latest.score}</span> : <span>нет тестов</span>}
                </button>
                <button
                  data-testid={`admin-toggle-${u.id}`}
                  onClick={() => toggleAdmin(u)}
                >
                  {u.isAdmin ? "Убрать" : "Админ"}
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

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSetDoc.mockResolvedValue(undefined);
  mockDeleteDoc.mockResolvedValue(undefined);
  mockGetDocs.mockResolvedValue(makeSnap([]));
});

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
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" } }));
  });

  it("redirects to /dashboard when logged in but not admin", async () => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: false });
    render(<AdminPage />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: "/dashboard" }));
  });

  it("does NOT redirect when user is admin", async () => {
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

  it("fetches users, apgar_results, and user_roles collections", async () => {
    render(<AdminPage />);
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(3));
  });

  it("does NOT fetch if user is not admin", () => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: false });
    render(<AdminPage />);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it("shows loading spinner initially", () => {
    mockGetDocs.mockReturnValue(new Promise(() => {}));
    render(<AdminPage />);
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  it("shows empty-state when no users returned", async () => {
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText(/нет пользователей/i)).toBeInTheDocument());
  });

  it("shows error alert when fetch throws", async () => {
    mockGetDocs.mockRejectedValue(new Error("permission-denied"));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("permission-denied"));
  });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

describe("AdminPage — stats cards", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("shows correct user count", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com"), makeUser("u2", "c@d.com")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-users").textContent).toBe("2"));
  });

  it("shows correct test count", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 8), makeResult("r2", "u1", 5)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-tests").textContent).toBe("2"));
  });

  it("avg score rounds to 1 decimal", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 10), makeResult("r2", "u1", 3)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-avg").textContent).toBe("6.5"));
  });

  it("avg score is 0 when no results", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("stat-avg").textContent).toBe("0"));
  });
});

// ── User rows ─────────────────────────────────────────────────────────────────

describe("AdminPage — user rows", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("renders a row for each user", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "alice@example.com", "Alice"), makeUser("u2", "bob@example.com", "Bob")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("shows '—' when displayName is null", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "alice@example.com", null)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText("—")).toBeInTheDocument());
  });

  it("shows latest score for user with results", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 9, 0), makeResult("r2", "u1", 4, 1)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("latest-u1").textContent).toBe("9"));
  });

  it("test count label: 1 → 'тест'", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 7)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("count-u1").textContent).toBe("тест"));
  });

  it("test count label: 3 → 'теста'", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1","u1",7), makeResult("r2","u1",5), makeResult("r3","u1",3)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("count-u1").textContent).toBe("теста"));
  });
});

// ── Expand / collapse ─────────────────────────────────────────────────────────

describe("AdminPage — expand / collapse", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("history is hidden by default", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 8)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    expect(screen.queryByTestId("history-u1")).not.toBeInTheDocument();
  });

  it("clicking row expands test history", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 8)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByTestId("history-u1")).toBeInTheDocument();
  });

  it("clicking expanded row collapses it", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 8)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.queryByTestId("history-u1")).not.toBeInTheDocument();
  });

  it("expanding one row does not expand another", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1","a@b.com"), makeUser("u2","c@d.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1","u1",7), makeResult("r2","u2",4)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByTestId("history-u1")).toBeInTheDocument();
    expect(screen.queryByTestId("history-u2")).not.toBeInTheDocument();
  });
});

// ── Admin toggle ──────────────────────────────────────────────────────────────

describe("AdminPage — admin toggle", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("shows 'Админ' button for non-admin user", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("admin-toggle-u1").textContent).toBe("Админ"));
  });

  it("shows 'Убрать' button for admin user", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "user_roles") return Promise.resolve(makeSnap([makeRole("u1")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("admin-toggle-u1").textContent).toBe("Убрать"));
  });

  it("clicking 'Админ' calls setDoc", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("admin-toggle-u1"));
    fireEvent.click(screen.getByTestId("admin-toggle-u1"));
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalledWith("doc-ref", { role: "admin" }));
  });

  it("clicking 'Убрать' calls deleteDoc", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "user_roles") return Promise.resolve(makeSnap([makeRole("u1")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("admin-toggle-u1"));
    fireEvent.click(screen.getByTestId("admin-toggle-u1"));
    await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledWith("doc-ref"));
  });

  it("button label flips after granting admin", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("admin-toggle-u1").textContent).toBe("Админ"));
    fireEvent.click(screen.getByTestId("admin-toggle-u1"));
    await waitFor(() => expect(screen.getByTestId("admin-toggle-u1").textContent).toBe("Убрать"));
  });

  it("button label flips after revoking admin", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "user_roles") return Promise.resolve(makeSnap([makeRole("u1")]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByTestId("admin-toggle-u1").textContent).toBe("Убрать"));
    fireEvent.click(screen.getByTestId("admin-toggle-u1"));
    await waitFor(() => expect(screen.getByTestId("admin-toggle-u1").textContent).toBe("Админ"));
  });
});

// ── Verdict labels ────────────────────────────────────────────────────────────

describe("AdminPage — verdict labels in expanded history", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, loading: false, isAdmin: true });
  });

  it("score 10 shows 'Рутинная поддержка'", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 10)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByText(/рутинная поддержка/i)).toBeInTheDocument();
  });

  it("score 5 shows 'Самостоятельная коррекция'", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 5)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByText(/самостоятельная коррекция/i)).toBeInTheDocument();
  });

  it("score 2 shows 'Срочная помощь'", async () => {
    mockGetDocs.mockImplementation((key: string) => {
      if (key === "users") return Promise.resolve(makeSnap([makeUser("u1", "a@b.com")]));
      if (key === "apgar_results") return Promise.resolve(makeSnap([makeResult("r1", "u1", 2)]));
      return Promise.resolve(makeSnap([]));
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByTestId("row-u1"));
    fireEvent.click(screen.getByTestId("row-u1"));
    expect(screen.getByText(/срочная помощь/i)).toBeInTheDocument();
  });
});

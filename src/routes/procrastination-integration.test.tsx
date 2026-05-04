/**
 * Integration tests for the real ProcrastinationTestPage component.
 * Verifies that the correct Supabase table name ("procrastination_results"),
 * insert payload structure, and error handling behave as expected in production code.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { PROCRASTINATION_QUESTIONS, type ProcrastinationType } from "@/lib/procrastination";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockGetSession = vi.fn();
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
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: mockGetSession },
  },
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION = { session: { user: { id: "user-99" } } };
const VALID_TYPES: ProcrastinationType[] = [
  "cleaner","panicker","list_maker","sleeper","multitasker",
  "socializer","researcher","foodie","netflixer","timer",
];

// ── Real component loader ──────────────────────────────────────────────────────

async function loadPage(): Promise<React.ComponentType> {
  const mod = await import("./procrastination");
  return (mod.Route as unknown as { component: React.ComponentType }).component;
}

// ── Question navigation helper ─────────────────────────────────────────────────
// Options appear before Назад/Далее/Завершить in DOM order, so [0] is always option 0.

function completeAllQuestions() {
  const total = PROCRASTINATION_QUESTIONS.length;
  for (let i = 0; i < total; i++) {
    fireEvent.click(screen.getAllByRole("button")[0]);
    const isLast = i === total - 1;
    fireEvent.click(screen.getByRole("button", { name: isLast ? /завершить/i : /далее/i }));
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: "user-99" }, loading: false });
  mockGetSession.mockResolvedValue({ data: SESSION });
  mockInsert.mockResolvedValue({ data: null, error: null });
  mockFrom.mockReturnValue({ insert: mockInsert });
});

// ── Table name ────────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage (real) — Supabase table name", () => {
  it("calls supabase.from('procrastination_results') on submit", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("procrastination_results");
    });
  });

  it("only touches the procrastination_results table (no stray calls)", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    const tables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(tables.every((t) => t === "procrastination_results")).toBe(true);
  });
});

// ── Insert payload ────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage (real) — insert payload", () => {
  it("payload includes user_id from session", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(mockInsert.mock.calls[0][0]).toMatchObject({ user_id: "user-99" });
    });
  });

  it("payload includes a non-empty types array", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      const { types } = mockInsert.mock.calls[0][0];
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  it("all values in types are valid ProcrastinationType strings", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      const { types } = mockInsert.mock.calls[0][0] as { types: ProcrastinationType[] };
      expect(types.every((t) => VALID_TYPES.includes(t))).toBe(true);
    });
  });

  it("insert is called exactly once per test completion", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage (real) — DB error handling", () => {
  it("still shows result screen when insert returns an error", async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /на главную/i })).toBeInTheDocument();
    });
  });

  it("calls toast.error with the DB error message", async () => {
    const { toast } = await import("sonner");
    mockInsert.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("relation does not exist"),
      );
    });
  });
});

// ── Session expiry ────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage (real) — session expiry on submit", () => {
  it("redirects to /auth when session is missing at submit time", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" } });
    });
  });

  it("does NOT call insert when session is missing", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

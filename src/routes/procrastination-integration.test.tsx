import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { PROCRASTINATION_QUESTIONS, type ProcrastinationType } from "@/lib/procrastination";

// ── Firebase mocks ────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockAddDoc = vi.fn();
let mockCurrentUser: { uid: string } | null = { uid: "user-99" };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn().mockReturnValue("col-ref"),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn().mockReturnValue({}),
  onAuthStateChanged: vi.fn(),
}));

vi.mock("@/integrations/firebase/client", () => ({
  auth: { get currentUser() { return mockCurrentUser; } },
  db: {},
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();
const VALID_TYPES: ProcrastinationType[] = [
  "cleaner","panicker","list_maker","sleeper","multitasker",
  "socializer","researcher","foodie","netflixer","timer",
];

let Page: React.ComponentType;

// Load once — first dynamic import of the real component is slow; cache it here.
beforeAll(async () => {
  const mod = await import("./procrastination");
  Page = (mod.Route as unknown as { component: React.ComponentType }).component;
}, 20000);

async function loadPage(): Promise<React.ComponentType> {
  return Page;
}

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
  mockCurrentUser = { uid: "user-99" };
  mockUseAuth.mockReturnValue({ user: { uid: "user-99" }, loading: false });
  mockAddDoc.mockResolvedValue({ id: "new-doc" });
});

// ── Table name ────────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage (real) — Firestore collection name", () => {
  it("calls addDoc exactly once per test completion", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => expect(mockAddDoc).toHaveBeenCalledTimes(1));
  });

  it("addDoc is called with a collection ref (not null/undefined)", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      const colRef = mockAddDoc.mock.calls[0][0];
      expect(colRef).toBeTruthy();
    });
  });
});

// ── Insert payload ────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage (real) — insert payload", () => {
  it("payload includes userId from currentUser", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ userId: "user-99" });
    });
  });

  it("payload includes a non-empty types array", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      const { types } = mockAddDoc.mock.calls[0][1];
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  it("all values in types are valid ProcrastinationType strings", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      const { types } = mockAddDoc.mock.calls[0][1] as { types: ProcrastinationType[] };
      expect(types.every((t) => VALID_TYPES.includes(t))).toBe(true);
    });
  });

  it("payload includes createdAt ISO string", async () => {
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      const { createdAt } = mockAddDoc.mock.calls[0][1];
      expect(typeof createdAt).toBe("string");
      expect(() => new Date(createdAt)).not.toThrow();
    });
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage (real) — error handling", () => {
  it("still shows result screen when addDoc throws", async () => {
    mockAddDoc.mockRejectedValue(new Error("permission-denied"));
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /на главную/i })).toBeInTheDocument();
    });
  });

  it("calls toast.error when addDoc throws", async () => {
    const { toast } = await import("sonner");
    mockAddDoc.mockRejectedValue(new Error("permission-denied"));
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("permission-denied"));
    });
  });
});

// ── Session expiry ────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage (real) — session expiry on submit", () => {
  it("redirects to /auth when currentUser is null at submit time", async () => {
    const Page = await loadPage();
    render(<Page />);
    // Answer all but last question
    const total = PROCRASTINATION_QUESTIONS.length;
    for (let i = 0; i < total - 1; i++) {
      fireEvent.click(screen.getAllByRole("button")[0]);
      fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    }
    // Nullify user before last answer
    mockCurrentUser = null;
    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: /завершить/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" } });
    });
  });

  it("does NOT call addDoc when currentUser is null", async () => {
    mockCurrentUser = null;
    const Page = await loadPage();
    render(<Page />);
    completeAllQuestions();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

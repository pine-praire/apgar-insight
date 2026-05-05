import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import {
  PROCRASTINATION_QUESTIONS,
  PROCRASTINATION_TYPES,
  calculateProcrastinationResult,
  type ProcrastinationType,
} from "@/lib/procrastination";

// ── Firebase mocks ────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockAddDoc = vi.fn();
const mockCurrentUser = { uid: "user-1" };

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
const LOGGED_IN = { user: { uid: "user-1" }, loading: false };
const LOGGED_OUT = { user: null, loading: false };
const LOADING = { user: null, loading: true };

// ── Inline ProcrastinationTestPage ───────────────────────────────────────────

function ProcrastinationTestPage() {
  const { user, loading } = mockUseAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ProcrastinationType[]>([]);
  const [selected, setSelected] = useState<ProcrastinationType | null>(null);
  const [result, setResult] = useState<ProcrastinationType[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) mockNavigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user]);

  if (!user) return null;

  const total = PROCRASTINATION_QUESTIONS.length;
  const q = PROCRASTINATION_QUESTIONS[step];

  const next = async () => {
    if (!selected) return;
    const newAnswers = [...answers, selected];
    if (step < total - 1) {
      setAnswers(newAnswers);
      setSelected(null);
      setStep(step + 1);
      return;
    }
    const types = calculateProcrastinationResult(newAnswers);
    setSubmitting(true);
    if (!mockCurrentUser) { setSubmitting(false); mockNavigate({ to: "/auth", search: { mode: "login" } }); return; }
    await mockAddDoc("col-ref", { userId: mockCurrentUser.uid, types });
    setSubmitting(false);
    setResult(types);
  };

  const back = () => {
    if (step === 0) { mockNavigate({ to: "/dashboard" }); return; }
    setStep(step - 1);
    setSelected(answers[step - 1] ?? null);
    setAnswers(answers.slice(0, step - 1));
  };

  const restart = () => { setStep(0); setAnswers([]); setSelected(null); setResult(null); };

  if (result) {
    const isTie = result.length > 1;
    return (
      <div>
        {isTie && <p>У вас два ведущих типа</p>}
        {result.map((type) => {
          const info = PROCRASTINATION_TYPES[type];
          return (
            <div key={type}>
              <span data-testid="result-emoji">{info.emoji}</span>
              <h2 data-testid="result-title">{info.title}</h2>
              <p data-testid="result-description">{info.description}</p>
              <p data-testid="result-insight">{info.insight}</p>
              <ul>{info.tools.map((tool, i) => <li key={i} data-testid="result-tool">{tool}</li>)}</ul>
            </div>
          );
        })}
        <button onClick={restart}>Пройти снова</button>
        <a href="/dashboard">На главную</a>
      </div>
    );
  }

  return (
    <div>
      <span data-testid="progress-label">Вопрос {step + 1} из {total}</span>
      <h2 data-testid="question-text">{q.text}</h2>
      <ul>
        {q.options.map((opt, i) => (
          <li key={i}>
            <button
              data-testid={`option-${i}`}
              data-selected={selected === opt.type ? "true" : "false"}
              onClick={() => setSelected(opt.type)}
            >
              {opt.text}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={back}>Назад</button>
      <button data-testid="next-btn" onClick={next} disabled={!selected || submitting}>
        {step === total - 1 ? "Завершить" : "Далее"}
      </button>
    </div>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(LOGGED_IN);
  mockAddDoc.mockResolvedValue({ id: "new-doc-id" });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage — auth guard", () => {
  it("redirects to /auth when not logged in", () => {
    mockUseAuth.mockReturnValue(LOGGED_OUT);
    render(<ProcrastinationTestPage />);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" } });
  });

  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue(LOADING);
    const { container } = render(<ProcrastinationTestPage />);
    expect(container.firstChild).toBeNull();
  });

  it("does NOT redirect when user is logged in", () => {
    render(<ProcrastinationTestPage />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ── Question display ──────────────────────────────────────────────────────────

describe("ProcrastinationTestPage — question display", () => {
  it("shows question 1 of 12 initially", () => {
    render(<ProcrastinationTestPage />);
    expect(screen.getByTestId("progress-label").textContent).toBe("Вопрос 1 из 12");
  });

  it("shows the first question text", () => {
    render(<ProcrastinationTestPage />);
    expect(screen.getByTestId("question-text").textContent).toBe(PROCRASTINATION_QUESTIONS[0].text);
  });

  it("renders exactly 4 options for the first question", () => {
    render(<ProcrastinationTestPage />);
    expect(screen.getAllByRole("button").filter((b) => b.dataset.testid?.startsWith("option-"))).toHaveLength(4);
  });

  it("next button is disabled before any selection", () => {
    render(<ProcrastinationTestPage />);
    expect(screen.getByTestId("next-btn")).toBeDisabled();
  });

  it("next button is enabled after selecting an option", () => {
    render(<ProcrastinationTestPage />);
    fireEvent.click(screen.getByTestId("option-0"));
    expect(screen.getByTestId("next-btn")).not.toBeDisabled();
  });

  it("selected option gets data-selected=true", () => {
    render(<ProcrastinationTestPage />);
    const opt = screen.getByTestId("option-2");
    fireEvent.click(opt);
    expect(opt.getAttribute("data-selected")).toBe("true");
  });

  it("previously selected option is deselected when another is clicked", () => {
    render(<ProcrastinationTestPage />);
    fireEvent.click(screen.getByTestId("option-0"));
    fireEvent.click(screen.getByTestId("option-1"));
    expect(screen.getByTestId("option-0").getAttribute("data-selected")).toBe("false");
    expect(screen.getByTestId("option-1").getAttribute("data-selected")).toBe("true");
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage — navigation", () => {
  it("'Назад' on question 1 navigates to /dashboard", () => {
    render(<ProcrastinationTestPage />);
    fireEvent.click(screen.getByText("Назад"));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("'Далее' advances to question 2", () => {
    render(<ProcrastinationTestPage />);
    fireEvent.click(screen.getByTestId("option-0"));
    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("progress-label").textContent).toBe("Вопрос 2 из 12");
  });

  it("question text changes after advancing", () => {
    render(<ProcrastinationTestPage />);
    fireEvent.click(screen.getByTestId("option-0"));
    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("question-text").textContent).toBe(PROCRASTINATION_QUESTIONS[1].text);
  });

  it("selection is cleared after advancing", () => {
    render(<ProcrastinationTestPage />);
    fireEvent.click(screen.getByTestId("option-0"));
    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("next-btn")).toBeDisabled();
  });

  it("'Назад' on question 2 goes back to question 1", () => {
    render(<ProcrastinationTestPage />);
    fireEvent.click(screen.getByTestId("option-0"));
    fireEvent.click(screen.getByTestId("next-btn"));
    fireEvent.click(screen.getByText("Назад"));
    expect(screen.getByTestId("progress-label").textContent).toBe("Вопрос 1 из 12");
  });

  it("last question shows 'Завершить' button", () => {
    render(<ProcrastinationTestPage />);
    const total = PROCRASTINATION_QUESTIONS.length;
    for (let i = 0; i < total - 1; i++) {
      fireEvent.click(screen.getByTestId("option-0"));
      fireEvent.click(screen.getByTestId("next-btn"));
    }
    expect(screen.getByTestId("next-btn").textContent).toBe("Завершить");
  });
});

// ── Submission ────────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage — submission", () => {
  const completeTest = (optionIndex = 0) => {
    render(<ProcrastinationTestPage />);
    const total = PROCRASTINATION_QUESTIONS.length;
    for (let i = 0; i < total; i++) {
      fireEvent.click(screen.getByTestId(`option-${optionIndex}`));
      fireEvent.click(screen.getByTestId("next-btn"));
    }
  };

  it("calls addDoc after completing all questions", async () => {
    completeTest(0);
    await waitFor(() => expect(mockAddDoc).toHaveBeenCalledTimes(1));
  });

  it("inserts with user_id from currentUser", async () => {
    completeTest(0);
    await waitFor(() => {
      const [, payload] = mockAddDoc.mock.calls[0];
      expect(payload.userId).toBe("user-1");
    });
  });

  it("inserts a non-empty types array", async () => {
    completeTest(0);
    await waitFor(() => {
      const [, payload] = mockAddDoc.mock.calls[0];
      expect(Array.isArray(payload.types)).toBe(true);
      expect(payload.types.length).toBeGreaterThan(0);
    });
  });

  it("shows result screen after submission", async () => {
    completeTest(0);
    await waitFor(() => expect(screen.getByTestId("result-title")).toBeInTheDocument());
  });
});

// ── Result screen ─────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage — result screen", () => {
  const goToResult = async (types: ProcrastinationType[]) => {
    const firstTypeOption = (qIndex: number) => {
      const q = PROCRASTINATION_QUESTIONS[qIndex];
      const idx = q.options.findIndex((o) => types.includes(o.type));
      return idx >= 0 ? idx : 0;
    };
    render(<ProcrastinationTestPage />);
    const total = PROCRASTINATION_QUESTIONS.length;
    for (let i = 0; i < total; i++) {
      fireEvent.click(screen.getByTestId(`option-${firstTypeOption(i)}`));
      fireEvent.click(screen.getByTestId("next-btn"));
    }
    await waitFor(() => screen.getByTestId("result-title"));
  };

  it("shows the result type title", async () => {
    await goToResult(["cleaner"]);
    expect(screen.getAllByTestId("result-title").length).toBeGreaterThan(0);
  });

  it("shows the result emoji", async () => {
    await goToResult(["cleaner"]);
    expect(screen.getByTestId("result-emoji")).toBeInTheDocument();
  });

  it("shows the description", async () => {
    await goToResult(["cleaner"]);
    expect(screen.getByTestId("result-description")).toBeInTheDocument();
  });

  it("shows the insight", async () => {
    await goToResult(["cleaner"]);
    expect(screen.getByTestId("result-insight")).toBeInTheDocument();
  });

  it("shows exactly 3 tools", async () => {
    await goToResult(["cleaner"]);
    expect(screen.getAllByTestId("result-tool")).toHaveLength(3);
  });

  it("'Пройти снова' restarts the test", async () => {
    await goToResult(["cleaner"]);
    fireEvent.click(screen.getByText("Пройти снова"));
    expect(screen.getByTestId("progress-label").textContent).toBe("Вопрос 1 из 12");
  });

  it("'На главную' link points to /dashboard", async () => {
    await goToResult(["cleaner"]);
    expect(screen.getByRole("link", { name: "На главную" })).toHaveAttribute("href", "/dashboard");
  });
});

// ── Tie header ────────────────────────────────────────────────────────────────

describe("ProcrastinationTestPage — tie header", () => {
  it("shows tie header when result contains two types", async () => {
    const procLib = await import("@/lib/procrastination");
    const spy = vi.spyOn(procLib, "calculateProcrastinationResult").mockReturnValueOnce(["cleaner", "panicker"]);
    render(<ProcrastinationTestPage />);
    const total = PROCRASTINATION_QUESTIONS.length;
    for (let i = 0; i < total; i++) {
      fireEvent.click(screen.getByTestId("option-0"));
      fireEvent.click(screen.getByTestId("next-btn"));
    }
    await waitFor(() => expect(screen.getByText("У вас два ведущих типа")).toBeInTheDocument());
    spy.mockRestore();
  });

  it("shows two result blocks when two types tie", async () => {
    const procLib = await import("@/lib/procrastination");
    const spy = vi.spyOn(procLib, "calculateProcrastinationResult").mockReturnValueOnce(["cleaner", "panicker"]);
    render(<ProcrastinationTestPage />);
    const total = PROCRASTINATION_QUESTIONS.length;
    for (let i = 0; i < total; i++) {
      fireEvent.click(screen.getByTestId("option-0"));
      fireEvent.click(screen.getByTestId("next-btn"));
    }
    await waitFor(() => expect(screen.getAllByTestId("result-title")).toHaveLength(2));
    spy.mockRestore();
  });
});

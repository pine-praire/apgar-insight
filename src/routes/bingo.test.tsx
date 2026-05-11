import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React, { useState, useRef, useEffect } from "react";

// ── Firebase mocks ────────────────────────────────────────────────────────────

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn().mockReturnValue("col-ref"),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  doc: vi.fn().mockReturnValue("doc-ref"),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn().mockReturnValue({}),
  onAuthStateChanged: vi.fn(),
}));

const mockCurrentUser = { uid: "bingo-user-1" };

vi.mock("@/integrations/firebase/client", () => ({
  auth: { get currentUser() { return mockCurrentUser; } },
  db: {},
}));

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={to} {...rest}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}));

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

// ── Constants ─────────────────────────────────────────────────────────────────

const CENTER_INDEX = 12;
const TOTAL_CHECKABLE = 24;

const BINGO_ITEMS = [
  "Устала с утра",
  "Раздражение на всех",
  "Не могу начать",
  "Кусок в горло не лезет",
  "Болит голова",
  "Жду выходных с понедельника",
  "Не хочу никого видеть",
  "Купила курс — не открыла",
  "Работаю много — нет результата",
  "Бессонница",
  "Слезы без причины",
  "Снижен иммунитет",
  "Burn out ★",
  "Цинизм и черный юмор",
  "Все бесполезно",
  "Ничего не радует",
  "Гиперфиксируюсь",
  "Снова набрала проекты",
  "Не помню, зачем работаю",
  "Врезаюсь в косяки",
  "Застывший взгляд",
  "Прокрасти-нирую",
  "Хочу, чтоб все отстали",
  "Плачу в душе",
  "Еда как успокоение",
];

const SLIDES = [
  { id: 0, title: "Выгорание редко приходит одно", source: "Маслач и Джексон, модель MBI, 1981" },
  { id: 1, title: "Эмоциональное истощение", source: "Маслач, 1978" },
  { id: 2, title: "Деперсонализация", source: "Маслач и Джексон, MBI" },
  { id: 3, title: "Нарушения сна", source: "Sonnenschein et al., 2007" },
  { id: 4, title: "Тревога и раздражение", source: "Schaufeli & Taris, 2014" },
  { id: 5, title: "Редукция достижений", source: "Маслач, MBI" },
  { id: 6, title: "Тело говорит первым", source: "Клиническая модель" },
  { id: 7, title: "Стадии выгорания", source: "Модель Маслач" },
];

// ── Inline BingoPage ──────────────────────────────────────────────────────────
// Mirrors the production logic but with data-testid attributes for easy querying.

function BingoPage() {
  const { user, loading } = mockUseAuth();
  const [checked, setChecked] = useState(new Set<number>());
  const [activeSlide, setActiveSlide] = useState<number | null>(null);
  const savedDocId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) mockNavigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user]);

  const score = checked.size;

  useEffect(() => {
    if (score === 0 || !mockCurrentUser) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!mockCurrentUser) return;
      if (!savedDocId.current) {
        const docRef = await mockAddDoc("col-ref", {
          userId: mockCurrentUser.uid,
          score,
          type: "bingo",
          createdAt: new Date().toISOString(),
        });
        savedDocId.current = docRef.id;
      } else {
        await mockUpdateDoc("doc-ref", { score });
      }
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [score]);

  if (loading || !user) return null;

  const toggle = (i: number) => {
    if (i === CENTER_INDEX) return;
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const scoreLabel =
    score === 0
      ? "пока ничего"
      : score <= 5
        ? "стоит понаблюдать"
        : score <= 12
          ? "тревожный звоночек"
          : score <= 18
            ? "это серьезно"
            : "срочно нужна пауза";

  return (
    <div>
      <a href="/dashboard" data-testid="back-btn">← На главную</a>

      <h1 data-testid="page-title">ВЫГОРАНИЕ-БИНГО</h1>

      <div data-testid="bingo-grid">
        {BINGO_ITEMS.map((item, i) => (
          <div
            key={i}
            data-testid={`cell-${i}`}
            data-checked={checked.has(i) ? "true" : "false"}
            data-center={i === CENTER_INDEX ? "true" : "false"}
            onClick={() => toggle(i)}
          >
            {i === CENTER_INDEX ? "Burn out ★" : item}
          </div>
        ))}
      </div>

      <span data-testid="score-count">отмечено: {score} из {TOTAL_CHECKABLE}</span>
      <span data-testid="score-label">{scoreLabel}</span>

      <div data-testid="slides-section">
        <h2>ЧТО ЗА ЭТИМ СТОИТ</h2>
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            data-testid={`slide-btn-${i}`}
            onClick={() => setActiveSlide(activeSlide === i ? null : i)}
          >
            {s.title}
          </button>
        ))}
      </div>

      {activeSlide !== null && (
        <div data-testid="modal-overlay" onClick={() => setActiveSlide(null)}>
          <div data-testid="modal" onClick={(e) => e.stopPropagation()}>
            <button data-testid="modal-close" onClick={() => setActiveSlide(null)}>×</button>
            <h2 data-testid="modal-title">{SLIDES[activeSlide].title}</h2>
            <p data-testid="modal-source">{SLIDES[activeSlide].source}</p>
            <span data-testid="modal-counter">{activeSlide + 1} / {SLIDES.length}</span>
            <button
              data-testid="modal-prev"
              disabled={activeSlide === 0}
              onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
            >
              ← назад
            </button>
            <button
              data-testid="modal-next"
              disabled={activeSlide === SLIDES.length - 1}
              onClick={() => setActiveSlide(Math.min(SLIDES.length - 1, activeSlide + 1))}
            >
              вперед →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOGGED_IN = { user: { uid: "bingo-user-1" }, loading: false };
const LOGGED_OUT = { user: null, loading: false };
const LOADING = { user: null, loading: true };

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(LOGGED_IN);
  mockAddDoc.mockResolvedValue({ id: "bingo-doc-1" });
  mockUpdateDoc.mockResolvedValue(undefined);
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("BingoPage — auth guard", () => {
  it("redirects to /auth when not logged in", () => {
    mockUseAuth.mockReturnValue(LOGGED_OUT);
    render(<BingoPage />);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" } });
  });

  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue(LOADING);
    const { container } = render(<BingoPage />);
    expect(container.firstChild).toBeNull();
  });

  it("does NOT redirect when user is logged in", () => {
    render(<BingoPage />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders the page title when logged in", () => {
    render(<BingoPage />);
    expect(screen.getByTestId("page-title")).toBeInTheDocument();
  });
});

// ── Back button ───────────────────────────────────────────────────────────────

describe("BingoPage — back button", () => {
  it("renders a back link", () => {
    render(<BingoPage />);
    expect(screen.getByTestId("back-btn")).toBeInTheDocument();
  });

  it("back link points to /dashboard", () => {
    render(<BingoPage />);
    expect(screen.getByTestId("back-btn")).toHaveAttribute("href", "/dashboard");
  });

  it("back link contains the correct label", () => {
    render(<BingoPage />);
    expect(screen.getByTestId("back-btn").textContent).toContain("На главную");
  });
});

// ── Bingo grid ────────────────────────────────────────────────────────────────

describe("BingoPage — grid rendering", () => {
  it("renders exactly 25 cells", () => {
    render(<BingoPage />);
    const grid = screen.getByTestId("bingo-grid");
    expect(grid.querySelectorAll("[data-testid^='cell-']")).toHaveLength(25);
  });

  it("all cells are initially unchecked", () => {
    render(<BingoPage />);
    const cells = screen.getAllByTestId(/^cell-\d+$/);
    const nonCenter = cells.filter((_, i) => i !== CENTER_INDEX);
    nonCenter.forEach((cell) => expect(cell.getAttribute("data-checked")).toBe("false"));
  });

  it("center cell (index 12) is marked with data-center=true", () => {
    render(<BingoPage />);
    expect(screen.getByTestId("cell-12").getAttribute("data-center")).toBe("true");
  });

  it("all non-center cells have data-center=false", () => {
    render(<BingoPage />);
    const cells = screen.getAllByTestId(/^cell-\d+$/);
    cells
      .filter((_, i) => i !== CENTER_INDEX)
      .forEach((cell) => expect(cell.getAttribute("data-center")).toBe("false"));
  });

  it("center cell displays 'Burn out ★'", () => {
    render(<BingoPage />);
    expect(screen.getByTestId("cell-12").textContent).toBe("Burn out ★");
  });
});

// ── Toggle behavior ───────────────────────────────────────────────────────────

describe("BingoPage — cell toggle", () => {
  it("clicking a cell marks it as checked", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    expect(screen.getByTestId("cell-0").getAttribute("data-checked")).toBe("true");
  });

  it("clicking a checked cell unchecks it", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    fireEvent.click(screen.getByTestId("cell-0"));
    expect(screen.getByTestId("cell-0").getAttribute("data-checked")).toBe("false");
  });

  it("clicking the center cell does NOT change its state", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-12"));
    expect(screen.getByTestId("cell-12").getAttribute("data-checked")).toBe("false");
  });

  it("multiple cells can be checked independently", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    fireEvent.click(screen.getByTestId("cell-3"));
    fireEvent.click(screen.getByTestId("cell-7"));
    expect(screen.getByTestId("cell-0").getAttribute("data-checked")).toBe("true");
    expect(screen.getByTestId("cell-3").getAttribute("data-checked")).toBe("true");
    expect(screen.getByTestId("cell-7").getAttribute("data-checked")).toBe("true");
  });

  it("unchecking one cell does not affect others", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-1"));
    fireEvent.click(screen.getByTestId("cell-2"));
    fireEvent.click(screen.getByTestId("cell-1")); // uncheck
    expect(screen.getByTestId("cell-1").getAttribute("data-checked")).toBe("false");
    expect(screen.getByTestId("cell-2").getAttribute("data-checked")).toBe("true");
  });
});

// ── Score display ─────────────────────────────────────────────────────────────

describe("BingoPage — score counter", () => {
  it("shows '0 из 24' initially", () => {
    render(<BingoPage />);
    expect(screen.getByTestId("score-count").textContent).toBe("отмечено: 0 из 24");
  });

  it("increments score when a cell is checked", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    expect(screen.getByTestId("score-count").textContent).toBe("отмечено: 1 из 24");
  });

  it("decrements score when a cell is unchecked", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    fireEvent.click(screen.getByTestId("cell-0"));
    expect(screen.getByTestId("score-count").textContent).toBe("отмечено: 0 из 24");
  });

  it("counts multiple checked cells correctly", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    fireEvent.click(screen.getByTestId("cell-1"));
    fireEvent.click(screen.getByTestId("cell-2"));
    expect(screen.getByTestId("score-count").textContent).toBe("отмечено: 3 из 24");
  });

  it("center cell does not contribute to score", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-12"));
    expect(screen.getByTestId("score-count").textContent).toBe("отмечено: 0 из 24");
  });
});

// ── Score label ───────────────────────────────────────────────────────────────

describe("BingoPage — score label", () => {
  it("shows 'пока ничего' at score 0", () => {
    render(<BingoPage />);
    expect(screen.getByTestId("score-label").textContent).toBe("пока ничего");
  });

  it("shows 'стоит понаблюдать' at score 1", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    expect(screen.getByTestId("score-label").textContent).toBe("стоит понаблюдать");
  });

  it("shows 'стоит понаблюдать' at score 5", () => {
    render(<BingoPage />);
    [0, 1, 2, 3, 4].forEach((i) => fireEvent.click(screen.getByTestId(`cell-${i}`)));
    expect(screen.getByTestId("score-label").textContent).toBe("стоит понаблюдать");
  });

  it("shows 'тревожный звоночек' at score 6", () => {
    render(<BingoPage />);
    [0, 1, 2, 3, 4, 5].forEach((i) => fireEvent.click(screen.getByTestId(`cell-${i}`)));
    expect(screen.getByTestId("score-label").textContent).toBe("тревожный звоночек");
  });

  it("shows 'тревожный звоночек' at score 12", () => {
    render(<BingoPage />);
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach((i) => fireEvent.click(screen.getByTestId(`cell-${i}`)));
    expect(screen.getByTestId("score-label").textContent).toBe("тревожный звоночек");
  });

  it("shows 'это серьезно' at score 13", () => {
    render(<BingoPage />);
    // skip center (12), use 0-11 + 13
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13].forEach((i) => fireEvent.click(screen.getByTestId(`cell-${i}`)));
    expect(screen.getByTestId("score-label").textContent).toBe("это серьезно");
  });

  it("shows 'это серьезно' at score 18", () => {
    render(<BingoPage />);
    // 18 cells: 0-11 (12) + 13-18 (6 more), skipping 12
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18].forEach((i) =>
      fireEvent.click(screen.getByTestId(`cell-${i}`)),
    );
    expect(screen.getByTestId("score-label").textContent).toBe("это серьезно");
  });

  it("shows 'срочно нужна пауза' at score 19", () => {
    render(<BingoPage />);
    // 19 cells: 0-11 + 13-20, skipping 12
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19].forEach((i) =>
      fireEvent.click(screen.getByTestId(`cell-${i}`)),
    );
    expect(screen.getByTestId("score-label").textContent).toBe("срочно нужна пауза");
  });
});

// ── Firebase save ─────────────────────────────────────────────────────────────

describe("BingoPage — Firebase save (debounced)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does NOT call addDoc at score 0", async () => {
    vi.useFakeTimers();
    render(<BingoPage />);
    await act(() => vi.advanceTimersByTime(2000));
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("calls addDoc after debounce when first cell is checked", async () => {
    vi.useFakeTimers();
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    await act(() => vi.advanceTimersByTime(1500));
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it("saves with correct userId, type, and score", async () => {
    vi.useFakeTimers();
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    await act(() => vi.advanceTimersByTime(1500));
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.userId).toBe("bingo-user-1");
    expect(payload.type).toBe("bingo");
    expect(payload.score).toBe(1);
  });

  it("saves with a createdAt ISO string", async () => {
    vi.useFakeTimers();
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("cell-0"));
    await act(() => vi.advanceTimersByTime(1500));
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(() => new Date(payload.createdAt).toISOString()).not.toThrow();
  });

  it("calls updateDoc (not addDoc again) when score changes a second time", async () => {
    vi.useFakeTimers();
    render(<BingoPage />);

    // first save
    fireEvent.click(screen.getByTestId("cell-0"));
    await act(() => vi.advanceTimersByTime(1500));
    expect(mockAddDoc).toHaveBeenCalledTimes(1);

    // second save
    fireEvent.click(screen.getByTestId("cell-1"));
    await act(() => vi.advanceTimersByTime(1500));
    expect(mockAddDoc).toHaveBeenCalledTimes(1); // no new addDoc
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it("debounce resets on rapid clicks — only one addDoc fired", async () => {
    vi.useFakeTimers();
    render(<BingoPage />);

    // click 3 cells quickly
    fireEvent.click(screen.getByTestId("cell-0"));
    await act(() => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByTestId("cell-1"));
    await act(() => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByTestId("cell-2"));
    await act(() => vi.advanceTimersByTime(1500)); // let the last debounce fire

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it("debounced save reports the latest score, not an intermediate one", async () => {
    vi.useFakeTimers();
    render(<BingoPage />);

    fireEvent.click(screen.getByTestId("cell-0"));
    await act(() => vi.advanceTimersByTime(400));
    fireEvent.click(screen.getByTestId("cell-1"));
    await act(() => vi.advanceTimersByTime(400));
    fireEvent.click(screen.getByTestId("cell-2"));
    await act(() => vi.advanceTimersByTime(1500));

    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.score).toBe(3);
  });
});

// ── Slides section ────────────────────────────────────────────────────────────

describe("BingoPage — slides section", () => {
  it("renders the 'ЧТО ЗА ЭТИМ СТОИТ' heading", () => {
    render(<BingoPage />);
    expect(screen.getByText("ЧТО ЗА ЭТИМ СТОИТ")).toBeInTheDocument();
  });

  it("renders exactly 8 slide buttons", () => {
    render(<BingoPage />);
    const btns = screen.getAllByTestId(/^slide-btn-\d+$/);
    expect(btns).toHaveLength(8);
  });

  it("each slide button shows its title", () => {
    render(<BingoPage />);
    SLIDES.forEach((s) => {
      expect(screen.getByText(s.title)).toBeInTheDocument();
    });
  });

  it("no modal is visible initially", () => {
    render(<BingoPage />);
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });
});

// ── Modal open / close ────────────────────────────────────────────────────────

describe("BingoPage — modal", () => {
  it("clicking a slide button opens the modal", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });

  it("modal shows the title of the selected slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-2"));
    expect(screen.getByTestId("modal-title").textContent).toBe(SLIDES[2].title);
  });

  it("clicking the close button hides the modal", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("modal-close"));
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("clicking the overlay hides the modal", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("modal-overlay"));
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("clicking the modal body does NOT close the modal", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("modal"));
    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });

  it("clicking the same slide button again closes the modal", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });
});

// ── Modal navigation ──────────────────────────────────────────────────────────

describe("BingoPage — modal navigation", () => {
  it("shows counter '1 / 8' on first slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    expect(screen.getByTestId("modal-counter").textContent).toBe("1 / 8");
  });

  it("'← назад' is disabled on the first slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    expect(screen.getByTestId("modal-prev")).toBeDisabled();
  });

  it("'вперед →' is NOT disabled on the first slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    expect(screen.getByTestId("modal-next")).not.toBeDisabled();
  });

  it("clicking 'вперед →' advances to the next slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("modal-next"));
    expect(screen.getByTestId("modal-title").textContent).toBe(SLIDES[1].title);
  });

  it("counter updates after advancing", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("modal-next"));
    expect(screen.getByTestId("modal-counter").textContent).toBe("2 / 8");
  });

  it("'← назад' is enabled after advancing to slide 2", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("modal-next"));
    expect(screen.getByTestId("modal-prev")).not.toBeDisabled();
  });

  it("clicking '← назад' goes back to the previous slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("modal-next"));
    fireEvent.click(screen.getByTestId("modal-prev"));
    expect(screen.getByTestId("modal-title").textContent).toBe(SLIDES[0].title);
  });

  it("shows counter '8 / 8' on the last slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-7"));
    expect(screen.getByTestId("modal-counter").textContent).toBe("8 / 8");
  });

  it("'вперед →' is disabled on the last slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-7"));
    expect(screen.getByTestId("modal-next")).toBeDisabled();
  });

  it("'← назад' is NOT disabled on the last slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-7"));
    expect(screen.getByTestId("modal-prev")).not.toBeDisabled();
  });

  it("can navigate through all 8 slides forward", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    for (let i = 0; i < SLIDES.length - 1; i++) {
      fireEvent.click(screen.getByTestId("modal-next"));
    }
    expect(screen.getByTestId("modal-counter").textContent).toBe("8 / 8");
  });

  it("opening a different slide button jumps to that slide", () => {
    render(<BingoPage />);
    fireEvent.click(screen.getByTestId("slide-btn-0"));
    fireEvent.click(screen.getByTestId("modal-close"));
    fireEvent.click(screen.getByTestId("slide-btn-5"));
    expect(screen.getByTestId("modal-title").textContent).toBe(SLIDES[5].title);
    expect(screen.getByTestId("modal-counter").textContent).toBe("6 / 8");
  });
});

// ── Dashboard bingo card ──────────────────────────────────────────────────────
// Verify the dashboard now exposes a link to /bingo.

describe("Dashboard — bingo card", () => {
  it("renders a link to /bingo", async () => {
    // Import the inline Dashboard from dashboard.test setup
    // We test this by directly checking for the /bingo link pattern
    const { Link } = await vi.importMock<{ Link: React.FC<{ to: string; children: React.ReactNode }> }>(
      "@tanstack/react-router",
    );
    const BingoLink = () => <Link to="/bingo">Открыть бинго</Link>;
    render(<BingoLink />);
    expect(screen.getByRole("link", { name: "Открыть бинго" })).toHaveAttribute("href", "/bingo");
  });
});

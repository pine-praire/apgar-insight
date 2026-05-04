import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ApgarCircle } from "./apgar-circle";

// ── Fix time to May 15 2026 (local) ──────────────────────────────────────────
// Component uses getFullYear/getMonth/getDate so local-time consistency matters.

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0)); // May 15, 2026
});

afterAll(() => {
  vi.useRealTimers();
});

const makeResult = (score: number, day: number) => ({
  score,
  created_at: new Date(2026, 4, day, 10, 0, 0).toISOString(), // May <day> 2026
});

const makeOtherMonthResult = (score: number) => ({
  score,
  created_at: new Date(2026, 3, 10, 10, 0, 0).toISOString(), // April 10 2026
});

// ── Basic rendering ───────────────────────────────────────────────────────────

describe("ApgarCircle — rendering", () => {
  it("renders without crashing", () => {
    const { container } = render(<ApgarCircle results={[]} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("SVG has accessible label", () => {
    render(<ApgarCircle results={[]} />);
    expect(screen.getByRole("img", { name: /apgar calendar/i })).toBeInTheDocument();
  });

  it("shows the current month name (Май)", () => {
    render(<ApgarCircle results={[]} />);
    expect(screen.getByText("Май")).toBeInTheDocument();
  });

  it("shows the current year (2026)", () => {
    render(<ApgarCircle results={[]} />);
    expect(screen.getByText("2026")).toBeInTheDocument();
  });
});

// ── Sector count ──────────────────────────────────────────────────────────────

describe("ApgarCircle — sector count", () => {
  it("renders exactly 31 path sectors for May", () => {
    const { container } = render(<ApgarCircle results={[]} />);
    const paths = container.querySelectorAll("svg path");
    expect(paths).toHaveLength(31);
  });

  it("renders today-marker circle element", () => {
    const { container } = render(<ApgarCircle results={[]} />);
    const circles = container.querySelectorAll("svg circle");
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Day count label ───────────────────────────────────────────────────────────

describe("ApgarCircle — day count text", () => {
  it("shows '0 / 31 дней' with no results", () => {
    render(<ApgarCircle results={[]} />);
    expect(screen.getByText("0 / 31 дней")).toBeInTheDocument();
  });

  it("shows '1 / 31 дней' with one result", () => {
    render(<ApgarCircle results={[makeResult(10, 3)]} />);
    expect(screen.getByText("1 / 31 дней")).toBeInTheDocument();
  });

  it("shows '2 / 31 дней' with results on two different days", () => {
    render(<ApgarCircle results={[makeResult(10, 3), makeResult(5, 7)]} />);
    expect(screen.getByText("2 / 31 дней")).toBeInTheDocument();
  });

  it("two results on the same day count as 1 day", () => {
    render(<ApgarCircle results={[makeResult(10, 3), makeResult(5, 3)]} />);
    expect(screen.getByText("1 / 31 дней")).toBeInTheDocument();
  });

  it("ignores results from other months", () => {
    render(<ApgarCircle results={[makeOtherMonthResult(10)]} />);
    expect(screen.getByText("0 / 31 дней")).toBeInTheDocument();
  });

  it("ignores results from other years", () => {
    const otherYear = {
      score: 10,
      created_at: new Date(2025, 4, 3, 10, 0, 0).toISOString(),
    };
    render(<ApgarCircle results={[otherYear]} />);
    expect(screen.getByText("0 / 31 дней")).toBeInTheDocument();
  });
});

// ── Sector fill colors ────────────────────────────────────────────────────────

describe("ApgarCircle — sector fill colors", () => {
  const getSectors = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("svg path"));

  it("empty sector (no result) uses 'currentColor' fill", () => {
    const { container } = render(<ApgarCircle results={[]} />);
    const sectors = getSectors(container);
    expect(sectors[0].getAttribute("fill")).toBe("currentColor");
  });

  it("score ≥ 7 sector uses var(--success) fill", () => {
    const { container } = render(<ApgarCircle results={[makeResult(10, 1)]} />);
    const sectors = getSectors(container);
    expect(sectors[0].getAttribute("fill")).toBe("var(--success)");
  });

  it("score = 7 (boundary) uses var(--success)", () => {
    const { container } = render(<ApgarCircle results={[makeResult(7, 1)]} />);
    expect(getSectors(container)[0].getAttribute("fill")).toBe("var(--success)");
  });

  it("score 5–6 sector uses var(--warning) fill", () => {
    const { container } = render(<ApgarCircle results={[makeResult(5, 1)]} />);
    const sectors = getSectors(container);
    expect(sectors[0].getAttribute("fill")).toBe("var(--warning)");
  });

  it("score = 6 (boundary) uses var(--warning)", () => {
    const { container } = render(<ApgarCircle results={[makeResult(6, 1)]} />);
    expect(getSectors(container)[0].getAttribute("fill")).toBe("var(--warning)");
  });

  it("score ≤ 4 sector uses var(--destructive) fill", () => {
    const { container } = render(<ApgarCircle results={[makeResult(3, 1)]} />);
    const sectors = getSectors(container);
    expect(sectors[0].getAttribute("fill")).toBe("var(--destructive)");
  });

  it("score = 4 (boundary) uses var(--destructive)", () => {
    const { container } = render(<ApgarCircle results={[makeResult(4, 1)]} />);
    expect(getSectors(container)[0].getAttribute("fill")).toBe("var(--destructive)");
  });

  it("score = 0 uses var(--destructive)", () => {
    const { container } = render(<ApgarCircle results={[makeResult(0, 1)]} />);
    expect(getSectors(container)[0].getAttribute("fill")).toBe("var(--destructive)");
  });

  it("different days get independent colors", () => {
    const { container } = render(
      <ApgarCircle results={[makeResult(10, 1), makeResult(3, 2), makeResult(5, 3)]} />,
    );
    const sectors = getSectors(container);
    expect(sectors[0].getAttribute("fill")).toBe("var(--success)");
    expect(sectors[1].getAttribute("fill")).toBe("var(--destructive)");
    expect(sectors[2].getAttribute("fill")).toBe("var(--warning)");
  });

  it("empty sectors have low opacity (0.12)", () => {
    const { container } = render(<ApgarCircle results={[]} />);
    const sectors = getSectors(container);
    expect(Number(sectors[0].getAttribute("fill-opacity"))).toBeCloseTo(0.12, 2);
  });

  it("filled sectors have higher opacity (0.88)", () => {
    const { container } = render(<ApgarCircle results={[makeResult(10, 1)]} />);
    const sectors = getSectors(container);
    expect(Number(sectors[0].getAttribute("fill-opacity"))).toBeCloseTo(0.88, 2);
  });
});

// ── Latest-result-wins for same day ──────────────────────────────────────────

describe("ApgarCircle — same-day result precedence", () => {
  it("uses first entry (latest) when two results share a day — desc-sorted array", () => {
    // Results array is newest-first: score 5 is latest, score 10 is earlier
    const { container } = render(
      <ApgarCircle results={[makeResult(5, 3), makeResult(10, 3)]} />,
    );
    const sectors = Array.from(container.querySelectorAll("svg path"));
    // Day 3 = index 2; latest score 5 → warning
    expect(sectors[2].getAttribute("fill")).toBe("var(--warning)");
  });

  it("earlier result in array (score 10) does not override latest (score 3)", () => {
    const { container } = render(
      <ApgarCircle results={[makeResult(3, 3), makeResult(10, 3)]} />,
    );
    const sectors = Array.from(container.querySelectorAll("svg path"));
    expect(sectors[2].getAttribute("fill")).toBe("var(--destructive)");
  });
});

// ── Today marker ──────────────────────────────────────────────────────────────

describe("ApgarCircle — today marker", () => {
  it("today sector (day 15) has primary stroke", () => {
    const { container } = render(<ApgarCircle results={[]} />);
    const sectors = Array.from(container.querySelectorAll("svg path"));
    const todaySector = sectors[14]; // day 15 = index 14
    expect(todaySector.getAttribute("stroke")).toBe("var(--primary)");
  });

  it("non-today sector has no stroke", () => {
    const { container } = render(<ApgarCircle results={[]} />);
    const sectors = Array.from(container.querySelectorAll("svg path"));
    expect(sectors[0].getAttribute("stroke")).toBe("none"); // day 1
  });
});

// ── Tooltip (title) content ───────────────────────────────────────────────────

describe("ApgarCircle — SVG title tooltips", () => {
  it("empty sector title shows only the date", () => {
    const { container } = render(<ApgarCircle results={[]} />);
    const firstTitle = container.querySelector("svg path:first-child title");
    expect(firstTitle?.textContent).toMatch(/1 Май$/);
  });

  it("filled sector title includes score", () => {
    const { container } = render(<ApgarCircle results={[makeResult(10, 1)]} />);
    const firstTitle = container.querySelector("svg path:first-child title");
    expect(firstTitle?.textContent).toContain("10/10");
  });
});

// ── Legend ────────────────────────────────────────────────────────────────────

describe("ApgarCircle — legend", () => {
  it("renders 'Хорошо' legend item", () => {
    render(<ApgarCircle results={[]} />);
    expect(screen.getByText("Хорошо")).toBeInTheDocument();
  });

  it("renders 'Умеренно' legend item", () => {
    render(<ApgarCircle results={[]} />);
    expect(screen.getByText("Умеренно")).toBeInTheDocument();
  });

  it("renders 'Критично' legend item", () => {
    render(<ApgarCircle results={[]} />);
    expect(screen.getByText("Критично")).toBeInTheDocument();
  });
});

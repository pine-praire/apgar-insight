import { describe, it, expect } from "vitest";
import { APGAR_QUESTIONS, getVerdict } from "./apgar";

// ── Question structure ───────────────────────────────────────────────────────

describe("APGAR_QUESTIONS structure", () => {
  it("has exactly 5 questions", () => {
    expect(APGAR_QUESTIONS).toHaveLength(5);
  });

  it("uses keys A1, P, G, A2, R in order", () => {
    expect(APGAR_QUESTIONS.map((q) => q.key)).toEqual(["A1", "P", "G", "A2", "R"]);
  });

  it("every question has exactly 3 options", () => {
    for (const q of APGAR_QUESTIONS) {
      expect(q.options).toHaveLength(3);
    }
  });

  it("every question has options with values 0, 1, 2", () => {
    for (const q of APGAR_QUESTIONS) {
      const values = q.options.map((o) => o.value).sort();
      expect(values).toEqual([0, 1, 2]);
    }
  });

  it("maximum possible score is 10 (5 questions × 2)", () => {
    const max = APGAR_QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map((o) => o.value)), 0);
    expect(max).toBe(10);
  });

  it("minimum possible score is 0", () => {
    const min = APGAR_QUESTIONS.reduce((sum, q) => sum + Math.min(...q.options.map((o) => o.value)), 0);
    expect(min).toBe(0);
  });
});

// ── getVerdict ───────────────────────────────────────────────────────────────

describe("getVerdict", () => {
  // Critical boundary: score <= 4
  it("score 0 → critical", () => expect(getVerdict(0).level).toBe("critical"));
  it("score 1 → critical", () => expect(getVerdict(1).level).toBe("critical"));
  it("score 4 → critical (upper boundary)", () => expect(getVerdict(4).level).toBe("critical"));

  // Warning boundary: 5 <= score <= 6
  it("score 5 → warning (lower boundary)", () => expect(getVerdict(5).level).toBe("warning"));
  it("score 6 → warning (upper boundary)", () => expect(getVerdict(6).level).toBe("warning"));

  // Good boundary: score >= 7
  it("score 7 → good (lower boundary)", () => expect(getVerdict(7).level).toBe("good"));
  it("score 10 → good (maximum)", () => expect(getVerdict(10).level).toBe("good"));

  it("every verdict has title, short, description, level", () => {
    for (const score of [0, 5, 10]) {
      const v = getVerdict(score);
      expect(v.title).toBeTruthy();
      expect(v.short).toBeTruthy();
      expect(v.description).toBeTruthy();
      expect(["critical", "warning", "good"]).toContain(v.level);
    }
  });
});

// ── Score calculation (logic extracted from test.tsx) ────────────────────────

describe("score calculation", () => {
  const calcScore = (answers: Partial<Record<string, 0 | 1 | 2>>) =>
    APGAR_QUESTIONS.reduce((sum, q) => sum + (answers[q.key] ?? 0), 0);

  it("all-zeros gives score 0", () => {
    expect(calcScore({ A1: 0, P: 0, G: 0, A2: 0, R: 0 })).toBe(0);
  });

  it("all-twos gives score 10", () => {
    expect(calcScore({ A1: 2, P: 2, G: 2, A2: 2, R: 2 })).toBe(10);
  });

  it("all-ones gives score 5", () => {
    expect(calcScore({ A1: 1, P: 1, G: 1, A2: 1, R: 1 })).toBe(5);
  });

  it("mixed answers sum correctly", () => {
    expect(calcScore({ A1: 2, P: 1, G: 0, A2: 2, R: 1 })).toBe(6);
  });

  it("missing answer defaults to 0", () => {
    // Only 4 answers filled — 5th defaults to 0
    expect(calcScore({ A1: 2, P: 2, G: 2, A2: 2 })).toBe(8);
  });

  it("score 5 produces warning verdict (critical edge)", () => {
    const score = calcScore({ A1: 1, P: 1, G: 1, A2: 1, R: 1 });
    expect(getVerdict(score).level).toBe("warning");
  });

  it("score 4 produces critical verdict (warning edge)", () => {
    const score = calcScore({ A1: 2, P: 2, G: 0, A2: 0, R: 0 });
    expect(getVerdict(score).level).toBe("critical");
  });
});

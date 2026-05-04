import { describe, it, expect } from "vitest";
import {
  PROCRASTINATION_QUESTIONS,
  PROCRASTINATION_TYPES,
  calculateProcrastinationResult,
  type ProcrastinationType,
} from "./procrastination";

const ALL_TYPES: ProcrastinationType[] = [
  "cleaner", "panicker", "list_maker", "sleeper", "multitasker",
  "socializer", "researcher", "foodie", "netflixer", "timer",
];

// ── Question structure ──────────────────────────────────────────────────────

describe("PROCRASTINATION_QUESTIONS structure", () => {
  it("has exactly 12 questions", () => {
    expect(PROCRASTINATION_QUESTIONS).toHaveLength(12);
  });

  it("question ids are 1–12 in order", () => {
    expect(PROCRASTINATION_QUESTIONS.map((q) => q.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it("every question has exactly 4 options", () => {
    for (const q of PROCRASTINATION_QUESTIONS) {
      expect(q.options).toHaveLength(4);
    }
  });

  it("every option has a non-empty text", () => {
    for (const q of PROCRASTINATION_QUESTIONS) {
      for (const o of q.options) {
        expect(o.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("every option type is one of the 10 valid archetypes", () => {
    for (const q of PROCRASTINATION_QUESTIONS) {
      for (const o of q.options) {
        expect(ALL_TYPES).toContain(o.type);
      }
    }
  });

  it("no question has two options with the same type", () => {
    for (const q of PROCRASTINATION_QUESTIONS) {
      const types = q.options.map((o) => o.type);
      expect(new Set(types).size).toBe(types.length);
    }
  });

  it("all 10 archetypes appear in the question set", () => {
    const usedTypes = new Set(
      PROCRASTINATION_QUESTIONS.flatMap((q) => q.options.map((o) => o.type)),
    );
    for (const t of ALL_TYPES) {
      expect(usedTypes).toContain(t);
    }
  });
});

// ── Type definitions ────────────────────────────────────────────────────────

describe("PROCRASTINATION_TYPES definitions", () => {
  it("defines all 10 archetypes", () => {
    for (const t of ALL_TYPES) {
      expect(PROCRASTINATION_TYPES[t]).toBeDefined();
    }
  });

  it("every type has a non-empty emoji", () => {
    for (const t of ALL_TYPES) {
      expect(PROCRASTINATION_TYPES[t].emoji.length).toBeGreaterThan(0);
    }
  });

  it("every type has a non-empty title", () => {
    for (const t of ALL_TYPES) {
      expect(PROCRASTINATION_TYPES[t].title.length).toBeGreaterThan(0);
    }
  });

  it("every type has a non-empty description", () => {
    for (const t of ALL_TYPES) {
      expect(PROCRASTINATION_TYPES[t].description.length).toBeGreaterThan(0);
    }
  });

  it("every type has a non-empty insight", () => {
    for (const t of ALL_TYPES) {
      expect(PROCRASTINATION_TYPES[t].insight.length).toBeGreaterThan(0);
    }
  });

  it("every type has exactly 3 tools", () => {
    for (const t of ALL_TYPES) {
      expect(PROCRASTINATION_TYPES[t].tools).toHaveLength(3);
    }
  });

  it("all tools are non-empty strings", () => {
    for (const t of ALL_TYPES) {
      for (const tool of PROCRASTINATION_TYPES[t].tools) {
        expect(tool.length).toBeGreaterThan(0);
      }
    }
  });

  it("all titles are unique", () => {
    const titles = ALL_TYPES.map((t) => PROCRASTINATION_TYPES[t].title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("all emojis are unique", () => {
    const emojis = ALL_TYPES.map((t) => PROCRASTINATION_TYPES[t].emoji);
    expect(new Set(emojis).size).toBe(emojis.length);
  });
});

// ── calculateProcrastinationResult ─────────────────────────────────────────

describe("calculateProcrastinationResult", () => {
  it("returns the single dominant type", () => {
    const answers: ProcrastinationType[] = [
      "cleaner", "cleaner", "cleaner", "panicker", "panicker",
      "sleeper", "foodie", "multitasker", "timer", "researcher",
      "socializer", "netflixer",
    ];
    expect(calculateProcrastinationResult(answers)).toEqual(["cleaner"]);
  });

  it("returns all tied types when two types share the max count", () => {
    const answers: ProcrastinationType[] = [
      "cleaner", "cleaner", "panicker", "panicker",
      "sleeper", "foodie", "multitasker", "timer",
      "researcher", "socializer", "netflixer", "list_maker",
    ];
    const result = calculateProcrastinationResult(answers);
    expect(result).toHaveLength(2);
    expect(result).toContain("cleaner");
    expect(result).toContain("panicker");
  });

  it("handles all-same answers", () => {
    const answers: ProcrastinationType[] = Array(12).fill("timer");
    expect(calculateProcrastinationResult(answers)).toEqual(["timer"]);
  });

  it("handles three-way tie", () => {
    const answers: ProcrastinationType[] = [
      "cleaner", "cleaner", "cleaner",
      "panicker", "panicker", "panicker",
      "sleeper", "sleeper", "sleeper",
      "foodie", "multitasker", "timer",
    ];
    const result = calculateProcrastinationResult(answers);
    expect(result).toHaveLength(3);
    expect(result).toContain("cleaner");
    expect(result).toContain("panicker");
    expect(result).toContain("sleeper");
  });

  it("returns an array (always), not a single string", () => {
    expect(Array.isArray(calculateProcrastinationResult(["cleaner"]))).toBe(true);
  });

  it("does not include types with count below the max", () => {
    const answers: ProcrastinationType[] = [
      "cleaner", "cleaner", "cleaner",
      "panicker", "panicker",
      "sleeper", "foodie", "multitasker", "timer",
      "researcher", "socializer", "netflixer",
    ];
    const result = calculateProcrastinationResult(answers);
    expect(result).toEqual(["cleaner"]);
    expect(result).not.toContain("panicker");
  });
});

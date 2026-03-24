import { describe, test, expect } from "bun:test";
import { detectPlateau, detectOscillation, parseGeneratorOutput } from "./loop.ts";

describe("detectPlateau", () => {
  test("returns false with fewer than 3 scores", () => {
    expect(detectPlateau([{ percentage: 50 }])).toBe(false);
    expect(detectPlateau([{ percentage: 50 }, { percentage: 52 }])).toBe(false);
  });

  test("returns true when last 3 scores are within ±5", () => {
    const scores = [
      { percentage: 60 },
      { percentage: 62 },
      { percentage: 60 },
    ];
    expect(detectPlateau(scores)).toBe(true);
  });

  test("returns false when scores vary by more than 5", () => {
    const scores = [
      { percentage: 60 },
      { percentage: 80 },
      { percentage: 62 },
    ];
    expect(detectPlateau(scores)).toBe(false);
  });

  test("only checks last 3 scores", () => {
    const scores = [
      { percentage: 20 },
      { percentage: 80 },
      { percentage: 61 },
      { percentage: 60 },
      { percentage: 62 },
    ];
    expect(detectPlateau(scores)).toBe(true);
  });

  test("returns true for identical scores", () => {
    const scores = [
      { percentage: 50 },
      { percentage: 50 },
      { percentage: 50 },
    ];
    expect(detectPlateau(scores)).toBe(true);
  });
});

describe("detectOscillation", () => {
  test("returns false with fewer than 4 scores", () => {
    expect(detectOscillation([{ percentage: 50 }, { percentage: 60 }, { percentage: 50 }])).toBe(false);
  });

  test("returns true for alternating up/down pattern", () => {
    const scores = [
      { percentage: 50 },
      { percentage: 60 },
      { percentage: 50 },
      { percentage: 60 },
    ];
    expect(detectOscillation(scores)).toBe(true);
  });

  test("returns false for consistently increasing scores", () => {
    const scores = [
      { percentage: 40 },
      { percentage: 50 },
      { percentage: 60 },
      { percentage: 70 },
    ];
    expect(detectOscillation(scores)).toBe(false);
  });

  test("returns false for consistently decreasing scores", () => {
    const scores = [
      { percentage: 70 },
      { percentage: 60 },
      { percentage: 50 },
      { percentage: 40 },
    ];
    expect(detectOscillation(scores)).toBe(false);
  });
});

describe("parseGeneratorOutput", () => {
  test("extracts change line and content", () => {
    const raw = `// CHANGE: Added a specific data point to the opening
Here is the improved content about AI agents.`;

    const result = parseGeneratorOutput(raw);
    expect(result.change).toBe("Added a specific data point to the opening");
    expect(result.content).toBe("Here is the improved content about AI agents.");
  });

  test("returns full content when no change line", () => {
    const raw = "Just some content without a change marker.";

    const result = parseGeneratorOutput(raw);
    expect(result.change).toBe("");
    expect(result.content).toBe("Just some content without a change marker.");
  });

  test("handles multiline content after change", () => {
    const raw = `// CHANGE: Rewrote the hook
Line one
Line two
Line three`;

    const result = parseGeneratorOutput(raw);
    expect(result.change).toBe("Rewrote the hook");
    expect(result.content).toBe("Line one\nLine two\nLine three");
  });
});

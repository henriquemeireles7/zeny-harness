import { describe, test, expect } from "bun:test";
import { detectPlateau, detectOscillation } from "./loop.ts";

describe("detectPlateau", () => {
  test("returns false with fewer than 3 scores", () => {
    expect(detectPlateau([{ composite: 50 }])).toBe(false);
    expect(detectPlateau([{ composite: 50 }, { composite: 52 }])).toBe(false);
  });

  test("returns true when last 3 scores are within ±2", () => {
    const scores = [
      { composite: 60 },
      { composite: 61 },
      { composite: 60 },
    ];
    expect(detectPlateau(scores)).toBe(true);
  });

  test("returns false when scores vary by more than 2", () => {
    const scores = [
      { composite: 60 },
      { composite: 65 },
      { composite: 62 },
    ];
    expect(detectPlateau(scores)).toBe(false);
  });

  test("only checks last 3 scores", () => {
    const scores = [
      { composite: 20 },
      { composite: 80 },
      { composite: 61 },
      { composite: 60 },
      { composite: 62 },
    ];
    expect(detectPlateau(scores)).toBe(true);
  });

  test("returns true for identical scores", () => {
    const scores = [
      { composite: 50 },
      { composite: 50 },
      { composite: 50 },
    ];
    expect(detectPlateau(scores)).toBe(true);
  });
});

describe("detectOscillation", () => {
  test("returns false with fewer than 4 scores", () => {
    expect(detectOscillation([{ composite: 50 }, { composite: 60 }, { composite: 50 }])).toBe(false);
  });

  test("returns true for alternating up/down pattern", () => {
    const scores = [
      { composite: 50 },
      { composite: 60 },
      { composite: 50 },
      { composite: 60 },
    ];
    expect(detectOscillation(scores)).toBe(true);
  });

  test("returns false for consistently increasing scores", () => {
    const scores = [
      { composite: 40 },
      { composite: 50 },
      { composite: 60 },
      { composite: 70 },
    ];
    expect(detectOscillation(scores)).toBe(false);
  });

  test("returns false for consistently decreasing scores", () => {
    const scores = [
      { composite: 70 },
      { composite: 60 },
      { composite: 50 },
      { composite: 40 },
    ];
    expect(detectOscillation(scores)).toBe(false);
  });

  test("only checks last 4 scores", () => {
    const scores = [
      { composite: 10 },
      { composite: 20 },
      { composite: 30 },
      { composite: 50 },
      { composite: 60 },
      { composite: 50 },
      { composite: 60 },
    ];
    expect(detectOscillation(scores)).toBe(true);
  });
});

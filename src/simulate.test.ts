import { describe, test, expect } from "bun:test";
import { parseEvalResponse, parseEvalsFile } from "./simulate.ts";
import type { Eval } from "./simulate.ts";

const testEvals: Eval[] = [
  { name: "Consciousness floor", question: "Is this free of fear-mongering?", isFloor: true },
  { name: "Genuine value", question: "Does this help the reader?", isFloor: false },
  { name: "Hook", question: "Does the opening have a specific claim?", isFloor: false },
];

describe("parseEvalResponse", () => {
  test("parses all yes responses", () => {
    const response = `eval_1: yes
eval_2: yes
eval_3: yes`;

    const score = parseEvalResponse(response, testEvals);
    expect(score.passed).toBe(3);
    expect(score.total).toBe(3);
    expect(score.percentage).toBe(100);
    expect(score.floorFailed).toBe(false);
  });

  test("parses mixed responses", () => {
    const response = `eval_1: yes
eval_2: no
eval_3: yes`;

    const score = parseEvalResponse(response, testEvals);
    expect(score.passed).toBe(2);
    expect(score.total).toBe(3);
    expect(score.percentage).toBe(67);
    expect(score.floorFailed).toBe(false);
  });

  test("forces score to 0 when floor eval fails", () => {
    const response = `eval_1: no
eval_2: yes
eval_3: yes`;

    const score = parseEvalResponse(response, testEvals);
    expect(score.passed).toBe(0);
    expect(score.percentage).toBe(0);
    expect(score.floorFailed).toBe(true);
  });

  test("handles case-insensitive responses", () => {
    const response = `eval_1: YES
eval_2: No
eval_3: Yes`;

    const score = parseEvalResponse(response, testEvals);
    expect(score.passed).toBe(2);
    expect(score.results[0].passed).toBe(true);
    expect(score.results[1].passed).toBe(false);
    expect(score.results[2].passed).toBe(true);
  });

  test("defaults to false for unparseable responses", () => {
    const score = parseEvalResponse("I don't understand", testEvals);
    expect(score.passed).toBe(0);
    expect(score.percentage).toBe(0);
  });

  test("handles noisy LLM output with extra text", () => {
    const response = `Here are my evaluations:

Based on the content:
eval_1: yes
eval_2: yes
eval_3: no

These are my honest assessments.`;

    const score = parseEvalResponse(response, testEvals);
    expect(score.passed).toBe(2);
    expect(score.results[0].passed).toBe(true);
    expect(score.results[1].passed).toBe(true);
    expect(score.results[2].passed).toBe(false);
  });

  test("all no responses gives 0%", () => {
    const nonFloorEvals: Eval[] = [
      { name: "A", question: "q", isFloor: false },
      { name: "B", question: "q", isFloor: false },
    ];
    const response = `eval_1: no
eval_2: no`;

    const score = parseEvalResponse(response, nonFloorEvals);
    expect(score.passed).toBe(0);
    expect(score.percentage).toBe(0);
    expect(score.floorFailed).toBe(false);
  });
});

describe("parseEvalsFile", () => {
  test("parses eval file format", () => {
    const content = `# Evals

EVAL 1: Consciousness floor
Question: Is this content free of fear-mongering?
Pass: Content is positive
Fail: Content uses fear
NOTE: Hard floor — if this fails, score is 0

EVAL 2: Value check
Question: Does this help the reader?
Pass: Reader learns something
Fail: Content is empty`;

    const evals = parseEvalsFile(content);
    expect(evals).toHaveLength(2);
    expect(evals[0].name).toBe("Consciousness floor");
    expect(evals[0].question).toBe("Is this content free of fear-mongering?");
    expect(evals[0].isFloor).toBe(true);
    expect(evals[1].name).toBe("Value check");
    expect(evals[1].isFloor).toBe(false);
  });

  test("returns empty array for no evals", () => {
    const evals = parseEvalsFile("# Just a header\nNo evals here");
    expect(evals).toHaveLength(0);
  });

  test("handles evals without floor annotation", () => {
    const content = `EVAL 1: Simple check
Question: Is the text under 200 words?
Pass: Under 200
Fail: Over 200`;

    const evals = parseEvalsFile(content);
    expect(evals).toHaveLength(1);
    expect(evals[0].isFloor).toBe(false);
  });

  test("parses multiple evals in sequence", () => {
    const content = `EVAL 1: A
Question: Is A true?

EVAL 2: B
Question: Is B true?

EVAL 3: C
Question: Is C true?`;

    const evals = parseEvalsFile(content);
    expect(evals).toHaveLength(3);
    expect(evals.map((e) => e.name)).toEqual(["A", "B", "C"]);
  });
});

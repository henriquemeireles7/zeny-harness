import { describe, test, expect } from "bun:test";
import { parseScoreResponse } from "./simulate.ts";

describe("parseScoreResponse", () => {
  test("extracts all 5 sub-metrics from well-formatted response", () => {
    const response = `engagement_depth: 4
controversy: 2
memorability: 3
virality_proxy: 5
hook_survival: 4`;

    const score = parseScoreResponse(response);
    expect(score.subMetrics.engagementDepth).toBe(4);
    expect(score.subMetrics.controversy).toBe(2);
    expect(score.subMetrics.memorability).toBe(3);
    expect(score.subMetrics.viralityProxy).toBe(5);
    expect(score.subMetrics.hookSurvival).toBe(4);
  });

  test("computes composite score correctly", () => {
    // All 5s: (5*0.3 + 5*0.15 + 5*0.25 + 5*0.2 + 5*0.1) * 20 = 5 * 1.0 * 20 = 100
    const response = `engagement_depth: 5
controversy: 5
memorability: 5
virality_proxy: 5
hook_survival: 5`;

    const score = parseScoreResponse(response);
    expect(score.composite).toBe(100);
  });

  test("computes composite for mixed scores", () => {
    // (3*0.3 + 1*0.15 + 2*0.25 + 4*0.2 + 5*0.1) * 20
    // = (0.9 + 0.15 + 0.5 + 0.8 + 0.5) * 20 = 2.85 * 20 = 57
    const response = `engagement_depth: 3
controversy: 1
memorability: 2
virality_proxy: 4
hook_survival: 5`;

    const score = parseScoreResponse(response);
    expect(score.composite).toBe(57);
  });

  test("clamps values above 5 to 5", () => {
    const response = `engagement_depth: 9
controversy: 0
memorability: 0
virality_proxy: 0
hook_survival: 0`;

    const score = parseScoreResponse(response);
    expect(score.subMetrics.engagementDepth).toBe(5);
  });

  test("defaults to 0 for missing metrics", () => {
    const response = "engagement_depth: 3";

    const score = parseScoreResponse(response);
    expect(score.subMetrics.engagementDepth).toBe(3);
    expect(score.subMetrics.controversy).toBe(0);
    expect(score.subMetrics.memorability).toBe(0);
    expect(score.subMetrics.viralityProxy).toBe(0);
    expect(score.subMetrics.hookSurvival).toBe(0);
  });

  test("handles noisy/chatty LLM output with extra text", () => {
    const response = `Here are my ratings:

Based on the reactions, I would score:
engagement_depth: 4
controversy: 2
memorability: 3
virality_proxy: 1
hook_survival: 5

These scores reflect the overall engagement patterns.`;

    const score = parseScoreResponse(response);
    expect(score.subMetrics.engagementDepth).toBe(4);
    expect(score.subMetrics.controversy).toBe(2);
    expect(score.subMetrics.memorability).toBe(3);
    expect(score.subMetrics.viralityProxy).toBe(1);
    expect(score.subMetrics.hookSurvival).toBe(5);
  });

  test("returns all zeros for completely unparseable response", () => {
    const score = parseScoreResponse("I don't understand the question.");
    expect(score.composite).toBe(0);
    expect(score.subMetrics.engagementDepth).toBe(0);
  });

  test("composite is 0 when all sub-metrics are 0", () => {
    const response = `engagement_depth: 0
controversy: 0
memorability: 0
virality_proxy: 0
hook_survival: 0`;

    const score = parseScoreResponse(response);
    expect(score.composite).toBe(0);
  });
});

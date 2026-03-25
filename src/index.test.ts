import { describe, test, expect } from "bun:test";
import { parseArgs } from "./index.ts";

describe("parseArgs", () => {
  test("parses --seed flag", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md"]);
    expect(args.seed).toBe("tweet.md");
    expect(args.control).toBe(false);
  });

  test("parses --control flag", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md", "--control"]);
    expect(args.control).toBe(true);
  });

  test("parses --max-iterations flag", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md", "--max-iterations", "5"]);
    expect(args.maxIterations).toBe(5);
  });

  test("parses --personas-dir flag", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md", "--personas-dir", "/custom/personas"]);
    expect(args.personasDir).toBe("/custom/personas");
  });

  test("parses --baseline flag", () => {
    const args = parseArgs(["node", "zeny", "--baseline", "/my/baseline.md"]);
    expect(args.baseline).toBe("/my/baseline.md");
  });

  test("parses --evals flag", () => {
    const args = parseArgs(["node", "zeny", "--evals", "/my/evals.md"]);
    expect(args.evals).toBe("/my/evals.md");
  });

  test("defaults maxIterations to 10", () => {
    const args = parseArgs(["node", "zeny"]);
    expect(args.maxIterations).toBe(10);
  });

  test("defaults control to false", () => {
    const args = parseArgs(["node", "zeny"]);
    expect(args.control).toBe(false);
  });

  test("no --seed means seed is undefined (will auto-generate)", () => {
    const args = parseArgs(["node", "zeny"]);
    expect(args.seed).toBeUndefined();
  });

  test("parses all flags together", () => {
    const args = parseArgs([
      "node", "zeny",
      "--seed", "input.md",
      "--baseline", "/my/baseline.md",
      "--evals", "/my/evals.md",
      "--control",
      "--max-iterations", "3",
      "--personas-dir", "/my/personas",
    ]);
    expect(args.seed).toBe("input.md");
    expect(args.baseline).toBe("/my/baseline.md");
    expect(args.evals).toBe("/my/evals.md");
    expect(args.control).toBe(true);
    expect(args.maxIterations).toBe(3);
    expect(args.personasDir).toBe("/my/personas");
  });
});

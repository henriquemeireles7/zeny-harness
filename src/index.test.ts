import { describe, test, expect } from "bun:test";
import { parseArgs } from "./index.ts";

describe("parseArgs", () => {
  test("parses --seed flag", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md"]);
    expect(args.seed).toBe("tweet.md");
    expect(args.prompt).toBeUndefined();
    expect(args.control).toBe(false);
  });

  test("parses --prompt flag", () => {
    const args = parseArgs(["node", "zeny", "--prompt", "Write a tweet"]);
    expect(args.prompt).toBe("Write a tweet");
    expect(args.seed).toBeUndefined();
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

  test("parses --icp flag", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md", "--icp", "/my/icp.md"]);
    expect(args.icp).toBe("/my/icp.md");
  });

  test("parses --evals flag", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md", "--evals", "/my/evals.md"]);
    expect(args.evals).toBe("/my/evals.md");
  });

  test("defaults maxIterations to 10", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md"]);
    expect(args.maxIterations).toBe(10);
  });

  test("defaults control to false", () => {
    const args = parseArgs(["node", "zeny", "--seed", "tweet.md"]);
    expect(args.control).toBe(false);
  });

  test("parses all flags together", () => {
    const args = parseArgs([
      "node", "zeny",
      "--seed", "input.md",
      "--icp", "/my/icp.md",
      "--evals", "/my/evals.md",
      "--control",
      "--max-iterations", "3",
      "--personas-dir", "/my/personas",
    ]);
    expect(args.seed).toBe("input.md");
    expect(args.icp).toBe("/my/icp.md");
    expect(args.evals).toBe("/my/evals.md");
    expect(args.control).toBe(true);
    expect(args.maxIterations).toBe(3);
    expect(args.personasDir).toBe("/my/personas");
  });
});

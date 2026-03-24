import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runClaude } from "./claude.ts";
import { simulate } from "./simulate.ts";
import type { SimulationResult, EvalScore, Eval } from "./simulate.ts";
import {
  loadLessons,
  saveLessons,
  loadPersonaMemory,
  savePersonaMemory,
  type Persona,
} from "./memory.ts";

export interface LoopOptions {
  seed: string;
  personas: Persona[];
  evals: Eval[];
  icp: string;
  runDir: string;
  maxIterations: number;
  controlMode: boolean;
}

const PLATEAU_WINDOW = 3;
const PLATEAU_THRESHOLD = 5;
const OSCILLATION_WINDOW = 4;
const CONTENT_PREVIEW_LENGTH = 500;

export async function runLoop(options: LoopOptions): Promise<void> {
  const { seed, personas, evals, icp, runDir, maxIterations, controlMode } = options;

  await mkdir(join(runDir, "simulation"), { recursive: true });
  await mkdir(join(runDir, "raw"), { recursive: true });

  const scores: { cycle: number; percentage: number; results: EvalScore["results"] }[] = [];
  let currentAsset = seed;
  let bestAsset = seed;
  let bestScore = 0;
  let worstEval = "";

  // Save v0 (seed)
  await writeFile(join(runDir, "v0.md"), seed);

  printHeader(controlMode);
  printEvals(evals);

  for (let cycle = 1; cycle <= maxIterations; cycle++) {
    printCycleStart(cycle, maxIterations);

    try {
      // Load memory (skip in control mode)
      let lessons = "";
      if (!controlMode) {
        lessons = await loadLessons(runDir);
        for (const p of personas) {
          p.memory = await loadPersonaMemory(runDir, p.name);
        }
      }

      // Generate improved asset — single targeted mutation
      printStep("Generating...");

      const mutationTarget = worstEval
        ? `\n\nFOCUS: The weakest point in the last version was: "${worstEval}". Make ONE specific change to address this.`
        : "";
      const lessonsSection =
        lessons && !controlMode ? `\n\nLessons learned so far:\n${lessons}` : "";

      const generatePrompt = `You are improving a piece of content through targeted iteration.

Here is the current version:

---
${currentAsset}
---

Target audience: ${icp || "General audience"}
${mutationTarget}${lessonsSection}

Make ONE specific, focused change to improve this content. Do not rewrite from scratch.
State what you changed in a single comment line starting with "// CHANGE:" at the very top, then output the improved content.

Example format:
// CHANGE: Replaced generic opening with a specific data point
[improved content here]`;

      const rawOutput = await runClaude(generatePrompt);

      // Parse out the change description and content
      const { change, content: newAsset } = parseGeneratorOutput(rawOutput);
      await writeFile(join(runDir, `v${cycle}.md`), newAsset);
      await writeFile(join(runDir, `raw/cycle-${cycle}.txt`), rawOutput);

      // Print content preview
      printContentPreview(newAsset);
      if (change) printStep(`Change: ${change}`);

      // Simulate
      printStep("Running persona simulation...");
      const simulation = await simulate(newAsset, personas, evals, icp);

      // Save raw simulation data
      await writeFile(
        join(runDir, "simulation", `round-${cycle}.json`),
        JSON.stringify(simulation, null, 2),
      );

      // Print persona reactions
      for (const r of simulation.reactions) {
        printPersonaReaction(r.persona, r.reaction);
      }

      // Score
      const { score } = simulation;
      printScore(score);

      scores.push({ cycle, percentage: score.percentage, results: score.results });

      // Find worst eval for next cycle's mutation target
      const failedEvals = score.results.filter((r) => !r.passed);
      worstEval = failedEvals.length > 0 ? failedEvals[0].eval : "";

      // Decide: keep or discard
      const previousScore = scores.length > 1 ? scores[scores.length - 2].percentage : 0;
      const kept = score.percentage >= previousScore;

      if (kept) {
        currentAsset = newAsset;
        if (score.percentage > bestScore) {
          bestScore = score.percentage;
          bestAsset = newAsset;
        }
        printDecision("KEPT", score.percentage, previousScore);
      } else {
        printDecision("DISCARDED", score.percentage, previousScore);
        currentAsset = bestAsset;
      }

      // Reflect and update memory (skip in control mode)
      if (!controlMode) {
        printStep("Reflecting...");
        const evalSummary = score.results
          .map((r) => `  ${r.passed ? "PASS" : "FAIL"}: ${r.eval}`)
          .join("\n");

        const reflectionPrompt = `You just ran an experiment improving content. Here are the results:

Score: ${score.passed}/${score.total} evals passed (${score.percentage}%)${score.floorFailed ? "\nFLOOR FAILED: Content failed the consciousness floor — score forced to 0." : ""}
Decision: ${kept ? "KEPT — this version is better" : "DISCARDED — reverting to previous best"}

Eval results:
${evalSummary}

Persona reactions:
${simulation.reactions.map((r) => `[${r.persona}]: ${r.reaction}`).join("\n")}

Write a brief lesson (2-3 sentences) about what worked or didn't work and what ONE thing to try next.${!kept ? " Since this version was discarded, suggest a fundamentally different approach." : ""}`;

        try {
          const reflection = await runClaude(reflectionPrompt);
          const newLesson = `\n---\nCycle ${cycle} (${score.percentage}%): ${reflection}`;
          const existingLessons = await loadLessons(runDir);
          await saveLessons(runDir, existingLessons + newLesson);

          for (const r of simulation.reactions) {
            const persona = personas.find((p) => p.name === r.persona);
            if (persona) {
              const existingMemory = await loadPersonaMemory(runDir, r.persona);
              const newMemory = `${existingMemory}\n---\nCycle ${cycle}: Score ${score.percentage}%. My reaction: ${r.reaction.slice(0, 200)}`;
              await savePersonaMemory(runDir, r.persona, newMemory);
            }
          }
        } catch (err) {
          console.warn(`  Reflection failed: ${err}. Continuing.`);
        }
      }

      // Check stopping conditions
      if (score.percentage === 100) {
        printStop("Perfect score — all evals passing.");
        break;
      }
      if (detectPlateau(scores)) {
        printStop("Plateau detected — scores haven't changed in 3 cycles.");
        break;
      }
      if (detectOscillation(scores)) {
        printStop("Oscillation detected — scores alternating for 4+ cycles.");
        break;
      }
    } catch (err) {
      console.warn(`\n  Cycle ${cycle} failed: ${err}. Skipping.`);
    }
  }

  // Save scores
  await writeFile(join(runDir, "scores.json"), JSON.stringify(scores, null, 2));

  // Write summary
  await writeSummary(runDir, scores, bestAsset, bestScore, controlMode, evals);

  printFooter(scores, bestScore, controlMode);
}

function parseGeneratorOutput(raw: string): { change: string; content: string } {
  const lines = raw.split("\n");
  if (lines[0]?.startsWith("// CHANGE:")) {
    return {
      change: lines[0].replace("// CHANGE:", "").trim(),
      content: lines.slice(1).join("\n").trim(),
    };
  }
  return { change: "", content: raw.trim() };
}

function detectPlateau(scores: { percentage: number }[]): boolean {
  if (scores.length < PLATEAU_WINDOW) return false;
  const recent = scores.slice(-PLATEAU_WINDOW);
  const max = Math.max(...recent.map((s) => s.percentage));
  const min = Math.min(...recent.map((s) => s.percentage));
  return max - min <= PLATEAU_THRESHOLD;
}

function detectOscillation(scores: { percentage: number }[]): boolean {
  if (scores.length < OSCILLATION_WINDOW) return false;
  const recent = scores.slice(-OSCILLATION_WINDOW);
  let alternations = 0;
  for (let i = 1; i < recent.length; i++) {
    const prev = i > 1 ? recent[i - 1].percentage - recent[i - 2].percentage : 0;
    const curr = recent[i].percentage - recent[i - 1].percentage;
    if (prev !== 0 && curr !== 0 && Math.sign(prev) !== Math.sign(curr)) {
      alternations++;
    }
  }
  return alternations >= OSCILLATION_WINDOW - 2;
}

async function writeSummary(
  runDir: string,
  scores: { cycle: number; percentage: number; results: EvalScore["results"] }[],
  bestAsset: string,
  bestScore: number,
  controlMode: boolean,
  evals: Eval[],
): Promise<void> {
  const scoreCurve = scores
    .map((s) => `  Cycle ${s.cycle}: ${s.percentage}%`)
    .join("\n");

  const bestCycle = scores.reduce(
    (best, s) => (s.percentage > best.percentage ? s : best),
    scores[0],
  );

  const evalBreakdown = evals
    .map((e) => {
      const passCount = scores.filter((s) =>
        s.results.find((r) => r.eval === e.name)?.passed,
      ).length;
      return `- ${e.name}: ${passCount}/${scores.length} cycles passed`;
    })
    .join("\n");

  const summary = `# Session Summary${controlMode ? " (CONTROL RUN)" : ""}

## Best Version
Score: ${bestScore}% (Cycle ${bestCycle?.cycle ?? 0})

## Learning Curve
${scoreCurve}

## Eval Breakdown
${evalBreakdown}

## Best Asset
${bestAsset}
`;

  await writeFile(join(runDir, "summary.md"), summary);
}

// --- Dashboard output ---

function printHeader(controlMode: boolean): void {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(
    controlMode
      ? "║       ZENY — CONTROL RUN (no learning)       ║"
      : "║       ZENY — Self-Learning Loop               ║",
  );
  console.log("╚══════════════════════════════════════════════╝\n");
}

function printEvals(evals: Eval[]): void {
  console.log("  Evals loaded:");
  for (const e of evals) {
    console.log(`    ${e.isFloor ? "🚫" : "✓"} ${e.name}: ${e.question.slice(0, 80)}`);
  }
  console.log("");
}

function printCycleStart(cycle: number, max: number): void {
  console.log(`\n┌─── Cycle ${cycle}/${max} ${"─".repeat(30)}┐`);
}

function printStep(msg: string): void {
  console.log(`  → ${msg}`);
}

function printContentPreview(content: string): void {
  const preview = content.length > CONTENT_PREVIEW_LENGTH
    ? content.slice(0, CONTENT_PREVIEW_LENGTH) + "..."
    : content;
  console.log(`\n  ┌─ Content Preview ──────────────────────────┐`);
  for (const line of preview.split("\n").slice(0, 8)) {
    console.log(`  │ ${line.slice(0, 60)}`);
  }
  console.log(`  └────────────────────────────────────────────┘\n`);
}

function printPersonaReaction(name: string, reaction: string): void {
  const short = reaction.length > 120 ? reaction.slice(0, 120) + "..." : reaction;
  console.log(`  💬 ${name}: "${short}"`);
}

function printScore(score: EvalScore): void {
  if (score.floorFailed) {
    console.log(`  🚫 FLOOR FAILED — score forced to 0%`);
  }
  const bar = "█".repeat(Math.round(score.percentage / 5)) + "░".repeat(20 - Math.round(score.percentage / 5));
  console.log(`  📊 Score: ${score.passed}/${score.total} (${score.percentage}%) [${bar}]`);
  for (const r of score.results) {
    console.log(`     ${r.passed ? "✅" : "❌"} ${r.eval}`);
  }
}

function printDecision(decision: string, current: number, previous: number): void {
  const arrow = current >= previous ? "↑" : "↓";
  console.log(`  ${decision === "KEPT" ? "✅" : "❌"} ${decision} (${previous}% → ${current}% ${arrow})`);
}

function printStop(reason: string): void {
  console.log(`\n  ⛔ STOPPING: ${reason}`);
}

function printFooter(
  scores: { percentage: number }[],
  bestScore: number,
  controlMode: boolean,
): void {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(`║  ${controlMode ? "CONTROL" : "SESSION"} COMPLETE — ${scores.length} cycles run`);
  console.log(`║  Best score: ${bestScore}%`);
  console.log(`║  Score trajectory: ${scores.map((s) => `${s.percentage}%`).join(" → ")}`);
  console.log("╚══════════════════════════════════════════════╝\n");
}

export { detectPlateau, detectOscillation, parseGeneratorOutput };

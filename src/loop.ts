import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runClaude } from "./claude.ts";
import { simulate } from "./simulate.ts";
import type { SimulationResult, CompositeScore } from "./simulate.ts";
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
  runDir: string;
  maxIterations: number;
  controlMode: boolean;
}

interface CycleResult {
  cycle: number;
  score: CompositeScore;
  kept: boolean;
  asset: string;
  simulation: SimulationResult;
}

const PLATEAU_WINDOW = 3;
const PLATEAU_THRESHOLD = 2;
const OSCILLATION_WINDOW = 4;

export async function runLoop(options: LoopOptions): Promise<void> {
  const { seed, personas, runDir, maxIterations, controlMode } = options;

  await mkdir(join(runDir, "simulation"), { recursive: true });
  await mkdir(join(runDir, "raw"), { recursive: true });

  const scores: { cycle: number; composite: number; subMetrics: CompositeScore["subMetrics"] }[] = [];
  let currentAsset = seed;
  let bestAsset = seed;
  let bestScore = 0;

  // Save v0 (seed)
  await writeFile(join(runDir, "v0.md"), seed);

  printHeader(controlMode);

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

      // Generate improved asset
      printStep("Generating improved version...");
      const previousFeedback =
        scores.length > 0
          ? `\n\nPrevious score: ${scores[scores.length - 1].composite}/100`
          : "";
      const lessonsSection =
        lessons && !controlMode ? `\n\nLessons learned so far:\n${lessons}` : "";

      const generatePrompt = `You are an expert content creator improving a piece of content through iterative refinement.

Here is the current version:

---
${currentAsset}
---
${previousFeedback}${lessonsSection}

Create an improved version. Focus on making it more engaging, memorable, and shareable. Output ONLY the improved content, nothing else.`;

      const newAsset = await runClaude(generatePrompt);
      await writeFile(join(runDir, `v${cycle}.md`), newAsset);

      // Simulate
      printStep("Running persona simulation...");
      const simulation = await simulate(newAsset, personas);

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
      printScore(cycle, score);

      scores.push({ cycle, composite: score.composite, subMetrics: score.subMetrics });

      // Decide: keep or discard
      const previousScore = scores.length > 1 ? scores[scores.length - 2].composite : 0;
      const kept = score.composite >= previousScore;

      if (kept) {
        currentAsset = newAsset;
        if (score.composite > bestScore) {
          bestScore = score.composite;
          bestAsset = newAsset;
        }
        printDecision("KEPT", score.composite, previousScore);
      } else {
        printDecision("DISCARDED", score.composite, previousScore);
        currentAsset = bestAsset; // revert to best known version
      }

      // Reflect and update memory (skip in control mode)
      if (!controlMode) {
        printStep("Reflecting...");
        const reflectionPrompt = `You just ran an experiment improving content. Here are the results:

Score: ${score.composite}/100 (previous: ${previousScore}/100)
Decision: ${kept ? "KEPT — this version is better" : "DISCARDED — reverting to previous best"}

Persona reactions:
${simulation.reactions.map((r) => `[${r.persona}]: ${r.reaction}`).join("\n")}

Cross-reactions:
${simulation.crossReactions.map((r) => `[${r.persona}]: ${r.reaction}`).join("\n")}

Write a brief lesson (2-3 sentences) about what worked or didn't work and what to try differently next time. ${!kept ? "Since this version was discarded, explain what went wrong and suggest a fundamentally different direction." : ""}`;

        try {
          const reflection = await runClaude(reflectionPrompt);
          const newLesson = `\n---\nCycle ${cycle} (score: ${score.composite}): ${reflection}`;
          const existingLessons = await loadLessons(runDir);
          await saveLessons(runDir, existingLessons + newLesson);

          // Update persona memory
          for (const r of simulation.reactions) {
            const persona = personas.find((p) => p.name === r.persona);
            if (persona) {
              const existingMemory = await loadPersonaMemory(runDir, r.persona);
              const newMemory = `${existingMemory}\n---\nCycle ${cycle}: Reacted to content (score ${score.composite}). My reaction: ${r.reaction.slice(0, 200)}`;
              await savePersonaMemory(runDir, r.persona, newMemory);
            }
          }
        } catch (err) {
          console.warn(`  Reflection failed: ${err}. Continuing.`);
        }
      }

      // Check stopping conditions
      if (detectPlateau(scores)) {
        printStop("Plateau detected — scores haven't changed significantly in 3 cycles.");
        break;
      }
      if (detectOscillation(scores)) {
        printStop("Oscillation detected — scores alternating up/down for 4+ cycles.");
        break;
      }
    } catch (err) {
      console.warn(`\n  Cycle ${cycle} failed: ${err}. Skipping.`);
    }
  }

  // Save scores
  await writeFile(join(runDir, "scores.json"), JSON.stringify(scores, null, 2));

  // Write summary
  await writeSummary(runDir, scores, bestAsset, bestScore, controlMode);

  printFooter(scores, bestScore, controlMode);
}

function detectPlateau(
  scores: { composite: number }[],
): boolean {
  if (scores.length < PLATEAU_WINDOW) return false;
  const recent = scores.slice(-PLATEAU_WINDOW);
  const max = Math.max(...recent.map((s) => s.composite));
  const min = Math.min(...recent.map((s) => s.composite));
  return max - min <= PLATEAU_THRESHOLD;
}

function detectOscillation(
  scores: { composite: number }[],
): boolean {
  if (scores.length < OSCILLATION_WINDOW) return false;
  const recent = scores.slice(-OSCILLATION_WINDOW);
  let alternations = 0;
  for (let i = 1; i < recent.length; i++) {
    const prev = i > 1 ? recent[i - 1].composite - recent[i - 2].composite : 0;
    const curr = recent[i].composite - recent[i - 1].composite;
    if (prev !== 0 && curr !== 0 && Math.sign(prev) !== Math.sign(curr)) {
      alternations++;
    }
  }
  return alternations >= OSCILLATION_WINDOW - 2;
}

async function writeSummary(
  runDir: string,
  scores: { cycle: number; composite: number; subMetrics: CompositeScore["subMetrics"] }[],
  bestAsset: string,
  bestScore: number,
  controlMode: boolean,
): Promise<void> {
  const scoreCurve = scores
    .map((s) => `  Cycle ${s.cycle}: ${s.composite}/100`)
    .join("\n");

  const bestCycle = scores.reduce(
    (best, s) => (s.composite > best.composite ? s : best),
    scores[0],
  );

  const summary = `# Session Summary${controlMode ? " (CONTROL RUN)" : ""}

## Best Version
Score: ${bestScore}/100 (Cycle ${bestCycle?.cycle ?? 0})

## Learning Curve
${scoreCurve}

## Best Asset
${bestAsset}

## Sub-Metrics (Best Cycle)
- Engagement Depth: ${bestCycle?.subMetrics.engagementDepth ?? 0}/5
- Controversy: ${bestCycle?.subMetrics.controversy ?? 0}/5
- Memorability: ${bestCycle?.subMetrics.memorability ?? 0}/5
- Virality Proxy: ${bestCycle?.subMetrics.viralityProxy ?? 0}/5
- Hook Survival: ${bestCycle?.subMetrics.hookSurvival ?? 0}/5
`;

  await writeFile(join(runDir, "summary.md"), summary);
}

// --- Dashboard output ---

function printHeader(controlMode: boolean): void {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(
    controlMode
      ? "║       ZENY — CONTROL RUN (no learning)       ║"
      : "║       ZENY — Self-Learning Loop                ║",
  );
  console.log("╚══════════════════════════════════════════════╝\n");
}

function printCycleStart(cycle: number, max: number): void {
  console.log(`\n┌─── Cycle ${cycle}/${max} ${"─".repeat(30)}┐`);
}

function printStep(msg: string): void {
  console.log(`  → ${msg}`);
}

function printPersonaReaction(name: string, reaction: string): void {
  const short = reaction.length > 120 ? reaction.slice(0, 120) + "..." : reaction;
  console.log(`  💬 ${name}: "${short}"`);
}

function printScore(cycle: number, score: CompositeScore): void {
  const bar = "█".repeat(Math.round(score.composite / 5)) + "░".repeat(20 - Math.round(score.composite / 5));
  console.log(`  📊 Score: ${score.composite}/100 [${bar}]`);
  console.log(
    `     ED:${score.subMetrics.engagementDepth} CO:${score.subMetrics.controversy} ME:${score.subMetrics.memorability} VI:${score.subMetrics.viralityProxy} HK:${score.subMetrics.hookSurvival}`,
  );
}

function printDecision(decision: string, current: number, previous: number): void {
  const arrow = current >= previous ? "↑" : "↓";
  console.log(`  ${decision === "KEPT" ? "✅" : "❌"} ${decision} (${previous} → ${current} ${arrow})`);
}

function printStop(reason: string): void {
  console.log(`\n  ⛔ STOPPING: ${reason}`);
}

function printFooter(
  scores: { composite: number }[],
  bestScore: number,
  controlMode: boolean,
): void {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(`║  ${controlMode ? "CONTROL" : "SESSION"} COMPLETE — ${scores.length} cycles run`);
  console.log(`║  Best score: ${bestScore}/100`);
  console.log(`║  Score trajectory: ${scores.map((s) => s.composite).join(" → ")}`);
  console.log("╚══════════════════════════════════════════════╝\n");
}

export { detectPlateau, detectOscillation };

import { runClaude } from "./claude.ts";
import type { Persona } from "./memory.ts";

export interface Eval {
  name: string;
  question: string;
  isFloor: boolean; // if true, failing this = score 0
}

export interface SimulationResult {
  reactions: PersonaReaction[];
  crossReactions: PersonaReaction[];
  score: EvalScore;
}

export interface PersonaReaction {
  persona: string;
  reaction: string;
}

export interface EvalScore {
  passed: number;
  total: number;
  percentage: number;
  results: { eval: string; passed: boolean }[];
  floorFailed: boolean;
}

export async function simulate(
  asset: string,
  personas: Persona[],
  evals: Eval[],
  icp: string,
): Promise<SimulationResult> {
  // Step 1: Get individual reactions (parallel)
  const reactionPromises = personas.map((p) => getReaction(p, asset, icp));
  const reactionResults = await Promise.allSettled(reactionPromises);

  const reactions: PersonaReaction[] = [];
  for (let i = 0; i < reactionResults.length; i++) {
    const result = reactionResults[i];
    if (result.status === "fulfilled") {
      reactions.push({ persona: personas[i].name, reaction: result.value });
    } else {
      console.warn(`  Persona ${personas[i].name} failed: ${result.reason}`);
    }
  }

  if (reactions.length === 0) {
    throw new Error("All persona reactions failed — cannot score this cycle");
  }

  // Step 2: Cross-reactions (parallel)
  const crossReactions = await getCrossReactions(reactions, personas);

  // Step 3: Score with binary evals (separate prompt — guardrail: generator never sees this)
  const score = await runEvals(asset, reactions, crossReactions, evals);

  return { reactions, crossReactions, score };
}

async function getReaction(persona: Persona, asset: string, icp: string): Promise<string> {
  const memorySection = persona.memory
    ? `\n\nYour memory from previous rounds:\n${persona.memory}`
    : "";

  const icpSection = icp
    ? `\n\nThis content is targeted at the following audience:\n${icp}\n\nYou are a member of this audience.`
    : "";

  const prompt = `You are roleplaying as a specific persona. Stay in character completely.

${persona.definition}${icpSection}${memorySection}

You are scrolling through your feed and you see this content:

---
${asset}
---

Describe what you would actually DO when you see this content. Would you scroll past? Stop and read? Bookmark it? Reply? Share it? Argue with it? Be specific and authentic to your character. Describe your genuine reaction in 2-4 sentences.`;

  return runClaude(prompt);
}

async function getCrossReactions(
  reactions: PersonaReaction[],
  personas: Persona[],
): Promise<PersonaReaction[]> {
  const reactionsText = reactions
    .map((r) => `[${r.persona}]: ${r.reaction}`)
    .join("\n\n");

  const crossPromises = personas
    .filter((p) => reactions.some((r) => r.persona === p.name))
    .map(async (persona) => {
      try {
        const prompt = `You are roleplaying as a specific persona. Stay in character completely.

${persona.definition}

Other people reacted to a piece of content. Here are their reactions:

${reactionsText}

Read all the reactions. Pick the one reaction from another person that you find most interesting, surprising, or that you most disagree with. Respond to THAT person's reaction (not the original content). Stay in character. 2-3 sentences.`;

        const reaction = await runClaude(prompt);
        return { persona: persona.name, reaction };
      } catch {
        return null;
      }
    });

  const results = await Promise.allSettled(crossPromises);
  return results
    .filter((r): r is PromiseFulfilledResult<PersonaReaction | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((r): r is PersonaReaction => r !== null);
}

async function runEvals(
  asset: string,
  reactions: PersonaReaction[],
  crossReactions: PersonaReaction[],
  evals: Eval[],
): Promise<EvalScore> {
  const reactionsText = [
    ...reactions.map((r) => `[${r.persona}]: ${r.reaction}`),
    ...crossReactions.map((r) => `[${r.persona} cross-reaction]: ${r.reaction}`),
  ].join("\n\n");

  const evalQuestions = evals
    .map((e, i) => `EVAL ${i + 1}: ${e.name}\nQuestion: ${e.question}`)
    .join("\n\n");

  // GUARDRAIL: This prompt is NEVER shown to the generator.
  const prompt = `You are an impartial content evaluator. Answer each question with ONLY "yes" or "no" based on the evidence.

Here is the content being evaluated:

---
${asset}
---

Here are audience reactions to this content:

${reactionsText}

Answer each eval question. Output ONLY "yes" or "no" for each, one per line, in order.

${evalQuestions}

Output format (one answer per line, nothing else):
${evals.map((_, i) => `eval_${i + 1}: yes/no`).join("\n")}`;

  try {
    const response = await runClaude(prompt);
    return parseEvalResponse(response, evals);
  } catch {
    return {
      passed: 0,
      total: evals.length,
      percentage: 0,
      results: evals.map((e) => ({ eval: e.name, passed: false })),
      floorFailed: false,
    };
  }
}

export function parseEvalResponse(response: string, evals: Eval[]): EvalScore {
  const results: { eval: string; passed: boolean }[] = [];
  let floorFailed = false;

  for (let i = 0; i < evals.length; i++) {
    const pattern = new RegExp(`eval_${i + 1}:\\s*(yes|no)`, "i");
    const match = response.match(pattern);
    const passed = match ? match[1].toLowerCase() === "yes" : false;

    if (!passed && evals[i].isFloor) {
      floorFailed = true;
    }

    results.push({ eval: evals[i].name, passed });
  }

  const passedCount = floorFailed ? 0 : results.filter((r) => r.passed).length;
  const total = evals.length;
  const percentage = total > 0 ? Math.round((passedCount / total) * 100) : 0;

  return { passed: passedCount, total, percentage, results, floorFailed };
}

export function parseEvalsFile(content: string): Eval[] {
  const evals: Eval[] = [];
  const blocks = content.split(/^EVAL \d+:/m).slice(1);

  for (const block of blocks) {
    const nameMatch = block.match(/^(.+)/);
    const questionMatch = block.match(/Question:\s*(.+)/);
    const isFloor = /Hard floor|hard floor|NOTE:.*floor/i.test(block);

    if (nameMatch && questionMatch) {
      evals.push({
        name: nameMatch[1].trim(),
        question: questionMatch[1].trim(),
        isFloor,
      });
    }
  }

  return evals;
}

import { runClaude } from "./claude.ts";
import type { Persona } from "./memory.ts";

export interface SimulationResult {
  reactions: PersonaReaction[];
  crossReactions: PersonaReaction[];
  score: CompositeScore;
}

export interface PersonaReaction {
  persona: string;
  reaction: string;
}

export interface CompositeScore {
  composite: number;
  subMetrics: {
    engagementDepth: number;
    controversy: number;
    memorability: number;
    viralityProxy: number;
    hookSurvival: number;
  };
}

const WEIGHTS = {
  engagementDepth: 0.3,
  controversy: 0.15,
  memorability: 0.25,
  viralityProxy: 0.2,
  hookSurvival: 0.1,
};

export async function simulate(
  asset: string,
  personas: Persona[],
): Promise<SimulationResult> {
  // Step 1: Get individual reactions (parallel)
  const reactionPromises = personas.map((p) => getReaction(p, asset));
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

  // Step 3: Extract score (separate prompt — guardrail: generator never sees this)
  const allReactionText = [
    ...reactions.map((r) => `[${r.persona}]: ${r.reaction}`),
    ...crossReactions.map((r) => `[${r.persona} cross-reaction]: ${r.reaction}`),
  ].join("\n\n");

  const score = await extractScore(allReactionText);

  return { reactions, crossReactions, score };
}

async function getReaction(persona: Persona, asset: string): Promise<string> {
  const memorySection = persona.memory
    ? `\n\nYour memory from previous rounds:\n${persona.memory}`
    : "";

  const prompt = `You are roleplaying as a specific persona. Stay in character completely.

${persona.definition}${memorySection}

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

async function extractScore(allReactionText: string): Promise<CompositeScore> {
  // GUARDRAIL: This prompt is NEVER shown to the generator.
  // The generator sees persona reactions but NOT these scoring criteria.
  const prompt = `You are a behavioral analyst extracting metrics from audience simulation data.

Analyze these audience reactions and cross-reactions to a piece of content:

${allReactionText}

Extract these 5 metrics. For each, output a number from 0 to 5 (0 = none of the personas, 5 = all personas).

## Engagement Depth
How many personas wrote a substantive response (more than a dismissal)? Count personas who clearly read and thought about the content.

## Controversy
How many cross-reaction disagreements are there? Count instances where one persona pushes back on another's take.

## Memorability
How many personas indicated they would save, bookmark, or come back to this content? Look for language suggesting future reference, not just current interest.

## Virality Proxy
How many personas indicated they would share, repost, or send this to someone else? Look for sharing intent.

## Hook Survival
How many personas read past the first line? Count personas who engaged with specific details from the body of the content, not just the opening.

Output ONLY in this exact format (numbers only, 0-5 each):
engagement_depth: <number>
controversy: <number>
memorability: <number>
virality_proxy: <number>
hook_survival: <number>`;

  try {
    const response = await runClaude(prompt);
    return parseScoreResponse(response);
  } catch {
    return {
      composite: 0,
      subMetrics: {
        engagementDepth: 0,
        controversy: 0,
        memorability: 0,
        viralityProxy: 0,
        hookSurvival: 0,
      },
    };
  }
}

function parseScoreResponse(response: string): CompositeScore {
  const extract = (key: string): number => {
    const match = response.match(new RegExp(`${key}:\\s*(\\d+)`));
    const val = match ? parseInt(match[1], 10) : 0;
    return Math.min(5, Math.max(0, val)); // clamp 0-5
  };

  const subMetrics = {
    engagementDepth: extract("engagement_depth"),
    controversy: extract("controversy"),
    memorability: extract("memorability"),
    viralityProxy: extract("virality_proxy"),
    hookSurvival: extract("hook_survival"),
  };

  const composite = Math.round(
    (subMetrics.engagementDepth * WEIGHTS.engagementDepth +
      subMetrics.controversy * WEIGHTS.controversy +
      subMetrics.memorability * WEIGHTS.memorability +
      subMetrics.viralityProxy * WEIGHTS.viralityProxy +
      subMetrics.hookSurvival * WEIGHTS.hookSurvival) *
      20,
  );

  return { composite, subMetrics };
}

export { parseScoreResponse };

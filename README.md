# Zeny

Self-learning content loop. Generates content, simulates audience reactions with personas, scores with binary evals, keeps what works, discards what doesn't. Learns every cycle.

Based on [Karpathy's autoresearch](https://github.com/karpathy/autoresearch) methodology + [MiroFish](https://github.com/MiroFish)-style persona simulation.

## Quick start

```bash
# Prerequisites: bun, claude CLI
bun install

# Run with auto-generated seed (reads baseline.md)
bun run src/index.ts

# Run with existing content
bun run src/index.ts --seed my-tweet.md

# Baseline comparison (no learning)
bun run src/index.ts --control
```

That's it. Zeny reads your `baseline.md`, auto-generates a seed, and starts the loop.

## How it works

```
baseline.md → generate seed → simulate (5 personas react) → score (binary evals) → keep/discard → learn → repeat
```

Each cycle:
1. **Generate**: Makes ONE targeted change to the content (not a full rewrite)
2. **Simulate**: 5 personas react to the content, then cross-react to each other
3. **Score**: Binary yes/no evals determine pass/fail (not scales)
4. **Decide**: Keep if score improved, discard if not (revert to best known version)
5. **Learn**: Reflect on what worked, update lessons and persona memory

Stops automatically on plateau, oscillation, perfect score, or max iterations.

## Setup your project

You need 3 files:

### `baseline.md` (required)

Your company context. The generator and personas use this to stay grounded.

```markdown
# Baseline

## Company
Your company name and one-line description.

## Mission
What you're trying to do in the world.

## ICP (Ideal Customer Profile)
Who is your target audience? Be specific. Demographics, psychographics,
what they care about, what they don't care about.

## Problem
What problem does your audience have?

## Old Solution
How do they currently solve it?

## Why Old Solution Fails
Why is the current approach broken?

## New Solution
What's your approach?

## Benefits
What does the user get?

## Product
What is it, concretely?

## Offer
What do you want the reader to do?

## Voice & Tone
How should the content sound?
```

### `evals.md` (required)

Binary yes/no checks that define "good content." Max 6.

```markdown
EVAL 1: Consciousness floor
Question: Is this content free of fear-mongering, shame, or manipulation?
Pass: Content informs or inspires without exploiting negative emotions
Fail: Content uses fear or manufactured urgency
NOTE: Hard floor — if this fails, the entire score is 0

EVAL 2: Genuine value
Question: Does this content genuinely help the target reader?
Pass: Reader walks away with a new insight or practical takeaway
Fail: Content is empty calories

EVAL 3: Hook
Question: Does the opening line contain a specific claim or question?
Pass: First sentence is concrete and specific
Fail: Opens with generic filler
```

The first eval can be a **hard floor** — add `NOTE: Hard floor` and failing it
forces the entire score to 0%, regardless of other evals.

### `personas/` (ships with defaults)

Markdown files defining audience archetypes. 5 ship by default:
- `skeptic.md` — cynical, needs evidence
- `lurker.md` — reads everything, rarely engages
- `busy.md` — 8-second attention span
- `student.md` — eager learner, generous with engagement
- `contrarian.md` — lives to argue

Add your own: drop a `.md` file in `personas/`. Remove defaults you don't want.

## CLI options

```
--seed <file>           Start from existing content (skips auto-generation)
--baseline <file>       Path to baseline file (default: ./baseline.md)
--evals <file>          Path to evals file (default: ./evals.md)
--control               Run without learning (for A/B comparison)
--max-iterations <n>    Maximum cycles (default: 10)
--personas-dir <dir>    Path to personas directory (default: ./personas)
```

## Output

Each run creates `runs/{timestamp}/`:

```
runs/2026-03-24T21-53-45/
  v0.md                       # seed (starting content)
  v1.md, v2.md, ...           # each version
  scores.json                 # score history
  lessons.md                  # what the agent learned
  summary.md                  # session summary with best version
  simulation/round-1.json     # raw persona reactions per cycle
  raw/cycle-1.txt             # raw claude output per cycle
  personas/                   # persona memory snapshots
```

## Philosophy

**Value-first, not engagement-first.** Zeny optimizes for genuine value to
the reader, with engagement as a constraint. The consciousness floor prevents
the optimizer from finding engagement through negativity or manipulation.

**Binary evals, not scales.** Scales (rate 1-10) are noisy and unreliable.
Binary yes/no checks give consistent signal across runs.

**One change at a time.** Each cycle makes one targeted mutation, not a full
rewrite. You know exactly what helped.

**Your data stays local.** Everything runs on your machine through your Claude
Code subscription. No API keys, no cloud, no data leaving your laptop.

## Tests

```bash
bun test
```

## License

MIT

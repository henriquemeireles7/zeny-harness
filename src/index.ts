#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadPersonas } from "./memory.ts";
import { parseEvalsFile } from "./simulate.ts";
import { runLoop } from "./loop.ts";
import { runClaude } from "./claude.ts";

interface Args {
  seed?: string;
  baseline: string;
  evals: string;
  control: boolean;
  maxIterations: number;
  personasDir: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    baseline: join(process.cwd(), "baseline.md"),
    evals: join(process.cwd(), "evals.md"),
    control: false,
    maxIterations: 10,
    personasDir: join(process.cwd(), "personas"),
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--seed":
        args.seed = argv[++i];
        break;
      case "--baseline":
        args.baseline = resolve(argv[++i]);
        break;
      case "--evals":
        args.evals = resolve(argv[++i]);
        break;
      case "--control":
        args.control = true;
        break;
      case "--max-iterations":
        args.maxIterations = parseInt(argv[++i], 10);
        break;
      case "--personas-dir":
        args.personasDir = resolve(argv[++i]);
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  return args;
}

function printUsage(): void {
  console.log(`
Usage: zeny [options]

Options:
  --seed <file>           Path to seed content file (skip auto-generation)
  --baseline <file>       Path to baseline file (default: ./baseline.md)
  --evals <file>          Path to evals file (default: ./evals.md)
  --control               Run without learning (baseline comparison)
  --max-iterations <n>    Maximum cycles (default: 10)
  --personas-dir <dir>    Path to personas directory (default: ./personas)
  -h, --help              Show this help

Examples:
  zeny                                    # auto-generates seed from baseline.md
  zeny --seed my-tweet.md                 # start from existing content
  zeny --max-iterations 5 --control       # baseline run, 5 cycles
`);
}

async function generateSeed(baseline: string): Promise<string> {
  console.log("  Generating seed from baseline...");
  const prompt = `You are a content creator. Based on the following company baseline, write ONE short piece of content (a tweet or short post, under 280 characters) that would genuinely help the target audience.

The content should:
- Share a real insight or practical tip related to the company's problem space
- Be valuable even if the reader never uses the product
- Sound like a real person, not a brand
- NOT be a product announcement or sales pitch

Baseline:
${baseline}

Output ONLY the content, nothing else. No quotes, no explanation.`;

  return runClaude(prompt);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Load baseline (required)
  let baseline: string;
  try {
    baseline = await readFile(args.baseline, "utf-8");
    console.log(`Baseline loaded from ${args.baseline}`);
  } catch {
    console.error(`Error: baseline.md not found at ${args.baseline}`);
    console.error("Create baseline.md with your company context. See README for format.");
    process.exit(1);
  }

  // Load or generate seed
  let seed: string;
  if (args.seed) {
    try {
      seed = await readFile(args.seed, "utf-8");
      console.log(`Seed loaded from ${args.seed}`);
    } catch {
      console.error(`Error: could not read seed file: ${args.seed}`);
      process.exit(1);
    }
  } else {
    seed = await generateSeed(baseline);
    console.log(`Seed auto-generated: "${seed.slice(0, 80)}..."`);
  }

  // Load evals
  let evals;
  try {
    const evalsContent = await readFile(args.evals, "utf-8");
    evals = parseEvalsFile(evalsContent);
    if (evals.length === 0) throw new Error("No evals found");
    if (evals.length > 6) {
      console.warn(`Warning: ${evals.length} evals loaded (max recommended: 6).`);
    }
    console.log(`Loaded ${evals.length} evals`);
  } catch (err) {
    console.error(`Error loading evals: ${err}`);
    process.exit(1);
  }

  // Load personas
  let personas;
  try {
    personas = await loadPersonas(args.personasDir);
    console.log(`Loaded ${personas.length} personas: ${personas.map((p) => p.name).join(", ")}`);
  } catch (err) {
    console.error(`Error loading personas: ${err}`);
    process.exit(1);
  }

  // Create run directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = join(process.cwd(), "runs", timestamp);

  // Run the loop
  await runLoop({
    seed,
    personas,
    evals,
    baseline,
    runDir,
    maxIterations: args.maxIterations,
    controlMode: args.control,
  });

  console.log(`\nResults saved to: ${runDir}`);
  console.log(`Summary: ${join(runDir, "summary.md")}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`Fatal error: ${err}`);
    process.exit(1);
  });
}

export { parseArgs, generateSeed };

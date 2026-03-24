#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadPersonas } from "./memory.ts";
import { runLoop } from "./loop.ts";

interface Args {
  seed?: string;
  prompt?: string;
  control: boolean;
  maxIterations: number;
  personasDir: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    control: false,
    maxIterations: 10,
    personasDir: join(process.cwd(), "personas"),
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--seed":
        args.seed = argv[++i];
        break;
      case "--prompt":
        args.prompt = argv[++i];
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
  --seed <file>           Path to seed content file (start from existing asset)
  --prompt <text>         Text prompt to generate initial content
  --control               Run without learning (baseline comparison)
  --max-iterations <n>    Maximum cycles (default: 10)
  --personas-dir <dir>    Path to personas directory (default: ./personas)
  -h, --help              Show this help

Examples:
  zeny --seed tweet.md
  zeny --prompt "Write a tweet about AI agents that learn"
  zeny --seed tweet.md --control   # baseline run without learning
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.seed && !args.prompt) {
    console.error("Error: provide --seed <file> or --prompt <text>");
    printUsage();
    process.exit(1);
  }

  // Load or generate initial asset
  let seed: string;
  if (args.seed) {
    try {
      seed = await readFile(args.seed, "utf-8");
    } catch {
      console.error(`Error: could not read seed file: ${args.seed}`);
      process.exit(1);
    }
  } else {
    seed = args.prompt!;
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

export { parseArgs };

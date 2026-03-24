#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadPersonas } from "./memory.ts";
import { parseEvalsFile } from "./simulate.ts";
import { runLoop } from "./loop.ts";

interface Args {
  seed?: string;
  prompt?: string;
  icp: string;
  evals: string;
  control: boolean;
  maxIterations: number;
  personasDir: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    icp: join(process.cwd(), "icp.md"),
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
      case "--prompt":
        args.prompt = argv[++i];
        break;
      case "--icp":
        args.icp = resolve(argv[++i]);
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
  --seed <file>           Path to seed content file (start from existing asset)
  --prompt <text>         Text prompt to generate initial content
  --icp <file>            Path to ICP file (default: ./icp.md)
  --evals <file>          Path to evals file (default: ./evals.md)
  --control               Run without learning (baseline comparison)
  --max-iterations <n>    Maximum cycles (default: 10)
  --personas-dir <dir>    Path to personas directory (default: ./personas)
  -h, --help              Show this help

Examples:
  zeny --seed tweet.md
  zeny --seed tweet.md --icp my-audience.md --evals my-checks.md
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

  // Load ICP
  let icp = "";
  try {
    icp = await readFile(args.icp, "utf-8");
    console.log(`ICP loaded from ${args.icp}`);
  } catch {
    console.warn("No ICP file found. Running without audience targeting.");
    console.warn("Create icp.md or use --icp <file> for better results.\n");
  }

  // Load evals
  let evals;
  try {
    const evalsContent = await readFile(args.evals, "utf-8");
    evals = parseEvalsFile(evalsContent);
    if (evals.length === 0) throw new Error("No evals found");
    if (evals.length > 6) {
      console.warn(`Warning: ${evals.length} evals loaded (max recommended: 6). More evals = noisier signal.`);
    }
    console.log(`Loaded ${evals.length} evals from ${args.evals}`);
  } catch (err) {
    console.error(`Error loading evals: ${err}`);
    console.error("Create evals.md with binary yes/no checks. See docs for format.");
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
    icp,
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

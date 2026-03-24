import { spawn } from "node:child_process";

const TIMEOUT_MS = 120_000;

export async function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    const proc = spawn("claude", ["-p", prompt], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Claude CLI timed out after 120s"));
    }, TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("error", (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("Claude CLI not found. Install it: https://docs.anthropic.com/en/docs/claude-code"));
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString("utf-8").trim();
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString("utf-8").trim();
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        return;
      }
      if (!output) {
        reject(new Error("Claude CLI returned empty output"));
        return;
      }
      resolve(output);
    });
  });
}

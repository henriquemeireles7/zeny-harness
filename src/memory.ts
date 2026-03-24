import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface Persona {
  name: string;
  definition: string;
  memory: string;
}

const LESSONS_CAP = 3;
const PERSONA_MEMORY_CAP = 5;

export async function loadPersonas(personasDir: string): Promise<Persona[]> {
  const files = (await readdir(personasDir)).filter((f) => f.endsWith(".md"));
  if (files.length === 0) throw new Error(`No persona files found in ${personasDir}`);

  return Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(personasDir, file), "utf-8");
      return {
        name: file.replace(".md", ""),
        definition: content,
        memory: "",
      };
    }),
  );
}

export async function loadPersonaMemory(runDir: string, personaName: string): Promise<string> {
  try {
    return await readFile(join(runDir, "personas", `${personaName}.md`), "utf-8");
  } catch {
    return "";
  }
}

export async function savePersonaMemory(
  runDir: string,
  personaName: string,
  memory: string,
): Promise<void> {
  const dir = join(runDir, "personas");
  await mkdir(dir, { recursive: true });
  const truncated = truncateEntries(memory, PERSONA_MEMORY_CAP);
  try {
    await writeFile(join(dir, `${personaName}.md`), truncated);
  } catch (err) {
    console.warn(`Warning: could not save memory for ${personaName}: ${err}`);
  }
}

export async function loadLessons(runDir: string): Promise<string> {
  try {
    return await readFile(join(runDir, "lessons.md"), "utf-8");
  } catch {
    return "";
  }
}

export async function saveLessons(runDir: string, lessons: string): Promise<void> {
  const truncated = truncateEntries(lessons, LESSONS_CAP);
  try {
    await writeFile(join(runDir, "lessons.md"), truncated);
  } catch (err) {
    console.warn(`Warning: could not save lessons: ${err}`);
  }
}

function truncateEntries(text: string, maxEntries: number): string {
  const entries = text.split(/\n---\n/).filter((e) => e.trim());
  if (entries.length <= maxEntries) return text;
  return entries.slice(-maxEntries).join("\n---\n");
}

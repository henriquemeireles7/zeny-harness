import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadPersonas,
  loadPersonaMemory,
  savePersonaMemory,
  loadLessons,
  saveLessons,
} from "./memory.ts";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "zeny-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("loadPersonas", () => {
  test("loads all .md files from personas directory", async () => {
    const personasDir = join(tempDir, "personas");
    await mkdir(personasDir);
    await writeFile(join(personasDir, "skeptic.md"), "# Skeptic\nI am skeptical.");
    await writeFile(join(personasDir, "lurker.md"), "# Lurker\nI lurk.");

    const personas = await loadPersonas(personasDir);
    expect(personas).toHaveLength(2);
    expect(personas.map((p) => p.name).sort()).toEqual(["lurker", "skeptic"]);
    expect(personas[0].definition).toContain("#");
    expect(personas[0].memory).toBe("");
  });

  test("throws when no .md files found", async () => {
    const emptyDir = join(tempDir, "empty");
    await mkdir(emptyDir);

    expect(loadPersonas(emptyDir)).rejects.toThrow("No persona files found");
  });

  test("throws when directory does not exist", async () => {
    expect(loadPersonas(join(tempDir, "nonexistent"))).rejects.toThrow();
  });

  test("ignores non-md files", async () => {
    const personasDir = join(tempDir, "personas");
    await mkdir(personasDir);
    await writeFile(join(personasDir, "skeptic.md"), "# Skeptic");
    await writeFile(join(personasDir, "notes.txt"), "not a persona");
    await writeFile(join(personasDir, ".DS_Store"), "");

    const personas = await loadPersonas(personasDir);
    expect(personas).toHaveLength(1);
    expect(personas[0].name).toBe("skeptic");
  });
});

describe("loadPersonaMemory", () => {
  test("returns content when memory file exists", async () => {
    await mkdir(join(tempDir, "personas"), { recursive: true });
    await writeFile(join(tempDir, "personas", "skeptic.md"), "cycle 1 memory");

    const memory = await loadPersonaMemory(tempDir, "skeptic");
    expect(memory).toBe("cycle 1 memory");
  });

  test("returns empty string when file does not exist", async () => {
    const memory = await loadPersonaMemory(tempDir, "nonexistent");
    expect(memory).toBe("");
  });
});

describe("savePersonaMemory", () => {
  test("writes memory to personas subdirectory", async () => {
    await savePersonaMemory(tempDir, "skeptic", "my memory");

    const content = await readFile(join(tempDir, "personas", "skeptic.md"), "utf-8");
    expect(content).toBe("my memory");
  });

  test("creates personas directory if missing", async () => {
    const nested = join(tempDir, "deep", "run");
    await savePersonaMemory(nested, "test", "memory");

    const content = await readFile(join(nested, "personas", "test.md"), "utf-8");
    expect(content).toBe("memory");
  });

  test("truncates memory to last 5 entries", async () => {
    const entries = Array.from({ length: 8 }, (_, i) => `Entry ${i + 1}`).join("\n---\n");
    await savePersonaMemory(tempDir, "skeptic", entries);

    const content = await readFile(join(tempDir, "personas", "skeptic.md"), "utf-8");
    const parts = content.split("\n---\n");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toContain("Entry 4");
    expect(parts[4]).toContain("Entry 8");
  });
});

describe("loadLessons", () => {
  test("returns content when lessons file exists", async () => {
    await writeFile(join(tempDir, "lessons.md"), "lesson 1");

    const lessons = await loadLessons(tempDir);
    expect(lessons).toBe("lesson 1");
  });

  test("returns empty string when file does not exist", async () => {
    const lessons = await loadLessons(tempDir);
    expect(lessons).toBe("");
  });
});

describe("saveLessons", () => {
  test("writes lessons to file", async () => {
    await saveLessons(tempDir, "my lessons");

    const content = await readFile(join(tempDir, "lessons.md"), "utf-8");
    expect(content).toBe("my lessons");
  });

  test("truncates lessons to last 3 entries", async () => {
    const entries = Array.from({ length: 6 }, (_, i) => `Lesson ${i + 1}`).join("\n---\n");
    await saveLessons(tempDir, entries);

    const content = await readFile(join(tempDir, "lessons.md"), "utf-8");
    const parts = content.split("\n---\n");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain("Lesson 4");
    expect(parts[2]).toContain("Lesson 6");
  });
});

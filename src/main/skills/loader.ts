import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { app } from "electron";

export interface Skill {
  name: string;
  description: string;
  prompt: string;
}

/**
 * Parse a simple YAML string (only supports name, description, and prompt fields).
 */
function parseSkillYaml(content: string): Skill | null {
  const lines = content.split("\n");
  let name = "";
  let description = "";
  let prompt = "";
  let currentField: "name" | "description" | "prompt" | null = null;
  let inPrompt = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (inPrompt) {
      if (line.startsWith("  ")) {
        prompt += line.slice(2) + "\n";
        continue;
      } else if (line === "") {
        prompt += "\n";
        continue;
      } else {
        // Prompt ended, trim trailing newline
        prompt = prompt.replace(/\n$/, "");
        inPrompt = false;
        currentField = null;
        // Fall through to check if this line starts a new field
      }
    }

    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) {
      name = nameMatch[1].trim();
      currentField = "name";
      continue;
    }

    const descMatch = line.match(/^description:\s*(.+)$/);
    if (descMatch) {
      description = descMatch[1].trim();
      currentField = "description";
      continue;
    }

    const promptMatch = line.match(/^prompt:\s*$/);
    if (promptMatch) {
      currentField = "prompt";
      inPrompt = true;
      prompt = "";
      continue;
    }

    // Handle inline prompt: `prompt: text`
    const inlinePromptMatch = line.match(/^prompt:\s+(.+)$/);
    if (inlinePromptMatch) {
      prompt = inlinePromptMatch[1].trim();
      currentField = "prompt";
      continue;
    }
  }

  if (inPrompt) {
    prompt = prompt.replace(/\n$/, "");
  }

  if (!name || !prompt) {
    return null;
  }

  return { name, description, prompt };
}

/**
 * Determine the skills directory path.
 * In development: project root /skills/
 * In production: bundled alongside the app
 */
function getSkillsDir(): string {
  // In development, the skills are at the project root
  const devPath = join(app.getAppPath(), "skills");
  if (existsSync(devPath)) return devPath;

  // Fallback: use userData
  const userDataPath = join(app.getPath("userData"), "skills");
  if (!existsSync(userDataPath)) {
    try {
      const { mkdirSync } = require("fs") as typeof import("fs");
      mkdirSync(userDataPath, { recursive: true });
    } catch {}
  }
  return userDataPath;
}

let cachedSkills: Skill[] | null = null;

/**
 * Load all skill files from the skills directory.
 */
export function loadSkills(): Skill[] {
  if (cachedSkills) return cachedSkills;

  const skillsDir = getSkillsDir();
  const skills: Skill[] = [];

  try {
    if (!existsSync(skillsDir)) return skills;

    const files = readdirSync(skillsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

    for (const file of files) {
      try {
        const content = readFileSync(join(skillsDir, file), "utf-8");
        const skill = parseSkillYaml(content);
        if (skill) {
          skills.push(skill);
        }
      } catch (err) {
        console.error(`[Tabby] Failed to load skill ${file}:`, err);
      }
    }
  } catch (err) {
    console.error("[Tabby] Failed to read skills directory:", err);
  }

  // In development, also try the project root's skills dir
  // The getSkillsDir already handles this

  cachedSkills = skills;
  return skills;
}

/**
 * Get a skill by name.
 */
export function getSkill(name: string): Skill | undefined {
  return loadSkills().find((s) => s.name === name);
}

/**
 * Execute a skill by name with the given context values.
 * Replaces {placeholders} in the prompt with values from the context object.
 * Returns the filled-in prompt string.
 */
export function executeSkill(name: string, context: Record<string, string>): string {
  const skill = getSkill(name);
  if (!skill) {
    throw new Error(`Skill "${name}" not found`);
  }

  let result = skill.prompt;
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return result;
}

/**
 * Clear cached skills (e.g., after a file change).
 */
export function clearCache(): void {
  cachedSkills = null;
}

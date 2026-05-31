// Takes a Skill and context, returns the filled prompt ready for AI
export function fillSkillPrompt(skill: {name: string; description: string; prompt: string}, context: Record<string, string>): string {
  // Replace {key} placeholders with context values
  let filledPrompt = skill.prompt;
  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{${key}}`;
    filledPrompt = filledPrompt.split(placeholder).join(value);
  }
  return filledPrompt;
}
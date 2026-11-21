import { describe, it, expect } from "vitest";
import {
  INTENT_COMMAND_BODY,
  PROTOTYPE_COMMAND_BODY,
  intentCommandFiles,
  MARKER_START,
  MARKER_END,
} from "./slash-commands.js";

/**
 * Drift test (final master order 2026-11-21, section B): the generated per-agent
 * files must be byte-identical to the canonical source, and the canonical text
 * must carry every contract requirement. If someone edits a file by hand or
 * forgets a rule, this fails.
 */
describe("canonical slash commands", () => {
  it("generates Claude Code and Cursor files from the canonical bodies", () => {
    const files = intentCommandFiles("/tmp/project");
    expect(files).toHaveLength(4);
    expect(files.map((f) => f.file)).toEqual([
      ".claude/commands/intent.md",
      ".claude/commands/prototype.md",
      ".cursor/commands/intent.mdc",
      ".cursor/commands/prototype.mdc",
    ]);
    const expected: Record<string, string> = {
      ".claude/commands/intent.md": INTENT_COMMAND_BODY,
      ".claude/commands/prototype.md": PROTOTYPE_COMMAND_BODY,
      ".cursor/commands/intent.mdc": INTENT_COMMAND_BODY,
      ".cursor/commands/prototype.mdc": PROTOTYPE_COMMAND_BODY,
    };
    for (const file of files) {
      expect(file.content).toBe(expected[file.file]);
      expect(file.content.startsWith(MARKER_START)).toBe(true);
      expect(file.content.trimEnd().endsWith(MARKER_END)).toBe(true);
    }
  });

  it("keeps /intent interview-only with the full contract", () => {
    const body = INTENT_COMMAND_BODY;
    for (const required of [
      "interview only",
      "ONE question at a time",
      "goal",
      "users",
      "screens",
      "flow",
      "style",
      "content",
      "Don't know, you choose",
      "Skip",
      "NO hard question limit",
      "Exactly right",
      "89",
      "97%",
      "briefs/<id>.json",
      "/prototype",
    ]) {
      expect(body).toContain(required);
    }
    expect(body).not.toContain("apply_patch"); // /intent never builds
  });

  it("keeps /prototype gated on an approved brief", () => {
    const body = PROTOTYPE_COMMAND_BODY;
    for (const required of [
      "approvalStatus",
      "run `/intent` first",
      "apply_patch",
      "open_studio",
      "quote",
      "get_feedback",
      "intent export",
      "44px",
      "purple-blue gradient",
      "John Doe",
    ]) {
      expect(body).toContain(required);
    }
  });
});

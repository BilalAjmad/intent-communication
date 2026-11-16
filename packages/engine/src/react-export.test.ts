import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { fileURLToPath } from "node:url";
import { exportToReact, SCHEMA_VERSION } from "./index";
import type { Scene } from "@intent/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.join(__dirname, "..", "tests", "golden");

function readGolden(name: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, name), "utf8")) as Record<string, string>;
}

function writeGolden(name: string, value: Record<string, string>): void {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  fs.writeFileSync(path.join(GOLDEN_DIR, name), JSON.stringify(value, null, 2) + "\n", "utf8");
}

function goldenCheck(name: string, actual: Record<string, string>): void {
  if (process.env.UPDATE_GOLDENS === "1") {
    writeGolden(name, actual);
  }
  expect(actual).toEqual(readGolden(name));
}

const SCREEN_A = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SCREEN_B = "s_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const CONT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
const CHECK = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";
const LIST = "o_05ARZ3NDEKTSV4RRFFQ69G5FAV";
const MODAL = "o_06ARZ3NDEKTSV4RRFFQ69G5FAV";
const ICON = "o_07ARZ3NDEKTSV4RRFFQ69G5FAV";
const HR = "o_08ARZ3NDEKTSV4RRFFQ69G5FAV";
const INPUT = "o_09ARZ3NDEKTSV4RRFFQ69G5FAV";
const LINK = "o_0AARZ3NDEKTSV4RRFFQ69G5FAV";

const FIXTURE_SIMPLE: Scene = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-16T00:00:00.000Z",
  updatedAt: "2026-11-16T00:00:00.000Z",
  screens: {
    [SCREEN_A]: {
      id: SCREEN_A, type: "screen", parentId: null, children: [CONT],
      props: { title: "Welcome", width: 1280, height: 720 },
      style: {}, meta: {},
    },
  },
  objects: {
    [SCREEN_A]: {
      id: SCREEN_A, type: "screen", parentId: null, children: [CONT],
      props: { title: "Welcome", width: 1280, height: 720 },
      style: {}, meta: {},
    },
    [CONT]: {
      id: CONT, type: "container", parentId: SCREEN_A, children: [TEXT, BUTTON],
      props: { layout: "flex", direction: "column", gap: 8, padding: 16 },
      style: {}, meta: {},
    },
    [TEXT]: {
      id: TEXT, type: "text", parentId: CONT, children: [],
      props: { content: "Hello from Intent", fontSize: 18 },
      style: { color: "#111111" }, meta: {},
    },
    [BUTTON]: {
      id: BUTTON, type: "button", parentId: CONT, children: [],
      props: { label: "Get started", variant: "primary" },
      style: {}, meta: {},
    },
  },
  screenOrder: [SCREEN_A],
  metadata: { name: "Golden Simple", tags: [] },
};

const FIXTURE_M2A: Scene = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-16T00:00:00.000Z",
  updatedAt: "2026-11-16T00:00:00.000Z",
  screens: {
    [SCREEN_A]: {
      id: SCREEN_A, type: "screen", parentId: null, children: [CONT],
      props: { title: "Form", width: 1280, height: 720 },
      style: {}, meta: {},
    },
    [SCREEN_B]: {
      id: SCREEN_B, type: "screen", parentId: null, children: [HR],
      props: { title: "Done", width: 1280, height: 720 },
      style: {}, meta: {},
    },
  },
  objects: {
    [SCREEN_A]: {
      id: SCREEN_A, type: "screen", parentId: null, children: [CONT],
      props: { title: "Form", width: 1280, height: 720 },
      style: {}, meta: {},
    },
    [SCREEN_B]: {
      id: SCREEN_B, type: "screen", parentId: null, children: [HR],
      props: { title: "Done", width: 1280, height: 720 },
      style: {}, meta: {},
    },
    [CONT]: {
      id: CONT, type: "container", parentId: SCREEN_A, children: [TEXT, INPUT, CHECK, LIST, MODAL, LINK],
      props: { layout: "flex", direction: "column", gap: 8, padding: 16 },
      style: {}, meta: {},
    },
    [TEXT]: {
      id: TEXT, type: "text", parentId: CONT, children: [],
      props: { content: 'Quotes "and" <brackets> {braces}', fontSize: 16 },
      style: {}, meta: {},
    },
    [INPUT]: {
      id: INPUT, type: "input", parentId: CONT, children: [],
      props: { type: "email", placeholder: "Email", value: "a@b.c", required: true },
      style: {}, meta: {},
    },
    [CHECK]: {
      id: CHECK, type: "checkbox", parentId: CONT, children: [],
      props: { label: "Agree", checked: true, name: "agree" },
      style: {}, meta: {},
    },
    [LIST]: {
      id: LIST, type: "list", parentId: CONT, children: [],
      props: { ordered: true, items: ["<script>alert(1)</script>", "plain"] },
      style: {}, meta: {},
    },
    [MODAL]: {
      id: MODAL, type: "modal", parentId: CONT, children: [ICON],
      props: { title: "Confirm", size: "sm", open: true },
      style: {}, meta: {},
    },
    [ICON]: {
      id: ICON, type: "icon", parentId: MODAL, children: [],
      props: { icon: "warning", size: 24, label: "Caution" },
      style: {}, meta: {},
    },
    [HR]: {
      id: HR, type: "divider", parentId: SCREEN_B, children: [],
      props: { direction: "horizontal", thickness: 2 },
      style: {}, meta: {},
    },
    [LINK]: {
      id: LINK, type: "link", parentId: CONT, children: [],
      props: { label: "Home", href: "#s-01ARZ3NDEKTSV4RRFFQ69G5FAV" },
      style: {}, meta: {},
    },
  },
  screenOrder: [SCREEN_A, SCREEN_B],
  metadata: { name: "Golden M2A", tags: [] },
};

describe("exportToReact (trd 13.7, M2 basic)", () => {
  it("golden: simple scene", () => {
    goldenCheck("react-simple.json", exportToReact(FIXTURE_SIMPLE));
  });

  it("golden: M2.A fixture (two screens, new object types, injection content)", () => {
    goldenCheck("react-m2a.json", exportToReact(FIXTURE_M2A));
  });

  it("is deterministic: two calls produce byte-identical output", () => {
    expect(exportToReact(FIXTURE_M2A)).toEqual(exportToReact(FIXTURE_M2A));
  });

  it("emits a sorted file map rooted at intent-export/", () => {
    const files = exportToReact(FIXTURE_M2A);
    const keys = Object.keys(files);
    expect([...keys]).toEqual([...keys].sort());
    for (const key of keys) expect(key.startsWith("intent-export/")).toBe(true);
  });

  it("scene-derived strings only ever appear inside JSON-escaped expressions", () => {
    const files = exportToReact(FIXTURE_M2A);
    const form = files["intent-export/screens/Form.tsx"];
    // JSON.stringify-in-expression form: the dangerous text exists only as a
    // JS string literal, never as JSX markup or an unquoted attribute.
    expect(form).toContain('{"Quotes \\"and\\" <brackets> {braces}"}');
    expect(form).toContain('{"<script>alert(1)</script>"}');
    expect(form).not.toContain("<img onerror");
    expect(form).not.toContain("javascript:");
  });

  it("emits React-correct boolean attributes on inputs", () => {
    const files = exportToReact(FIXTURE_M2A);
    const form = files["intent-export/screens/Form.tsx"];
    expect(form).toContain("defaultChecked");
    expect(form).toContain("defaultValue={\"a@b.c\"}");
    expect(form).toContain(" required");
  });

  it("never wires scene event handler strings as code (data only)", () => {
    const scene: Scene = {
      ...FIXTURE_SIMPLE,
      objects: {
        ...FIXTURE_SIMPLE.objects,
        [BUTTON]: {
          ...FIXTURE_SIMPLE.objects[BUTTON],
          props: { label: "X", variant: "primary", onClick: "alert(1)" },
        },
      },
    } as Scene;
    const files = exportToReact(scene);
    for (const content of Object.values(files)) {
      expect(content).not.toContain("alert(1)");
    }
  });

  it("handles a scene with zero screens without crashing or emitting hooks", () => {
    const empty: Scene = {
      ...FIXTURE_SIMPLE,
      screens: {},
      objects: {},
      screenOrder: [],
    };
    const files = exportToReact(empty);
    expect(files["intent-export/App.tsx"]).toContain("no screens yet");
    expect(files["intent-export/App.tsx"]).not.toContain("useState");
    expect(Object.keys(files)).toEqual([
      "intent-export/App.tsx",
      "intent-export/index.ts",
      "intent-export/tokens.css",
    ]);
  });

  it("throws IntentError on an invalid scene", () => {
    expect(() => exportToReact({ ...FIXTURE_SIMPLE, version: 99 } as unknown as Scene)).toThrow();
  });

  it("zero-screen App parses as valid TSX", () => {
    const files = exportToReact({ ...FIXTURE_SIMPLE, screens: {}, objects: {}, screenOrder: [] });
    const src = files["intent-export/App.tsx"];
    const source = ts.createSourceFile("App.tsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const diagnostics = (source as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics).toHaveLength(0);
  });

  it("generated .tsx/.ts files parse as valid TSX/TS (syntax check)", () => {
    const files = exportToReact(FIXTURE_M2A);
    for (const [filePath, content] of Object.entries(files)) {
      if (!/\.(tsx|ts)$/.test(filePath)) continue;
      const kind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, kind);
      const diagnostics = (source as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
      const messages = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
      expect(messages, `parse errors in ${filePath}`).toEqual([]);
    }
  });

  it("schema version constant is exported for header checks", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

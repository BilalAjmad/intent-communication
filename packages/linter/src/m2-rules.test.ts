import { describe, it, expect } from "vitest";
import { lintSceneWithRules } from "./index";
import type { Scene, Container } from "@intent/schema";

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const CONT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const CHILD_A = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const CHILD_B = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
const TXT_A = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";
const TXT_B = "o_05ARZ3NDEKTSV4RRFFQ69G5FAV";

function baseScene(objects: Record<string, unknown>, children: string[] = []): Scene {
  return {
    version: 1, revision: 1,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children,
        props: { title: "S", width: 1280, height: 720 },
        style: {}, meta: {},
      },
    },
    objects: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children,
        props: { title: "S", width: 1280, height: 720 },
        style: {}, meta: {},
      },
      ...objects,
    } as Scene["objects"],
    screenOrder: [SCREEN],
    metadata: { name: "Test", tags: [] },
  } as Scene;
}

function text(id: string, parentId: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, type: "text", parentId, children: [],
    props: { content: "Hello", fontSize: 16, ...extra },
    style: {}, meta: {},
  };
}

function button(id: string, parentId: string, props: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, type: "button", parentId, children: [],
    props: { label: "Go", variant: "primary", ...props },
    style: {}, meta: {},
  };
}

function violationsOf(ruleId: string, scene: Scene, locks: string[] = []) {
  const result = lintSceneWithRules(scene, [ruleId], locks);
  return result.violations;
}

describe("L-TYPE (design.md §9)", () => {
  it("flags a fontSize outside the type scale", () => {
    const scene = baseScene({ [TXT_A]: text(TXT_A, SCREEN, { fontSize: 13 }) }, [TXT_A]);
    expect(violationsOf("L-TYPE", scene)).toHaveLength(1);
  });
  it("accepts a fontSize inside the scale", () => {
    const scene = baseScene({ [TXT_A]: text(TXT_A, SCREEN, { fontSize: 24 }) }, [TXT_A]);
    expect(violationsOf("L-TYPE", scene)).toHaveLength(0);
  });
  it("flags more than 3 distinct font weights per screen", () => {
    const scene = baseScene(
      {
        [TXT_A]: text(TXT_A, SCREEN, { fontSize: 16, fontWeight: "light" }),
        [TXT_B]: text(TXT_B, SCREEN, { fontSize: 16, fontWeight: "500" }),
        [CHILD_A]: text(CHILD_A, SCREEN, { fontSize: 16, fontWeight: "medium" }),
        [CHILD_B]: text(CHILD_B, SCREEN, { fontSize: 16, fontWeight: "bold" }),
      },
      [TXT_A, TXT_B, CHILD_A, CHILD_B],
    );
    expect(violationsOf("L-TYPE", scene).some((v) => /distinct font weights/.test(v.message))).toBe(true);
  });
});

describe("L-TOKEN (design.md §9)", () => {
  it("flags a raw hex color", () => {
    const scene = baseScene({ [TXT_A]: { ...text(TXT_A, SCREEN), props: { content: "x", fontSize: 16, color: "#ff0000" } } }, [TXT_A]);
    expect(violationsOf("L-TOKEN", scene).length).toBeGreaterThan(0);
  });
  it("flags raw rgb() colors in style paths", () => {
    const t = text(TXT_A, SCREEN);
    const scene = baseScene({ [TXT_A]: { ...t, style: { color: "rgb(255, 0, 0)" } } }, [TXT_A]);
    expect(violationsOf("L-TOKEN", scene)).toHaveLength(1);
  });
  it("passes token.color references", () => {
    const t = text(TXT_A, SCREEN);
    const scene = baseScene({ [TXT_A]: { ...t, props: { content: "x", fontSize: 16, color: "token.color.text.primary" } } }, [TXT_A]);
    expect(violationsOf("L-TOKEN", scene)).toHaveLength(0);
  });
  it("allows raw values on locked objects", () => {
    const scene = baseScene({ [TXT_A]: { ...text(TXT_A, SCREEN), props: { content: "x", fontSize: 16, color: "#ff0000" } } }, [TXT_A]);
    expect(violationsOf("L-TOKEN", scene, [TXT_A])).toHaveLength(0);
  });
});

describe("L-STATES (design.md §10)", () => {
  it("flags a button without loading state", () => {
    const scene = baseScene({ [CHILD_A]: button(CHILD_A, SCREEN) }, [CHILD_A]);
    expect(violationsOf("L-STATES", scene).map((v) => v.message).join()).toContain("loading");
  });
  it("accepts a button with loading declared", () => {
    const scene = baseScene({ [CHILD_A]: { ...button(CHILD_A, SCREEN), states: { loading: { style: { opacity: 0.6 } } } } }, [CHILD_A]);
    expect(violationsOf("L-STATES", scene)).toHaveLength(0);
  });
  it("flags an input missing filled and error", () => {
    const input = {
      id: CHILD_A, type: "input", parentId: SCREEN, children: [],
      props: { placeholder: "Email", type: "email" },
      style: {}, meta: {},
    };
    const scene = baseScene({ [CHILD_A]: input }, [CHILD_A]);
    const messages = violationsOf("L-STATES", scene).map((v) => v.message).join();
    expect(messages).toContain("filled");
    expect(messages).toContain("error");
  });
});

describe("L-ALIGN (design.md §9)", () => {
  function absoluteCont(childrenStyle: Record<string, unknown>[]): Scene {
    const childIds = [CHILD_A, CHILD_B];
    const objects: Record<string, unknown> = {
      [CONT]: {
        id: CONT, type: "container", parentId: SCREEN, children: childIds,
        props: { layout: "absolute" },
        style: {}, meta: {},
      },
    };
    childIds.forEach((id, i) => {
      objects[id] = { id, type: "text", parentId: CONT, children: [], props: { content: "x", fontSize: 16 }, style: childrenStyle[i], meta: {} };
    });
    return baseScene(objects, [CONT]);
  }
  it("flags near-miss edges 1-3px apart", () => {
    const scene = absoluteCont([{ left: 16 }, { left: 17 }]);
    expect(violationsOf("L-ALIGN", scene)).toHaveLength(1);
  });
  it("accepts aligned edges", () => {
    const scene = absoluteCont([{ left: 16 }, { left: 16 }]);
    expect(violationsOf("L-ALIGN", scene)).toHaveLength(0);
  });
  it("accepts grid-aligned edges (multiples of 4)", () => {
    const scene = absoluteCont([{ left: 16 }, { left: 20 }]);
    expect(violationsOf("L-ALIGN", scene)).toHaveLength(0);
  });
});

describe("L-HIER (design.md §11)", () => {
  it("flags two primary buttons in one container subtree", () => {
    const objects = {
      [CONT]: {
        id: CONT, type: "container", parentId: SCREEN, children: [CHILD_A, CHILD_B],
        props: { layout: "flex", direction: "column" }, style: {}, meta: {},
      } as Container,
      [CHILD_A]: button(CHILD_A, CONT, { variant: "primary" }),
      [CHILD_B]: button(CHILD_B, CONT, { variant: "primary" }),
    };
    const scene = baseScene(objects, [CONT]);
    expect(violationsOf("L-HIER", scene).length).toBeGreaterThan(0);
  });
  it("accepts one primary action per container", () => {
    const objects = {
      [CONT]: {
        id: CONT, type: "container", parentId: SCREEN, children: [CHILD_A, CHILD_B],
        props: { layout: "flex", direction: "column" }, style: {}, meta: {},
      } as Container,
      [CHILD_A]: button(CHILD_A, CONT, { variant: "primary" }),
      [CHILD_B]: button(CHILD_B, CONT, { variant: "ghost" }),
    };
    const scene = baseScene(objects, [CONT]);
    expect(violationsOf("L-HIER", scene)).toHaveLength(0);
  });
  it("flags more than one display-size heading per screen", () => {
    const scene = baseScene(
      { [TXT_A]: text(TXT_A, SCREEN, { fontSize: 48 }), [TXT_B]: text(TXT_B, SCREEN, { fontSize: 40 }) },
      [TXT_A, TXT_B],
    );
    expect(violationsOf("L-HIER", scene).some((v) => /display-size/.test(v.message))).toBe(true);
  });
});

describe("L-A11Y (design.md §9)", () => {
  it("flags an image without alt", () => {
    const image = {
      id: CHILD_A, type: "image", parentId: SCREEN, children: [],
      props: { src: "data:image/png;base64,iVBORw0KGgo=", alt: "", fit: "cover" },
      style: {}, meta: {},
    };
    const scene = baseScene({ [CHILD_A]: image }, [CHILD_A]);
    expect(violationsOf("L-A11Y", scene).length).toBeGreaterThan(0);
  });
  it("flags an input with no accessible name", () => {
    const input = {
      id: CHILD_A, type: "input", parentId: SCREEN, children: [],
      props: { type: "text" },
      style: {}, meta: {},
    };
    const scene = baseScene({ [CHILD_A]: input }, [CHILD_A]);
    expect(violationsOf("L-A11Y", scene).map((v) => v.message).join()).toContain("accessible name");
  });
  it("accepts an input with a placeholder", () => {
    const input = {
      id: CHILD_A, type: "input", parentId: SCREEN, children: [],
      props: { type: "text", placeholder: "Email" },
      style: {}, meta: {},
    };
    const scene = baseScene({ [CHILD_A]: input }, [CHILD_A]);
    expect(violationsOf("L-A11Y", scene)).toHaveLength(0);
  });
  it("flags a button without a name", () => {
    const scene = baseScene({ [CHILD_A]: button(CHILD_A, SCREEN, { label: "  " }) }, [CHILD_A]);
    expect(violationsOf("L-A11Y", scene).length).toBeGreaterThan(0);
  });
});

describe("L-CONTENT (design.md §9)", () => {
  it("flags lorem ipsum", () => {
    const scene = baseScene({ [TXT_A]: text(TXT_A, SCREEN, { content: "Lorem ipsum dolor sit amet" }) }, [TXT_A]);
    expect(violationsOf("L-CONTENT", scene)).toHaveLength(1);
  });
  it("flags placeholder-ish text", () => {
    const scene = baseScene({ [TXT_A]: text(TXT_A, SCREEN, { content: "Text here" }) }, [TXT_A]);
    expect(violationsOf("L-CONTENT", scene)).toHaveLength(1);
  });
  it("accepts realistic copy", () => {
    const scene = baseScene({ [TXT_A]: text(TXT_A, SCREEN, { content: "Welcome back to your dashboard" }) }, [TXT_A]);
    expect(violationsOf("L-CONTENT", scene)).toHaveLength(0);
  });
});

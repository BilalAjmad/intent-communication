import { describe, it, expect } from "vitest";
import {
  ScreenSchema,
  ContainerSchema,
  TextSchema,
  ButtonSchema,
  PatchSchema,
  ConfigSchema,
  ProfileSchema,
  InterviewStateSchema,
  BriefSchema,
  FeedbackSchema,
  validateScene,
  validatePatch,
  UUIDv7Schema,
  ISODateTimeSchema,
  RevisionSchema,
} from "./index";

describe("Schema validation", () => {
  describe("UUIDv7Schema", () => {
    it("accepts valid UUID v7", () => {
      const uuid = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      expect(UUIDv7Schema.safeParse(uuid).success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      expect(UUIDv7Schema.safeParse("not-a-uuid").success).toBe(false);
    });

    it("rejects wrong version", () => {
      const uuidv4 = "123e4567-e89b-12d3-a456-426614174000";
      expect(UUIDv7Schema.safeParse(uuidv4).success).toBe(false);
    });
  });

  describe("ISODateTimeSchema", () => {
    it("accepts valid ISO 8601 UTC", () => {
      const dt = "2026-11-02T22:38:00.000Z";
      expect(ISODateTimeSchema.safeParse(dt).success).toBe(true);
    });

    it("rejects non-UTC", () => {
      expect(ISODateTimeSchema.safeParse("2026-11-02T22:38:00+05:30").success).toBe(false);
    });
  });

  describe("RevisionSchema", () => {
    it("accepts non-negative integers", () => {
      expect(RevisionSchema.safeParse(0).success).toBe(true);
      expect(RevisionSchema.safeParse(42).success).toBe(true);
    });

    it("rejects negative and non-integers", () => {
      expect(RevisionSchema.safeParse(-1).success).toBe(false);
      expect(RevisionSchema.safeParse(1.5).success).toBe(false);
    });
  });

  describe("ScreenSchema", () => {
    it("validates a minimal screen", () => {
      const screen = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        type: "screen",
        parentId: null,
        children: [],
        props: { title: "Home", width: 1280, height: 720 },
        style: {},
        meta: {},
      };
      expect(ScreenSchema.safeParse(screen).success).toBe(true);
    });

    it("rejects non-null parentId", () => {
      const screen = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        type: "screen",
        parentId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        children: [],
        props: {},
        style: {},
        meta: {},
      };
      expect(ScreenSchema.safeParse(screen).success).toBe(false);
    });
  });

  describe("ContainerSchema", () => {
    it("validates a container with flex layout", () => {
      const container = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        type: "container",
        parentId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        children: [],
        props: { layout: "flex", direction: "column", gap: 16 },
        style: {},
        meta: {},
      };
      expect(ContainerSchema.safeParse(container).success).toBe(true);
    });

    it("rejects invalid layout value", () => {
      const container = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        type: "container",
        parentId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        children: [],
        props: { layout: "invalid" },
        style: {},
        meta: {},
      };
      expect(ContainerSchema.safeParse(container).success).toBe(false);
    });
  });

  describe("TextSchema", () => {
    it("validates text with token color", () => {
      const text = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        type: "text",
        parentId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        children: [],
        props: {
          content: "Hello",
          fontSize: 16,
          color: { $type: "token", $value: "color.text.primary" },
        },
        style: {},
        meta: {},
      };
      expect(TextSchema.safeParse(text).success).toBe(true);
    });
  });

  describe("ButtonSchema", () => {
    it("validates button with variant", () => {
      const button = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        type: "button",
        parentId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        children: [],
        props: { label: "Submit", variant: "primary", size: "md" },
        style: {},
        meta: {},
      };
      expect(ButtonSchema.safeParse(button).success).toBe(true);
    });

    it("rejects invalid variant", () => {
      const button = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        type: "button",
        parentId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        children: [],
        props: { variant: "invalid" },
        style: {},
        meta: {},
      };
      expect(ButtonSchema.safeParse(button).success).toBe(false);
    });
  });

  describe("PatchSchema", () => {
    it("validates a set patch", () => {
      const patch = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        baseRevision: 5,
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d",
        op: "set",
        path: "props.label",
        value: "New Label",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      expect(PatchSchema.safeParse(patch).success).toBe(true);
    });

    it("validates unset patch without value", () => {
      const patch = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        baseRevision: 5,
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d",
        op: "unset",
        path: "style.background",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      expect(PatchSchema.safeParse(patch).success).toBe(true);
    });

    it("rejects invalid op", () => {
      const patch = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        baseRevision: 5,
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d",
        op: "invalid",
        path: "props.label",
        createdAt: "2026-11-02T22:38:00.000Z",
      };
      expect(PatchSchema.safeParse(patch).success).toBe(false);
    });
  });

  describe("ConfigSchema", () => {
    it("validates default config", () => {
      const config = {
        version: 1,
        projectName: "My Project",
        previewPort: 3456,
        studioPort: 3457,
        mcpPort: 3458,
        maxBytes: 32768,
        autoSave: true,
        lockTTL: 30000,
      };
      expect(ConfigSchema.safeParse(config).success).toBe(true);
    });

    it("rejects port out of range", () => {
      const config = {
        version: 1,
        projectName: "My Project",
        previewPort: 80,
      };
      expect(ConfigSchema.safeParse(config).success).toBe(false);
    });
  });

  describe("ProfileSchema", () => {
    it("validates profile with preferences", () => {
      const profile = {
        version: 1,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        preferences: {
          colorScheme: "dark",
          density: "comfortable",
          motion: "reduced",
          language: "en",
          tokens: { "color.primary": "#0066cc" },
        },
        patterns: [],
      };
      expect(ProfileSchema.safeParse(profile).success).toBe(true);
    });
  });

  describe("InterviewStateSchema", () => {
    it("validates in-progress state", () => {
      const state = {
        version: 1,
        status: "in_progress",
        currentTopic: "layout",
        currentQuestionIndex: 3,
        meter: 65,
        requiredTopics: ["layout", "colors", "typography"],
        answeredTopics: ["layout"],
        delegated: false,
        briefId: null,
        updatedAt: "2026-11-02T22:38:00.000Z",
      };
      expect(InterviewStateSchema.safeParse(state).success).toBe(true);
    });

    it("rejects meter > 100", () => {
      const state = {
        version: 1,
        status: "in_progress",
        meter: 101,
        requiredTopics: [],
        answeredTopics: [],
        delegated: false,
        briefId: null,
        updatedAt: "2026-11-02T22:38:00.000Z",
      };
      expect(InterviewStateSchema.safeParse(state).success).toBe(false);
    });
  });

  describe("BriefSchema", () => {
    it("validates approved brief", () => {
      const brief = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        version: 1,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        title: "Project Brief",
        summary: "Build a dashboard",
        goals: ["Show metrics", "Allow filtering"],
        constraints: ["Mobile first", "WCAG AA"],
        targetAudience: "Internal team",
        successMetrics: ["Task completion < 30s"],
        designDirection: { tone: "professional", palette: ["#0066cc", "#ffffff"] },
        technicalRequirements: ["React 18", "TypeScript"],
        outOfScope: ["Backend API"],
        approvalStatus: "approved",
        approvedAt: "2026-11-02T22:38:00.000Z",
        approvedBy: "user",
      };
      expect(BriefSchema.safeParse(brief).success).toBe(true);
    });
  });

  describe("FeedbackSchema", () => {
    it("validates visual feedback with screenshot", () => {
      const feedback = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d",
        kind: "visual",
        message: "Button too small on mobile",
        severity: "high",
        status: "sent",
        createdAt: "2026-11-02T22:38:00.000Z",
        acknowledgedAt: null,
        appliedAt: null,
        patchId: null,
        screenshot: "data:image/png;base64,...",
      };
      expect(FeedbackSchema.safeParse(feedback).success).toBe(true);
    });
  });

  describe("validate* helpers", () => {
    it("validateScene throws on invalid", () => {
      expect(() => validateScene({ version: 2 })).toThrow();
    });

    it("validatePatch returns parsed patch", () => {
      const patch = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        baseRevision: 1,
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d",
        op: "set",
        path: "props.label",
        value: "Test",
        createdAt: "2026-11-02T22:38:00.000Z",
      };
      const result = validatePatch(patch);
      expect(result.op).toBe("set");
    });
  });
});
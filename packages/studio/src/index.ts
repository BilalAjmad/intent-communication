import { Scene, SceneObject, validateScene } from "@intent/schema";
import { exportToHtml } from "@intent/engine";

export interface StudioState {
  sceneId: string;
  scene: Scene | null;
  selectedObjectId: string | null;
  previewUrl: string;
  isPreviewLoading: boolean;
  toolMode: "select" | "rectangle" | "text" | "button" | "image" | "container";
  history: StudioHistoryEntry[];
  historyIndex: number;
}

export interface StudioHistoryEntry {
  scene: Scene;
  timestamp: number;
  description: string;
}

export interface StudioConfig {
  previewPort: number;
  studioPort: number;
  mcpPort: number;
}

export class Studio {
  private state: StudioState;
  private config: StudioConfig;
  private eventSource: EventSource | null = null;
  private mcpBaseUrl: string;

  constructor(config: StudioConfig) {
    this.config = config;
    this.mcpBaseUrl = `http://localhost:${config.mcpPort}`;
    this.state = {
      sceneId: "default",
      scene: null,
      selectedObjectId: null,
      previewUrl: `http://localhost:${config.previewPort}?scene=default`,
      isPreviewLoading: false,
      toolMode: "select",
      history: [],
      historyIndex: -1,
    };
  }

  async loadScene(sceneId: string): Promise<void> {
    this.state.sceneId = sceneId;
    this.state.previewUrl = `http://localhost:${this.config.previewPort}?scene=${sceneId}`;
    await this.refreshScene();
  }

  async refreshScene(): Promise<void> {
    try {
      const response = await fetch(`${this.mcpBaseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "get_scene",
          input: { objectIds: [], depth: 2, includeLocks: true, maxBytes: 32768 },
        }),
      });
      const result = await response.json();
      if (result.success && result.result.scene) {
        this.state.scene = result.result.scene;
        this.pushHistory("Scene loaded");
      }
    } catch (error) {
      console.error("Failed to load scene:", error);
    }
  }

  private pushHistory(description: string): void {
    if (!this.state.scene) return;
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
    this.state.history.push({
      scene: JSON.parse(JSON.stringify(this.state.scene)),
      timestamp: Date.now(),
      description,
    });
    this.state.historyIndex = this.state.history.length - 1;
    if (this.state.history.length > 50) {
      this.state.history.shift();
      this.state.historyIndex--;
    }
  }

  selectObject(objectId: string | null): void {
    this.state.selectedObjectId = objectId;
  }

  setToolMode(mode: StudioState["toolMode"]): void {
    this.state.toolMode = mode;
  }

  async applyPatch(patch: any): Promise<void> {
    if (!this.state.scene) return;
    this.pushHistory(`Apply patch: ${patch.op} ${patch.path}`);

    const response = await fetch(`${this.mcpBaseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "apply_patch", input: { patch, force: false } }),
    });
    const result = await response.json();
    if (result.success) {
      await this.refreshScene();
    } else {
      console.error("Patch failed:", result.error);
      this.undo();
    }
  }

  async updateProperty(objectId: string, path: string, value: any): Promise<void> {
    const patch = {
      id: crypto.randomUUID(),
      sceneId: this.state.sceneId,
      baseRevision: this.state.scene?.revision ?? 0,
      objectId,
      op: value === undefined ? "unset" : "set",
      path,
      value,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await this.applyPatch(patch);
  }

  undo(): void {
    if (this.state.historyIndex > 0) {
      this.state.historyIndex--;
      const entry = this.state.history[this.state.historyIndex];
      if (entry) {
        this.state.scene = entry.scene;
        this.applyScene(entry.scene);
      }
    }
  }

  redo(): void {
    if (this.state.historyIndex < this.state.history.length - 1) {
      this.state.historyIndex++;
      const entry = this.state.history[this.state.historyIndex];
      if (entry) {
        this.state.scene = entry.scene;
        this.applyScene(entry.scene);
      }
    }
  }

  private async applyScene(scene: Scene): Promise<void> {
    // Apply scene to preview via MCP
    await fetch(`${this.mcpBaseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "apply_patch", input: { patch: [], force: true } }),
    });
  }

  connectSSE(): void {
    this.eventSource = new EventSource(`http://localhost:${this.config.previewPort}/events?scene=${this.state.sceneId}`);
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "revision") {
        // Scene updated, refresh
        this.refreshScene();
      } else if (data.type === "patch") {
        // Patch applied
        this.refreshScene();
      }
    };
  }

  disconnectSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  async exportHtml(filePath: string): Promise<void> {
    if (!this.state.scene) return;
    const html = exportToHtml(this.state.scene, {
      includeStyles: true,
      includeScripts: true,
      inlineAssets: true,
    });
    // In browser, would use File System Access API or download
    console.log("Export HTML:", filePath, html.length, "chars");
  }

  getState(): StudioState {
    return { ...this.state };
  }

  getConfig(): StudioConfig {
    return { ...this.config };
  }
}

export function createStudio(config: StudioConfig): Studio {
  return new Studio(config);
}
export interface WriteResult {
  success: boolean;
  revision: number;
  error?: string;
}

export interface NormalizeResult {
  scene: import("@intent/schema").Scene;
  patches: import("@intent/schema").Patch[];
}
